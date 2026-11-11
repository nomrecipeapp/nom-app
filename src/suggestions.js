// "People you might know": people your friends follow, ranked by how many of your friends follow them.
// Used by Feed (empty state) and Search. Results are kept for a few minutes so coming back is instant.
import { supabase } from './supabase'
import { getHiddenContent } from './moderation'

const CACHE_MS = 5 * 60 * 1000
const MAX = 10
let cache = null // { userId, at, list }

function dismissedKey(userId) { return `nom-pymk-hidden-${userId}` }

export function getDismissed(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(dismissedKey(userId)) || '[]')) } catch { return new Set() }
}

// Hide someone from suggestions on this device
export function dismissSuggestion(userId, personId) {
  try {
    const set = getDismissed(userId)
    set.add(personId)
    localStorage.setItem(dismissedKey(userId), JSON.stringify([...set]))
  } catch { /* storage unavailable: hiding just lasts until the list reloads */ }
  if (cache?.userId === userId) cache.list = cache.list.filter(p => p.id !== personId)
}

// Someone was followed or hidden: drop them from the saved list too
export function removeFromSuggestions(userId, personId) {
  if (cache?.userId === userId) cache.list = cache.list.filter(p => p.id !== personId)
}

// Saved list from the last few minutes, or null
export function cachedSuggestions(userId) {
  if (cache && cache.userId === userId && Date.now() - cache.at < CACHE_MS) return cache.list
  return null
}

// Returns [{ id, full_name, username, avatar_url, mutualCount, mutualName }]
export async function fetchSuggestions(userId) {
  // 1. Who I follow (any status), who follows me, and who I've blocked, all at once
  const [mineRes, followersRes, hidden] = await Promise.all([
    supabase.from('follows').select('following_id, status').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId).eq('status', 'approved'),
    getHiddenContent(userId),
  ])
  if (mineRes.error || followersRes.error) throw mineRes.error || followersRes.error

  const exclude = new Set((mineRes.data || []).map(f => f.following_id))
  exclude.add(userId)
  const friends = new Set([
    ...(mineRes.data || []).filter(f => f.status === 'approved').map(f => f.following_id),
    ...(followersRes.data || []).map(f => f.follower_id),
  ])
  if (friends.size === 0) { cache = { userId, at: Date.now(), list: [] }; return [] }

  // 2. Who my friends follow
  const { data: fof, error: fofError } = await supabase
    .from('follows').select('follower_id, following_id')
    .in('follower_id', [...friends]).eq('status', 'approved')
  if (fofError) throw fofError

  const dismissed = getDismissed(userId)
  const mutuals = new Map() // candidate id -> [friend ids who follow them]
  for (const row of fof || []) {
    const id = row.following_id
    if (exclude.has(id) || dismissed.has(id) || hidden.blockedIds.has(id)) continue
    if (!mutuals.has(id)) mutuals.set(id, [])
    mutuals.get(id).push(row.follower_id)
  }
  const ranked = [...mutuals.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX)
  if (ranked.length === 0) { cache = { userId, at: Date.now(), list: [] }; return [] }

  // 3. Names and photos for the suggestions, plus the first friend who follows each one
  const ids = new Set(ranked.flatMap(([id, by]) => [id, by[0]]))
  const { data: profiles, error: profError } = await supabase
    .from('profiles').select('id, full_name, username, avatar_url').in('id', [...ids])
  if (profError) throw profError
  const byId = new Map((profiles || []).map(p => [p.id, p]))

  const list = ranked
    .filter(([id]) => byId.has(id))
    .map(([id, by]) => {
      const friend = byId.get(by[0])
      return {
        ...byId.get(id),
        mutualCount: by.length,
        mutualName: friend ? (friend.full_name || friend.username || '').split(' ')[0] : null,
      }
    })
  cache = { userId, at: Date.now(), list }
  return list
}

// "Followed by Maya" / "Followed by Maya + 2 others"
export function mutualLine(person) {
  if (!person.mutualName) return person.mutualCount > 1 ? `${person.mutualCount} friends follow them` : null
  const others = person.mutualCount - 1
  if (others <= 0) return `Followed by ${person.mutualName}`
  return `Followed by ${person.mutualName} + ${others} other${others === 1 ? '' : 's'}`
}
