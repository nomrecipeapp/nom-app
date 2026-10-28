// In-app replacements for the browser's alert() and confirm() popups,
// which look out of place inside the iOS app.
//
//   toast('Link copied!')
//   if (!(await confirmSheet({ title: 'Unfollow this cook?', confirmLabel: 'Unfollow' }))) return

import { useEffect, useState } from 'react'
import { IconCheck } from './icons'

let setToastState = null
let setSheetState = null
let toastTimer = null

export function toast(message, { icon = 'check' } = {}) {
  if (!setToastState) return
  clearTimeout(toastTimer)
  setToastState({ message, icon, visible: true, key: Date.now() })
  toastTimer = setTimeout(() => setToastState(t => t && { ...t, visible: false }), 2200)
}

export function confirmSheet({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false }) {
  return new Promise(resolve => {
    if (!setSheetState) { resolve(window.confirm(title)); return }
    setSheetState({ title, message, confirmLabel, cancelLabel, destructive, resolve, open: false })
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetState(s => s && { ...s, open: true })))
  })
}

export function UIHost() {
  const [t, setT] = useState(null)
  const [sheet, setSheet] = useState(null)

  useEffect(() => {
    setToastState = setT
    setSheetState = setSheet
    return () => { setToastState = null; setSheetState = null }
  }, [])

  function closeSheet(result) {
    if (!sheet) return
    sheet.resolve(result)
    setSheet(s => s && { ...s, open: false })
    setTimeout(() => setSheet(null), 220)
  }

  return (
    <>
      {t && (
        <div key={t.key} role="status" aria-live="polite" style={{
          position: 'fixed', left: '50%', zIndex: 2000,
          bottom: 'var(--nav-clearance)',
          transform: `translate(-50%, ${t.visible ? '0' : '12px'})`,
          opacity: t.visible ? 1 : 0,
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          animation: 'nom-toast-in 0.2s ease',
          background: 'var(--ink)', color: 'var(--cream)',
          borderRadius: 'var(--radius-pill)', padding: '10px 18px',
          fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
          display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 6px 24px rgba(28,26,23,0.25)', pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {t.icon === 'check' && <IconCheck size={14} strokeWidth={2.5} />}
          {t.message}
        </div>
      )}

      {sheet && (
        <div onClick={() => closeSheet(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1900,
          background: sheet.open ? 'rgba(28,26,23,0.4)' : 'rgba(28,26,23,0)',
          transition: 'background 0.2s ease',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{
            width: '100%', maxWidth: '480px', background: 'var(--cream)',
            borderRadius: '20px 20px 0 0',
            padding: '24px 24px calc(28px + var(--safe-bottom))',
            transform: sheet.open ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: '700', color: 'var(--ink)', marginBottom: sheet.message ? '6px' : '20px' }}>{sheet.title}</div>
            {sheet.message && <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.5', marginBottom: '20px' }}>{sheet.message}</div>}
            <button onClick={() => closeSheet(true)} style={{
              width: '100%', padding: '15px', marginBottom: '8px',
              background: sheet.destructive ? 'var(--rust)' : 'var(--clay)', color: 'var(--cream)',
              border: 'none', borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
            }}>{sheet.confirmLabel}</button>
            <button onClick={() => closeSheet(false)} style={{
              width: '100%', padding: '13px', background: 'var(--parchment)', color: 'var(--charcoal)',
              border: 'none', borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
            }}>{sheet.cancelLabel}</button>
          </div>
        </div>
      )}

      <style>{`@keyframes nom-toast-in { from { opacity: 0; transform: translate(-50%, 12px); } }`}</style>
    </>
  )
}
