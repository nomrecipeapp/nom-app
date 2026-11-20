import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Tag who you cooked with + "Log it too" (1.0.4).
// Table: cook_tags (cook_id, user_id = who's tagged, tagged_by). Rules: supabase/sql/2026-11-20-cook-tags.sql
// Everything here fails soft: if tags can't load or save, the cook itself still works.

const TAG_PROFILE_FIELDS = 'id, full_name, username, avatar_url'

export function displayName(p) {
  return (p?.full_name || '').trim() || (p?.username ? `@${p.username}` : 'Someone')
}

export function firstNameOf(p) {
  return (p?.full_name || '').trim().split(' ')[0] || p?.username || 'Someone'
}

// "Cooked with Maya", "Cooked with Maya and Josh", "Cooked with Maya, Josh and 2 others"
export function cookedWithText(people, { meId } = {}) {
  const names = people.map(p => (p.id === meId ? 'you' : firstNameOf(p)))
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`
}

// People I've blocked or who blocked me never show up in tags
let blockedCache = null
async function blockedIds() {
  if (blockedCache) return blockedCache
  try {
    const { data } = await supabase.rpc('my_block_list')
    blockedCache = new Set((data || []).map(r => (typeof r === 'string' ? r : r?.my_block_list)).filter(Boolean))
  } catch {
    blockedCache = new Set()
  }
  return blockedCache
}
export function forgetBlockedCache() { blockedCache = null }

// { [cookId]: [profile, ...] } for the given cooks
export async function loadTagsFor(cookIds) {
  const ids = [...new Set((cookIds || []).filter(Boolean))]
  if (ids.length === 0) return {}
  const { data: rows, error } = await supabase
    .from('cook_tags').select('cook_id, user_id, created_at')
    .in('cook_id', ids).order('created_at', { ascending: true })
  if (error || !rows || rows.length === 0) return {}
  const blocked = await blockedIds()
  const userIds = [...new Set(rows.map(r => r.user_id))].filter(id => !blocked.has(id))
  if (userIds.length === 0) return {}
  const { data: profiles } = await supabase.from('profiles').select(TAG_PROFILE_FIELDS).in('id', userIds)
  const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const map = {}
  for (const r of rows) {
    const p = byId[r.user_id]
    if (!p) continue
    ;(map[r.cook_id] ||= []).push(p)
  }
  return map
}

// Loads tags for a list of cooks. Change `refreshKey` to load again (for example after saving).
export function useCookTags(cookIds, refreshKey = 0) {
  const [tags, setTags] = useState({})
  const key = [...new Set((cookIds || []).filter(Boolean))].sort().join(',')
  useEffect(() => {
    let alive = true
    if (!key) return
    loadTagsFor(key.split(',')).then(m => { if (alive) setTags(m) })
    return () => { alive = false }
  }, [key, refreshKey])
  return tags
}

// People you can tag: everyone you follow (approved), plus anyone in `alsoIds`
// (for example the friend who tagged you, when you Log it too).
export async function loadTaggable(myId, alsoIds = []) {
  const { data: follows } = await supabase
    .from('follows').select('following_id')
    .eq('follower_id', myId).eq('status', 'approved')
  const blocked = await blockedIds()
  const ids = [...new Set([...(alsoIds || []), ...(follows || []).map(f => f.following_id)])]
    .filter(id => id && id !== myId && !blocked.has(id))
  if (ids.length === 0) return []
  const { data: profiles } = await supabase.from('profiles').select(TAG_PROFILE_FIELDS).in('id', ids)
  return (profiles || []).sort((a, b) => displayName(a).localeCompare(displayName(b)))
}

// Saves who's tagged on one of my cooks. Only new people get a notification.
// Returns true if everything saved.
export async function saveCookTags({ cookId, recipeId, actorId, nextIds, prevIds = [] }) {
  const next = new Set(nextIds || [])
  const prev = new Set(prevIds || [])
  const toAdd = [...next].filter(id => !prev.has(id) && id !== actorId)
  const toRemove = [...prev].filter(id => !next.has(id))
  let ok = true

  if (toRemove.length > 0) {
    const { error } = await supabase.from('cook_tags').delete().eq('cook_id', cookId).in('user_id', toRemove)
    if (error) ok = false
  }

  if (toAdd.length > 0) {
    const { data: added, error } = await supabase
      .from('cook_tags')
      .insert(toAdd.map(user_id => ({ cook_id: cookId, user_id, tagged_by: actorId })))
      .select('user_id')
    if (error) ok = false
    const addedIds = (added || []).map(r => r.user_id)
    if (addedIds.length > 0) {
      await supabase.from('notifications').insert(addedIds.map(recipient_id => ({
        recipient_id, actor_id: actorId, type: 'cook_tag',
        recipe_id: recipeId, target_type: 'cook', target_id: cookId,
      })))
    }
  }
  return ok
}

export async function tagIdsForCook(cookId) {
  const { data } = await supabase.from('cook_tags').select('user_id').eq('cook_id', cookId)
  return (data || []).map(r => r.user_id)
}

// "Remove me": take yourself off someone else's cook
export async function removeMyTag(cookId, myId) {
  const { data, error } = await supabase.from('cook_tags').delete()
    .eq('cook_id', cookId).eq('user_id', myId).select('cook_id')
  if (error || !data?.length) return false
  // Tidy the notification away too (fine if this doesn't go through)
  await supabase.from('notifications').delete()
    .eq('recipient_id', myId).eq('type', 'cook_tag').eq('target_id', cookId)
  return true
}

// "Log it too": find this recipe in my Cookbook, or save a copy of it.
// Returns my recipe row, or null if it couldn't be saved.
export async function myRecipeForCook(cook, myId) {
  let recipe = cook.recipes
  if (!recipe && cook.recipe_id) {
    const { data } = await supabase.from('recipes').select('*').eq('id', cook.recipe_id).maybeSingle()
    recipe = data
  }
  if (!recipe) return null
  if (recipe.user_id === myId) return recipe

  if (recipe.canonical_id) {
    const { data: mine } = await supabase.from('recipes').select('*')
      .eq('user_id', myId).eq('canonical_id', recipe.canonical_id)
      .order('created_at', { ascending: true }).limit(1)
    if (mine?.[0]) return mine[0]
  }

  // Not in my Cookbook yet: save a copy (quietly, no "saved from your Cookbook" notification;
  // the friend hears about it when my cook tags them back)
  const { data: saved, error } = await supabase.from('recipes').insert({
    user_id: myId, title: recipe.title, source_url: recipe.source_url,
    source_name: recipe.source_name, image_url: recipe.image_url,
    cook_time: recipe.cook_time, prep_time: recipe.prep_time, difficulty: recipe.difficulty,
    ingredients: recipe.ingredients, instructions: recipe.instructions,
    tags: [], status: 'want_to_make',
    canonical_id: recipe.canonical_id || crypto.randomUUID(),
    saved_from_recipe_id: recipe.id,
  }).select().single()
  if (error) return null
  return saved
}
