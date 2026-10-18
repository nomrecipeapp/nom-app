// One place for recipe tags, so the Cookbook filter, Add recipe and Edit recipe
// all agree. Tags are matched without caring about capitals or extra spaces,
// so "dinner", "Dinner " and "DINNER" count as one tag.

export const PRESET_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Appetizer', 'Dessert', 'Baking', 'Cocktail']

// "  gluten   free " -> "Gluten Free", "#pasta" -> "Pasta". Words someone typed
// with capitals in them (like "BBQ") are left alone.
export function cleanTag(raw) {
  return (raw || '')
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export const tagKey = (t) => cleanTag(t).toLowerCase()

// Picks one spelling per tag: the preset spelling if there is one,
// otherwise the spelling used most often.
export function canonicalSpellings(allTagUses) {
  const tally = {}
  for (const raw of allTagUses) {
    const clean = cleanTag(raw)
    if (!clean) continue
    const k = clean.toLowerCase()
    tally[k] = tally[k] || {}
    tally[k][clean] = (tally[k][clean] || 0) + 1
  }
  const out = {}
  for (const [k, spellings] of Object.entries(tally)) {
    const preset = PRESET_TAGS.find(p => p.toLowerCase() === k)
    out[k] = preset || Object.entries(spellings).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
  }
  return out
}

// Presets first in their usual meal order, then everything else A to Z.
export function sortTags(tags) {
  const order = (t) => {
    const i = PRESET_TAGS.findIndex(p => p.toLowerCase() === tagKey(t))
    return i === -1 ? PRESET_TAGS.length : i
  }
  return [...tags].sort((a, b) => order(a) - order(b) || a.localeCompare(b))
}

// A recipe's tags, cleaned, without duplicates, in the standard order.
export function recipeTags(tags, spellings = {}) {
  const seen = new Set()
  const out = []
  for (const t of tags || []) {
    const k = tagKey(t)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(spellings[k] || cleanTag(t))
  }
  return sortTags(out)
}

// Tag choices for the Add and Edit forms: presets plus every tag already in
// this person's cookbook, one spelling each.
export function tagChoices(allTagUses) {
  const spellings = canonicalSpellings(allTagUses)
  const custom = Object.values(spellings).filter(t => !PRESET_TAGS.includes(t))
  return sortTags([...PRESET_TAGS, ...custom])
}

// Adds a typed tag to a list, reusing an existing spelling so we don't
// create "pasta" next to "Pasta".
export function addTag(current, typed, choices = []) {
  const k = tagKey(typed)
  if (!k) return current || []
  if ((current || []).some(t => tagKey(t) === k)) return current
  const existing = [...choices, ...(current || [])].find(t => tagKey(t) === k)
  return [...(current || []), existing || cleanTag(typed)]
}

export const hasTag = (tags, tag) => (tags || []).some(t => tagKey(t) === tagKey(tag))
