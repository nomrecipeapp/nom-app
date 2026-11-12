import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { IconX } from './icons'
import { addTag, tagKey } from './tags'
import { LETTERS } from './letters'

// ── A to Z letter rail ──
// Shows on the right when the Cookbook is sorted A to Z. Tap a letter or slide
// your finger along it to jump. Letters with no recipes are faded and jump to
// the closest letter that has some.

export function AlphabetRail({ available, onJump, top }) {
  const outerRef = useRef(null)
  const columnRef = useRef(null)
  const lastJump = useRef(null)
  const [active, setActive] = useState(null)
  const [lineHeight, setLineHeight] = useState(15)

  // Shrink the letters to fit when there's less room (like at the very top of the Cookbook)
  useLayoutEffect(() => {
    const h = outerRef.current?.getBoundingClientRect().height
    // Measuring the rail after it's drawn is the point here, so setting state in this effect is intended
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (h) setLineHeight(Math.max(9, Math.min(15, Math.floor(h / LETTERS.length))))
  }, [top])

  function closestAvailable(letter) {
    const i = LETTERS.indexOf(letter)
    for (let j = i; j < LETTERS.length; j++) if (available.has(LETTERS[j])) return LETTERS[j]
    for (let j = i - 1; j >= 0; j--) if (available.has(LETTERS[j])) return LETTERS[j]
    return null
  }

  function handle(clientY) {
    const rect = columnRef.current?.getBoundingClientRect()
    if (!rect) return
    const i = Math.floor(((clientY - rect.top) / rect.height) * LETTERS.length)
    const letter = LETTERS[Math.max(0, Math.min(LETTERS.length - 1, i))]
    setActive(letter)
    const target = closestAvailable(letter)
    if (target && target !== lastJump.current) {
      lastJump.current = target
      onJump(target)
    }
  }

  function end() {
    lastJump.current = null
    setActive(null)
  }

  return (
    <>
      <div
        ref={outerRef}
        onTouchStart={e => handle(e.touches[0].clientY)}
        onTouchMove={e => handle(e.touches[0].clientY)}
        onTouchEnd={end}
        onTouchCancel={end}
        onMouseDown={e => { handle(e.clientY); setTimeout(end, 300) }}
        aria-label="Jump to letter"
        style={{
          position: 'fixed', zIndex: 150,
          right: 'max(0px, calc((100vw - 480px) / 2))',
          top: top != null ? `${top}px` : 'calc(var(--top-bar-h) + 8px)', bottom: 'calc(var(--nav-clearance) + 8px)',
          width: '26px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        <div ref={columnRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxHeight: '100%' }}>
          {LETTERS.map(l => (
            <div key={l} style={{
              fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: '700',
              lineHeight: `${lineHeight}px`,
              color: available.has(l) ? 'var(--clay)' : 'var(--tan)',
              padding: '0 6px',
            }}>{l}</div>
          ))}
        </div>
      </div>
      {active && (
        <div aria-hidden="true" style={{
          position: 'fixed', zIndex: 160, left: '50%', top: '45%', transform: 'translate(-50%, -50%)',
          width: '72px', height: '72px', borderRadius: '20px',
          background: 'rgba(28,26,23,0.72)', color: 'var(--cream)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: '34px', fontWeight: '700',
          pointerEvents: 'none',
        }}>{active}</div>
      )}
    </>
  )
}

// ── Tag sheet for Select mode ──
// mode 'add': pick a tag (or type a new one) to add to every selected recipe.
// mode 'remove': pick one of the selected recipes' tags to take off all of them.

export function TagSheet({ mode, options, count, onPick, onClose }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  function close() {
    setOpen(false)
    setTimeout(onClose, 200)
  }

  function addTyped() {
    const picked = addTag([], typed, options)[0]
    if (picked) onPick(picked)
  }

  const recipesWord = count === 1 ? '1 recipe' : `${count} recipes`
  const chip = {
    padding: '8px 14px', borderRadius: 'var(--radius-pill)',
    border: '1.5px solid var(--tan)',
    background: 'var(--warm-white)', color: 'var(--charcoal)',
    fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
  }

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 1800,
      background: open ? 'rgba(28,26,23,0.4)' : 'rgba(28,26,23,0)',
      transition: 'background 0.2s ease',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        width: '100%', maxWidth: '480px', background: 'var(--cream)',
        borderRadius: '20px 20px 0 0', maxHeight: '75dvh', overflowY: 'auto',
        padding: '24px 24px calc(28px + var(--safe-bottom))',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--ink)' }}>
            {mode === 'add' ? 'Add a tag' : 'Remove a tag'}
          </div>
          <button onClick={close} aria-label="Close" style={{ background: 'var(--parchment)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--charcoal)' }}>
            <IconX size={13} strokeWidth={2.2} />
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '18px' }}>
          {mode === 'add' ? `It'll be added to ${recipesWord}.` : `It'll come off ${recipesWord}.`}
        </div>

        {mode === 'add' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTyped() }}
              placeholder="New tag, like Weeknight"
              style={{ flex: 1, padding: '11px 14px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--warm-white)', fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--ink)', outline: 'none', minWidth: 0 }}
            />
            <button onClick={addTyped} disabled={!tagKey(typed)} style={{ padding: '0 18px', background: tagKey(typed) ? 'var(--clay)' : 'var(--tan)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Add</button>
          </div>
        )}

        {options.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {options.map(tag => (
              <button key={tag} onClick={() => onPick(tag)} style={chip}>
                {mode === 'remove' && <IconX size={11} strokeWidth={2.4} />}
                {tag}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {mode === 'remove' ? "These recipes don't have any tags yet." : 'Type a tag above to add it.'}
          </div>
        )}
      </div>
    </div>
  )
}

// Filters: every tag in one sheet (the Cookbook row only fits a few).
// Tags toggle right away; "Show N recipes" just closes.
export function FilterSheet({ tags, counts, active, onToggle, onClear, resultCount, onClose }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  function close() {
    setOpen(false)
    setTimeout(onClose, 200)
  }

  const chip = (on) => ({
    minHeight: '36px', padding: '0 14px', borderRadius: 'var(--radius-pill)',
    border: `1.5px solid ${on ? 'var(--clay)' : 'var(--tan)'}`,
    background: on ? 'var(--clay)' : 'var(--warm-white)', color: on ? 'var(--cream)' : 'var(--charcoal)',
    fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
  })

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 1800,
      background: open ? 'rgba(28,26,23,0.4)' : 'rgba(28,26,23,0)',
      transition: 'background 0.2s ease',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Filter by tag" style={{
        width: '100%', maxWidth: '480px', background: 'var(--cream)',
        borderRadius: '20px 20px 0 0', maxHeight: '75dvh', overflowY: 'auto',
        padding: '24px 24px calc(20px + var(--safe-bottom))',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--ink)' }}>Filter by tag</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {active.length > 0 && (
              <button onClick={onClear} style={{ minHeight: '44px', padding: '0 6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rust)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600' }}>Clear all</button>
            )}
            <button className="nom-hit" onClick={close} aria-label="Close" style={{ background: 'var(--parchment)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--charcoal)' }}>
              <IconX size={13} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '22px' }}>
          {tags.map(tag => {
            const on = active.includes(tag)
            return (
              <button key={tag} onClick={() => onToggle(tag)} aria-pressed={on} style={chip(on)}>
                {tag}
                {counts[tag] > 0 && <span style={{ fontSize: '12px', fontWeight: '500', color: on ? 'var(--cream)' : 'var(--muted)', opacity: on ? 0.85 : 1 }}>{counts[tag]}</span>}
              </button>
            )
          })}
        </div>

        <button onClick={close} style={{
          width: '100%', minHeight: '48px', background: 'var(--clay)', color: 'var(--cream)', border: 'none',
          borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
        }}>{resultCount === 1 ? 'Show 1 recipe' : `Show ${resultCount} recipes`}</button>
      </div>
    </div>
  )
}
