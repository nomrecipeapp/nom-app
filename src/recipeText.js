// Helpers for reading the plain-text ingredients and instructions fields.
// A line that ends in ":" and isn't a numbered step is a section header,
// like "For the dressing:". Everything else is a normal line.

const NUMBERED = /^\s*\d+[.)]\s*/

export function isSectionHeader(line) {
  const t = line.trim()
  if (!t.endsWith(':')) return false
  if (NUMBERED.test(t)) return false
  if (/^[-*•]/.test(t)) return false
  return t.split(/\s+/).length <= 8
}

// Returns [{ type: 'header', text }, { type: 'item', text, n }]
// `n` is the step number, which restarts at 1 after each header.
export function parseRecipeLines(text) {
  const out = []
  let n = 0
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (isSectionHeader(line)) {
      out.push({ type: 'header', text: line.slice(0, -1).trim() })
      n = 0
    } else {
      n += 1
      out.push({ type: 'item', text: line.replace(NUMBERED, ''), n })
    }
  }
  return out
}

export function hasSections(text) {
  return parseRecipeLines(text).some(l => l.type === 'header')
}

// Clean text for pasting into Notes or Reminders: one ingredient per line,
// with a blank line and the section name before each section.
export function ingredientsForClipboard(text) {
  const lines = []
  for (const l of parseRecipeLines(text)) {
    if (l.type === 'header') {
      if (lines.length) lines.push('')
      lines.push(`${l.text}:`)
    } else {
      lines.push(l.text.replace(/^[-*•]\s*/, ''))
    }
  }
  return lines.join('\n')
}
