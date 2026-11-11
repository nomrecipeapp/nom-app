import { useRef } from 'react'
import { IconPlus } from './icons'

// Ingredients / steps box with a "+ Add section" button under it.
// The button drops in a "Section name:" line and selects the words so you can type over them.
// Typing a line that ends in ":" yourself (like "Dressing:") still works the same way.
export default function SectionTextarea({ value, onChange, placeholder, rows, style }) {
  const ref = useRef(null)

  function addSection() {
    const el = ref.current
    const text = value || ''
    const at = el && document.activeElement === el ? el.selectionStart : text.length
    // Start the header on its own line, with a blank line before it if there's text above
    const before = text.slice(0, at)
    const after = text.slice(at)
    const lead = before.length === 0 ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const name = 'Section name'
    const insert = `${lead}${name}:\n`
    const next = before + insert + after.replace(/^\n/, '')
    onChange(next)
    const start = before.length + lead.length
    requestAnimationFrame(() => {
      if (!ref.current) return
      ref.current.focus()
      ref.current.setSelectionRange(start, start + name.length)
    })
  }

  return (
    <div>
      <textarea ref={ref} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={style} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>Or end a line with a colon, like Dressing:</span>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={addSection} style={{
          flexShrink: 0, minHeight: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--clay)'
        }}><IconPlus size={14} strokeWidth={2.2} />Add section</button>
      </div>
    </div>
  )
}
