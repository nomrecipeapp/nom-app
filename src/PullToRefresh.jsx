// Pull down to refresh, same look and feel as the Feed.
//
//   const pull = usePullToRefresh(async () => { await reload() })
//   <div {...pull.handlers}>
//     <PullIndicator pull={pull} />
//     ...list...
//   </div>
import { useRef, useState } from 'react'
import { tap } from './haptics'

const PULL_THRESHOLD = 72

export function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(null)
  const pulling = useRef(false)

  const handlers = {
    onTouchStart(e) {
      if (window.scrollY <= 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY
        pulling.current = true
      }
    },
    onTouchMove(e) {
      if (!pulling.current || startY.current === null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) { setPullDistance(0); return }
      // Rubber-band resistance: slows down the further you pull
      setPullDistance(Math.min(delta * 0.45, PULL_THRESHOLD + 20))
    },
    async onTouchEnd() {
      if (!pulling.current) return
      pulling.current = false
      startY.current = null
      if (pullDistance >= PULL_THRESHOLD) {
        tap()
        setIsRefreshing(true)
        setPullDistance(0)
        try { await onRefresh() } finally { setIsRefreshing(false) }
      } else {
        setPullDistance(0)
      }
    },
  }

  return { pullDistance, isRefreshing, handlers }
}

export function PullIndicator({ pull, offset = '0px' }) {
  const { pullDistance, isRefreshing } = pull
  if (!(pullDistance > 0 || isRefreshing)) return null
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: isRefreshing ? '52px' : `${pullDistance}px`,
      marginTop: offset, transition: isRefreshing ? 'height 0.2s ease' : 'none',
      overflow: 'hidden',
    }}>
      <style>{'@keyframes ptr-spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: 'var(--parchment)', border: '1px solid var(--tan)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: isRefreshing ? 1 : progress,
        transform: `scale(${0.7 + progress * 0.3})`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        {isRefreshing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'ptr-spin 0.8s linear infinite' }}>
            <circle cx="12" cy="12" r="9" stroke="var(--tan)" strokeWidth="2.5" />
            <path d="M12 3a9 9 0 019 9" stroke="var(--clay)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${progress * 180}deg)`, transition: 'transform 0.15s' }}>
            <path d="M12 5v14M12 19l-5-5M12 19l5-5" stroke="var(--clay)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
