// The engine behind "Bring your recipes": skip what's already in the Cookbook,
// save recipes (with photos), and bring in pasted links a few at a time.
//
// Imported recipes are saved as Want to Make with:
//   imported_from: 'paprika' | 'links'   (keeps them out of friends' Feeds)
//   needs_look:    a reason, when the recipe looks incomplete (shows in the
//                  Cookbook's Needs a look filter until the recipe is edited)
import { supabase } from './supabase'
import { apiPost } from './api'
import { recipeLinkKey, canonicalIdFor } from './recipeLink'
import { importRecipeFromUrl } from './importUrl'
import { missingStepsReason, countIngredients } from './recipeCheck'
import { shrinkImage } from './shrinkImage'

export const LINKS_PER_PASTE = 40

const titleKey = (t) => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// What's already in this person's Cookbook, for skipping duplicates
export async function loadExisting(userId) {
  const { data, error } = await supabase.from('recipes').select('title, source_url').eq('user_id', userId)
  if (error) throw error
  const links = new Set(), titles = new Set()
  for (const r of data || []) {
    const k = recipeLinkKey(r.source_url)
    if (k) links.add(k)
    if (r.title) titles.add(titleKey(r.title))
  }
  return { links, titles }
}

// File items count as duplicates when the link matches, or (no link) the title matches
export function splitDuplicates(items, existing) {
  const fresh = [], dupes = []
  const seenLinks = new Set(), seenTitles = new Set()
  for (const it of items) {
    const lk = recipeLinkKey(it.recipe.source_url)
    const tk = titleKey(it.title)
    const dupe = lk ? (existing.links.has(lk) || seenLinks.has(lk)) : (existing.titles.has(tk) || seenTitles.has(tk))
    if (dupe) dupes.push(it); else fresh.push(it)
    if (lk) seenLinks.add(lk); else seenTitles.add(tk)
  }
  return { fresh, dupes }
}

// Pull every link out of whatever was pasted (one per line, or a messy note)
export function linksFromText(text, existing) {
  const found = (text || '').match(/(https?:\/\/|www\.)[^\s<>"'(),]+/gi) || []
  const seen = new Set()
  const fresh = [], dupes = []
  for (let raw of found) {
    raw = raw.replace(/[.,;:!?)\]]+$/, '')
    const url = /^https?:/i.test(raw) ? raw : `https://${raw}`
    const key = recipeLinkKey(url)
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (existing?.links.has(key)) dupes.push(url); else fresh.push(url)
  }
  return { fresh, dupes }
}

export function siteLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.endsWith('tiktok.com')) return 'TikTok'
    if (host.endsWith('instagram.com')) return 'Instagram'
    if (host.endsWith('nytimes.com')) return 'NYT Cooking'
    return host
  } catch { return 'Other' }
}

// How many link imports are left today (same daily limit as Add)
export async function linksLeftToday() {
  const { data, error } = await supabase.rpc('import_status')
  if (error || !data) return null
  return data.remaining
}

function needsLookReason(recipe, hints) {
  if (countIngredients(recipe.ingredients) === 0) return 'no_ingredients'
  return missingStepsReason(recipe, hints)
}

async function uploadPhoto(userId, blob) {
  try {
    const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' })
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    const { error } = await supabase.storage.from('recipe-images').upload(path, await shrinkImage(file), { upsert: false })
    if (error) return null
    return supabase.storage.from('recipe-images').getPublicUrl(path).data.publicUrl
  } catch { return null }
}

// Saves one recipe. Returns { saved, needsLook } or throws.
export async function saveImported(userId, recipe, { from, photo, hints } = {}) {
  let image_url = recipe.image_url || null
  if (photo) {
    const blob = await photo().catch(() => null)
    if (blob) image_url = (await uploadPhoto(userId, blob)) || image_url
  }
  const needs_look = needsLookReason(recipe, hints || {})
  const canonical_id = await canonicalIdFor(supabase, recipe.source_url)
  const { data, error } = await supabase.from('recipes').insert({
    user_id: userId,
    title: recipe.title,
    ingredients: recipe.ingredients || null,
    instructions: recipe.instructions || null,
    prep_time: recipe.prep_time || null,
    cook_time: recipe.cook_time || null,
    difficulty: recipe.difficulty || null,
    source_name: recipe.source_name || null,
    source_url: recipe.source_url || null,
    image_url,
    notes: recipe.notes || null,
    tags: recipe.tags || [],
    status: 'want_to_make',
    canonical_id,
    imported_from: from,
    needs_look,
  }).select('id').single()
  if (error) throw error
  return { saved: data, needsLook: !!needs_look }
}

// Runs `worker` over `list`, a few at a time. Stops early if `shouldStop()` turns true.
export async function runPool(list, worker, { concurrency = 3, shouldStop = () => false } = {}) {
  let next = 0
  async function lane() {
    while (next < list.length && !shouldStop()) {
      const i = next++
      await worker(list[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, lane))
}

// Brings in one link. Returns one of:
//   { recipe, hints }       ready to save
//   { failed: 'blocked' | 'not_found' }
//   { limitReached: true }  today's links are used up
export async function fetchLink(url) {
  // 1. The site's own recipe card, read without the AI
  try {
    const res = await apiPost('/api/import-link-card', { url })
    const data = await res.json().catch(() => ({}))
    if (res.status === 429 || data.limitReached) return { limitReached: true }
    if (data.recipe) return { recipe: data.recipe, hints: { sourceSteps: data.source_steps || 0 } }
    if (data.blocked) return { failed: 'blocked' }
  } catch { /* fall through to the AI */ }

  // 2. TikTok and Instagram captions
  if (/tiktok\.com|instagram\.com/i.test(url)) {
    try {
      const res = await apiPost('/api/import-social', { url })
      const data = await res.json().catch(() => ({}))
      if (data.limitReached) return { limitReached: true }
      if (data.error || !data.title) return { failed: 'not_found' }
      return {
        recipe: {
          title: data.title, source_url: url,
          source_name: data.source_name || (url.includes('tiktok.com') ? 'TikTok' : 'Instagram'),
          image_url: data.image_url || null, cook_time: data.cook_time || '', prep_time: data.prep_time || '',
          difficulty: data.difficulty || '', ingredients: data.ingredients || '', instructions: data.instructions || '',
        },
        hints: { sourceIncomplete: !!data.incomplete },
      }
    } catch { return { failed: 'not_found' } }
  }

  // 3. Any other page: the normal AI importer
  const result = await importRecipeFromUrl(url)
  if (result.limitReached) return { limitReached: true }
  if (result.recipe) return { recipe: result.recipe, hints: result.check || {} }
  return { failed: result.blocked ? 'blocked' : 'not_found' }
}
