// Reading recipe files exported from other apps, right on the phone (no AI,
// no server). Each reader turns a file into a list of "items":
//   { key, title, groups: ['Dinners', ...], recipe: { ...Nom recipe fields }, photo: () => Promise<Blob|null> }
// The groups become Nom tags and the grouping on the "choose" screen.
//
// Today: Paprika. To add another app, write a reader that returns the same
// items and add it to SOURCES below.
import { unzipSync, gunzipSync, strFromU8 } from 'fflate'
import { cleanTag, PRESET_TAGS } from './tags'

// ── Shared helpers ──

// "Desserts" -> "Dessert", "Dinners" -> "Dinner" so app categories land on Nom's preset tags
const PRESET_PLURALS = Object.fromEntries(PRESET_TAGS.flatMap(t => [[t.toLowerCase(), t], [`${t.toLowerCase()}s`, t], [`${t.toLowerCase()}es`, t]]))

export function categoryToTag(raw) {
  const clean = cleanTag(raw)
  if (!clean) return null
  return PRESET_PLURALS[clean.toLowerCase()] || clean
}

// Free-form times ("10 mins", "1 hour 5 minutes", "PT20M") -> "1 hr 5 min". Unclear ones are kept as written.
export function tidyTime(raw) {
  const s = (raw || '').toString().trim()
  if (!s) return ''
  const iso = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i)
  let h = 0, m = 0
  if (iso) { h = Number(iso[1] || 0); m = Number(iso[2] || 0) } else {
    const hm = s.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/i)
    const mm = s.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/i)
    if (!hm && !mm) {
      if (/^\d+$/.test(s)) m = Number(s)
      else return s.slice(0, 30)
    }
    if (hm) h = Number(hm[1])
    if (mm) m += Number(mm[1])
  }
  const total = Math.round(h * 60 + m)
  if (!total) return ''
  const hh = Math.floor(total / 60), mi = total % 60
  if (!hh) return `${mi} min`
  return mi ? `${hh} hr ${mi} min` : `${hh} hr`
}

const isHeader = (l) => /:$/.test(l) && !/^\d+[.)]\s/.test(l) && l.length <= 60

// Paragraphs of directions -> Nom's numbered steps ("1. ..."), keeping "Part:" headers
export function numberSteps(text) {
  const lines = (text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean)
  const out = []
  let n = 0
  for (const line of lines) {
    if (isHeader(line)) { out.push(line); n = 0; continue }
    out.push(`${++n}. ${line.replace(/^(\d+[.)]|step\s*\d+[:.)]?)\s*/i, '')}`)
  }
  return out.join('\n')
}

export function tidyLines(text) {
  return (text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).join('\n')
}

const noDashes = (s) => (s || '').replace(/\s*—\s*/g, ', ')

function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

// ── Paprika (.paprikarecipes: a zip with one gzipped JSON file per recipe) ──

function readPaprikaEntry(bytes) {
  const raw = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
  return JSON.parse(strFromU8(raw))
}

export function paprikaToItem(p, i) {
  const notes = [noDashes(p.description), noDashes(p.notes)].map(s => (s || '').trim()).filter(Boolean)
  const stars = Number(p.rating) || 0
  if (stars > 0) notes.push(`Rated ${stars} out of 5 in Paprika.`)
  const groups = [...new Set((p.categories || []).map(categoryToTag).filter(Boolean))]
  const difficulty = /^(easy|medium|hard)$/i.test(p.difficulty || '') ? p.difficulty[0].toUpperCase() + p.difficulty.slice(1).toLowerCase() : ''
  const photoData = p.photo_data || p.photos?.[0]?.data || null
  return {
    key: p.uid || `paprika-${i}`,
    title: noDashes(p.name || '').trim() || 'Untitled recipe',
    groups,
    recipe: {
      title: noDashes(p.name || '').trim() || 'Untitled recipe',
      ingredients: noDashes(tidyLines(p.ingredients)),
      instructions: noDashes(numberSteps(p.directions)),
      prep_time: tidyTime(p.prep_time),
      cook_time: tidyTime(p.total_time) || tidyTime(p.cook_time),
      difficulty,
      source_name: (p.source || '').trim() || null,
      source_url: (p.source_url || '').trim() || null,
      image_url: photoData ? null : ((p.image_url || '').trim() || null),
      notes: notes.join('\n\n') || null,
      tags: groups,
    },
    photo: photoData ? async () => base64ToBlob(photoData) : null,
  }
}

export function readPaprika(buffer) {
  const files = unzipSync(new Uint8Array(buffer))
  const items = []
  Object.entries(files).forEach(([name, bytes], i) => {
    if (!/\.paprikarecipe$/i.test(name) || !bytes.length) return
    try { items.push(paprikaToItem(readPaprikaEntry(bytes), i)) } catch (e) { console.warn('Skipped a Paprika recipe', name, e.message) }
  })
  return items
}

// ── The list the import screen shows ──

export const SOURCES = [
  {
    id: 'paprika',
    name: 'Paprika',
    read: readPaprika,
    looksRight: (file) => /\.paprikarecipes$/i.test(file.name),
    howTo: ['In Paprika, open Settings and tap Export.', 'Pick Paprika Recipe Format and export all your recipes.', 'Save the file to Files, then choose it here.'],
  },
]

export async function readSourceFile(source, file) {
  const buffer = await file.arrayBuffer()
  return source.read(buffer)
}
