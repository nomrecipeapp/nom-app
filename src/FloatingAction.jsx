import { useEffect, useState } from 'react'
import BottomBar, { BAR_SHADOW } from './BottomBar'

// The main action on a recipe page (Log a Cook, Save to My Cookbook) sits under the title.
// Once you scroll past it, this pill floats just above the bottom bar so it's always in reach.
//
//   const anchorRef = useRef(null)
//   <button ref={anchorRef}>Log a Cook</button>
//   ...end of the page...
//   <FloatingAction anchorRef={anchorRef} label="Log a Cook" icon={IconPot} onClick={...} />
//
// tone: 'primary' (clay), 'success' (sage, for "Saved"), 'quiet' (parchment).
// Place it at the very end of the screen. It rides in the shared BottomBar, same as Cookbook Select.

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
    <BottomBar visible={visible} space={show ? 72 : 0}>
      <button
        onClick={onClick}
        disabled={disabled}
        tabIndex={visible ? 0 : -1}
        style={{
          ...tones[tone],
          width: '100%', padding: '15px 20px',
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          boxShadow: BAR_SHADOW,
          transition: 'transform 0.12s ease, opacity 0.12s ease, background 0.2s ease',
        }}
      >
        {Icon && <Icon size={18} strokeWidth={2.2} />}
        {label}
      </button>
    </BottomBar>
  )
}
