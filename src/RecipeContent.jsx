// Shared pieces of a recipe page: ingredient list, instruction list (both with
// optional sections), prep/total time, and the Copy ingredients button.

import { parseRecipeLines, ingredientsForClipboard } from './recipeText'
import { toast } from './ui'

const headerStyle = {
  fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500',
  color: 'var(--ink)', marginTop: '10px',
}

export function IngredientList({ text }) {
  const lines = parseRecipeLines(text)
  return lines.map((l, i) => l.type === 'header' ? (
    <div key={i} style={{ ...headerStyle, marginTop: i === 0 ? 0 : headerStyle.marginTop }}>{l.text}</div>
  ) : (
    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--clay)', flexShrink: 0, marginTop: '8px' }} />
      <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.5' }}>{l.text.replace(/^[-*•]\s*/, '')}</span>
    </div>
  ))
}

export function InstructionList({ text }) {
  const lines = parseRecipeLines(text)
  return lines.map((l, i) => l.type === 'header' ? (
    <div key={i} style={{ ...headerStyle, marginTop: i === 0 ? 0 : headerStyle.marginTop }}>{l.text}</div>
  ) : (
    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--clay)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>{l.n}</div>
      <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.6', flex: 1 }}>{l.text}</span>
    </div>
  ))
}

export function CopyIngredientsButton({ text }) {
  async function copy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(ingredientsForClipboard(text))
      toast('Ingredients copied')
    } catch {
      toast("Couldn't copy. Try again.", { icon: null })
    }
  }
  return (
    <button onClick={copy} aria-label="Copy ingredients" style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: 'var(--parchment)', border: 'none', borderRadius: 'var(--radius-pill)',
      padding: '5px 11px', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
      color: 'var(--charcoal)', cursor: 'pointer', flexShrink: 0,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
      </svg>
      Copy
    </button>
  )
}

// Shows "Prep 15 min · Total 45 min" with a clock icon. `total` is the recipe's cook_time field.
export function RecipeTimes({ prep, total, size = 12 }) {
  if (!prep && !total) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: `${size}px`, color: 'var(--charcoal)' }}>
      <svg width={size + 1} height={size + 1} viewBox="0 0 24 24" fill="none" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
      {prep && <span><span style={{ color: 'var(--muted)' }}>Prep</span> {prep}</span>}
      {prep && total && <span style={{ color: 'var(--tan)' }}>·</span>}
      {total && <span><span style={{ color: 'var(--muted)' }}>Total</span> {total}</span>}
    </span>
  )
}
