import { useEffect, useRef } from 'react'

// Opens a cook or saved recipe straight to its comments.
// Waits until the comments have loaded (ready), then scrolls to them, and keeps them
// in view for a moment while photos and sections above finish loading and push them down.
// Stops the moment the person touches or scrolls the page themselves.
export function useScrollToComments(ref, wanted, ready) {
  const done = useRef(false)

  useEffect(() => { if (!wanted) done.current = false }, [wanted])

  useEffect(() => {
    if (!wanted || !ready || done.current || !ref.current) return
    done.current = true

    const go = behavior => ref.current?.scrollIntoView({ behavior, block: 'start' })
    let first = true
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (first) { first = false; return } // fires once on start; the smooth scroll below covers it
          go('auto')
        })
      : null

    function stop() {
      ro?.disconnect()
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('keydown', stop)
      clearTimeout(timer)
    }

    // Give the screen one frame to lay out, then go
    const raf = requestAnimationFrame(() => {
      go('smooth')
      ro?.observe(document.body)
    })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('keydown', stop)
    const timer = setTimeout(stop, 2500)

    return () => { cancelAnimationFrame(raf); stop() }
  }, [wanted, ready, ref])
}
