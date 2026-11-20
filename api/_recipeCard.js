// Turns a website's built-in recipe card (schema.org Recipe data) into a Nom
// recipe in plain code, with no AI. Used by bulk link import, so links from
// most food blogs cost nothing to bring in.
// Output follows the same format as the AI importers (see _recipeFormat.js):
// one ingredient per line, numbered steps, "Part name:" lines for step groups,
// times like "1 hr 30 min", and no em dashes.
// Files starting with "_" are not deployed as routes by Vercel.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: ', ', hellip: '...', frac12: '1/2', frac14: '1/4', frac34: '3/4', deg: '°' }

export function cleanText(s) {
  if (s == null) return ''
  return String(s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+\d*);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

// "PT1H30M" -> "1 hr 30 min". Returns '' when it can't tell.
export function isoToTime(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?/i)
  if (!m) return ''
  const total = Math.round((Number(m[1] || 0) * 24 + Number(m[2] || 0)) * 60 + Number(m[3] || 0))
  return minutesToTime(total)
}

export function minutesToTime(total) {
  if (!total || total <= 0) return ''
  const h = Math.floor(total / 60), min = total % 60
  if (!h) return `${min} min`
  return min ? `${h} hr ${min} min` : `${h} hr`
}

function isoMinutes(iso) {
  const t = isoToTime(iso)
  if (!t) return 0
  const h = Number((t.match(/(\d+) hr/) || [])[1] || 0)
  const m = Number((t.match(/(\d+) min/) || [])[1] || 0)
  return h * 60 + m
}

function stepText(item) {
  if (typeof item === 'string') return cleanText(item)
  if (item && typeof item === 'object') return cleanText(item.text || item.name || '')
  return ''
}

// Steps can be one string, a list of strings, HowToStep objects, or
// HowToSection groups ("For the sauce") that hold their own steps.
export function formatInstructions(raw) {
  if (!raw) return ''
  if (typeof raw === 'string') {
    const lines = raw.split(/\n+|(?<=\.)\s+(?=\d+[.)]\s)/).map(cleanText).filter(Boolean)
    return lines.map((l, i) => `${i + 1}. ${l.replace(/^\d+[.)]\s*/, '')}`).join('\n')
  }
  const items = Array.isArray(raw) ? raw : [raw]
  const hasSections = items.some(it => it && it['@type'] === 'HowToSection')
  const out = []
  let n = 0
  for (const it of items) {
    if (it && (it['@type'] === 'HowToSection' || it.itemListElement)) {
      const name = cleanText(it.name || '')
      const steps = [].concat(it.itemListElement || []).map(stepText).filter(Boolean)
      if (!steps.length) continue
      if (hasSections && name) out.push(`${name.replace(/:$/, '')}:`)
      n = hasSections && name ? 0 : n
      for (const s of steps) out.push(`${++n}. ${s}`)
    } else {
      const s = stepText(it)
      if (s) out.push(`${++n}. ${s}`)
    }
  }
  return out.join('\n')
}

function firstImage(img) {
  if (!img) return null
  if (typeof img === 'string') return img
  if (Array.isArray(img)) return firstImage(img[0])
  if (typeof img === 'object') return img.url || img.contentUrl || null
  return null
}

function hostName(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Returns a Nom recipe object, or null if the card isn't good enough to trust
// (then the caller falls back to the AI importer).
export function recipeFromCard(node, url, siteName = '') {
  if (!node) return null
  const title = cleanText(node.name)
  const ingredientList = [].concat(node.recipeIngredient || node.ingredients || []).map(cleanText).filter(Boolean)
  const instructions = formatInstructions(node.recipeInstructions)
  if (!title || ingredientList.length < 2 || !instructions) return null

  const prep = isoMinutes(node.prepTime)
  const cook = isoMinutes(node.cookTime)
  const total = isoMinutes(node.totalTime) || (prep + cook)
  const publisher = node.publisher && typeof node.publisher === 'object' ? cleanText(node.publisher.name) : ''

  return {
    title,
    ingredients: ingredientList.join('\n'),
    instructions,
    prep_time: minutesToTime(prep),
    cook_time: minutesToTime(total),
    difficulty: '',
    source_name: siteName || publisher || hostName(url),
    source_url: url,
    image_url: firstImage(node.image),
  }
}

// og:site_name from the page head ("Smitten Kitchen"), for a friendlier source name
export function siteNameFromHtml(html) {
  const m = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i)
  return m ? cleanText(m[1]).slice(0, 60) : ''
}
