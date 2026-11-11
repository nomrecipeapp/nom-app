// In-app replacements for the browser's alert() and confirm() popups,
// which look out of place inside the iOS app.
//
//   toast('Link copied!')
//   if (!(await confirmSheet({ title: 'Unfollow this cook?', confirmLabel: 'Unfollow' }))) return

import { useEffect, useState } from 'react'
import { IconCheck, IconEye, IconEyeOff, IconWifiOff } from './icons'

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

// Password field with a show/hide eye. Pass the same props you'd give an <input>
// (value, onChange, autoComplete, placeholder, style...).
//   <PasswordInput value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" style={inputStyle} />
export function PasswordInput({ style, ...props }) {
  const [shown, setShown] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        style={{ ...style, paddingRight: '44px' }}
      />
      <button
        type="button"
        onClick={() => setShown(s => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
          width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--muted)',
        }}
      >
        {shown ? <IconEyeOff size={18} /> : <IconEye size={18} />}
      </button>
    </div>
  )
}

// Shown when a screen's data couldn't load (usually no connection), instead of a
// misleading empty state. Try again re-runs the load.
//   if (loadError) return <LoadError onRetry={fetchFeed} />
export function LoadError({ onRetry, title = "Couldn't load this", message = 'Check your connection and try again.', compact = false }) {
  return (
    <div role="alert" style={{ textAlign: 'center', padding: compact ? '20px 16px' : '64px 32px' }}>
      {!compact && (
        <div style={{ color: 'var(--muted)', display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <IconWifiOff size={32} strokeWidth={1.6} />
        </div>
      )}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: compact ? '15px' : '20px', fontWeight: '600', color: 'var(--ink)', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '16px' }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={{
          minHeight: '44px', padding: '0 24px', background: 'var(--clay)', color: 'var(--cream)', border: 'none',
          borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
        }}>Try again</button>
      )}
    </div>
  )
}

// Thin strip at the top of the app while the phone has no connection.
export function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div role="status" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2100,
      paddingTop: 'var(--safe-top)', background: 'var(--parchment)', color: 'var(--charcoal)', borderBottom: '1px solid var(--tan)',
      fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', textAlign: 'center',
    }}>
      <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <IconWifiOff size={14} strokeWidth={2} />You're offline. Some things won't load.
      </div>
    </div>
  )
}
