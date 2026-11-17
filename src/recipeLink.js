// Working out when two recipes are the same one, even when the links differ a little.
//
// Links to one recipe often differ only in things that don't matter:
//   https://www.site.com/chili/?utm_source=pinterest   vs   http://site.com/chili
//   instagram.com/reel/ABC123/?igsh=xyz                 vs   instagram.com/p/ABC123
//   youtu.be/XYZ                                        vs   youtube.com/watch?v=XYZ&t=30
// recipeLinkKey() boils a link down to what does matter, so those come out equal.

// Query bits that actually pick the page (WordPress ?p=123 and the like). Everything else
// (utm_*, fbclid, igsh, ref, ...) is tracking and gets dropped.
const KEEP_PARAMS = ['p', 'page_id', 'id', 'recipe', 'recipeid', 'rid']

export function recipeLinkKey(raw) {
  if (!raw || typeof raw !== 'string') return null
  let url
  try {
    const trimmed = raw.trim()
    url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^(www\d?|m|mobile|amp)\./, '')
  let decoded = url.pathname
  try { decoded = decodeURIComponent(url.pathname) } catch { /* keep it encoded */ }
  const path = decoded.toLowerCase()
    .replace(/\/index\.html?$/, '')
    .replace(/\/amp\/?$/, '')
    .replace(/\/+$/, '')

  // NYT Cooking: the recipe number is what counts (the words after it can change or be missing)
  if (host.endsWith('nytimes.com')) {
    const m = url.pathname.match(/\/recipes\/(\d+)/)
    if (m) return `cooking.nytimes.com/recipes/${m[1]}`
  }
  // Instagram: posts, reels and tv links to the same code are the same post
  if (host.endsWith('instagram.com')) {
    const m = url.pathname.match(/\/(?:p|reels?|tv)\/([^/?#]+)/i)
    if (m) return `instagram.com/p/${m[1]}`
  }
  // TikTok: the video id is what counts, not the @name in front of it
  if (host.endsWith('tiktok.com')) {
    const m = url.pathname.match(/\/video\/(\d+)/)
    if (m) return `tiktok.com/video/${m[1]}`
  }
  // YouTube: short links, Shorts and watch links
  if (host === 'youtu.be') return `youtube.com/watch/${url.pathname.slice(1)}`
  if (host.endsWith('youtube.com')) {
    const id = url.searchParams.get('v') || url.pathname.match(/\/shorts\/([^/?#]+)/)?.[1]
    if (id) return `youtube.com/watch/${id}`
  }

  const kept = KEEP_PARAMS
    .filter(k => url.searchParams.get(k))
    .map(k => `${k}=${url.searchParams.get(k).toLowerCase()}`)
  return host + path + (kept.length ? `?${kept.join('&')}` : '')
}

export function sameRecipeLink(a, b) {
  const ka = recipeLinkKey(a)
  return !!ka && ka === recipeLinkKey(b)
}

// The most telling part of a link to search on: the last piece of the path (the recipe's
// slug), or the id for Instagram, TikTok and YouTube. Used to find candidates before
// comparing keys exactly.
function searchHint(key) {
  const tail = key.split('?')[0].split('/').filter(Boolean).pop() || key
  return tail.replace(/[%\\]/g, '')
}

// Recipes (optionally just one person's) that are the same recipe as this link.
// `select` is the columns to return; it always includes source_url.
export async function findByLink(supabase, sourceUrl, { userId, select = 'id, title, canonical_id', limit = 50 } = {}) {
  const key = recipeLinkKey(sourceUrl)
  if (!key) return []
  let q = supabase.from('recipes').select(`${select}, source_url`).ilike('source_url', `%${searchHint(key)}%`).limit(limit)
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q
  return (data || []).filter(r => recipeLinkKey(r.source_url) === key)
}

// The canonical_id this recipe should share with everyone else who has it, or a new one.
export async function canonicalIdFor(supabase, sourceUrl) {
  if (sourceUrl) {
    const matches = await findByLink(supabase, sourceUrl, { select: 'canonical_id, created_at' })
    const linked = matches.filter(r => r.canonical_id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (linked.length) return linked[0].canonical_id
  }
  return crypto.randomUUID()
}
