// Shared constants and helpers for the recipe screens (see RecipeParts.jsx)

export const verdictOptions = [
  { value: 'would_make_again', label: 'Would Make Again', sub: 'A keeper', bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42' },
  { value: 'it_was_fine', label: 'It Was Fine', sub: 'No regrets, no encore', bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A' },
  { value: 'never_again', label: 'Never Again', sub: 'Duly noted', bg: '#F4E8E8', border: '#C47070', color: '#9B4040' },
]

export const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never' },
}

export const SLIDERS = [
  { key: 'flavor', label: 'Flavor', short: 'Flavor' },
  { key: 'effort', label: 'Effort vs. Reward', short: 'Effort' },
  { key: 'would_share', label: 'Would Share', short: 'Share' },
  { key: 'true_to_recipe', label: 'True to Recipe', short: 'True to Recipe' },
]

export const sectionLabelStyle = { fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }
export const roundIconBtn = { width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'var(--parchment)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
export const cardStyle = { background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }

export function shortDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }
export function scrollToRef(ref) { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
