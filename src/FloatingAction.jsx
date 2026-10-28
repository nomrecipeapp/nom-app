import { useEffect, useState } from 'react'

// The main action on a recipe page (Log a Cook, Save to My Cookbook) sits under the title.
// Once you scroll past it, this pill floats just above the bottom bar so it's always in reach.
//
//   const anchorRef = useRef(null)
//   <button ref={anchorRef}>Log a Cook</button>
//   ...end of the page...
//   <FloatingAction anchorRef={anchorRef} label="Log a Cook" icon={IconPot} onClick={...} />
//
// tone: 'primary' (clay), 'success' (sage, for "Saved"), 'quiet' (parchment).
// Place it at the very end of the screen: it also leaves room so the pill never covers the last lines.

export default function FloatingAction({ anchorRef, label, icon: Icon, onClick, tone = 'primary', show = true, disabled = false }) {
  const [pastAnchor, setPastAnchor] = useState(false)

  useEffect(() => {
    const el = anchorRef?.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    // Ignore the strip under the top bar, so the pill appears as the button slides under it
    const obs = new IntersectionObserver(([entry]) => {
      setPastAnchor(!entry.isIntersecting && entry.boundingClientRect.top < 80)
    }, { rootMargin: '-64px 0px 0px 0px', threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [anchorRef, show])

  const visible = show && pastAnchor

  const tones = {
    primary: { background: 'var(--clay)', color: 'var(--cream)', border: 'none' },
    success: { background: 'var(--sage)', color: 'var(--cream)', border: 'none' },
    quiet: { background: 'var(--parchment)', color: 'var(--charcoal)', border: '1.5px solid var(--tan)' },
  }

  return (
    <>
      <div aria-hidden="true" style={{ height: show ? '72px' : 0 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 'var(--nav-clearance)', zIndex: 90,
        display: 'flex', justifyContent: 'center', padding: '0 16px',
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}>
        <button
          onClick={onClick}
          disabled={disabled}
          tabIndex={visible ? 0 : -1}
          aria-hidden={!visible}
          style={{
            ...tones[tone],
            width: '100%', maxWidth: '448px', padding: '15px 20px',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 8px 24px rgba(28,26,23,0.18)',
            transition: 'transform 0.12s ease, opacity 0.12s ease, background 0.2s ease',
          }}
        >
          {Icon && <Icon size={18} strokeWidth={2.2} />}
          {label}
        </button>
      </div>
    </>
  )
}
