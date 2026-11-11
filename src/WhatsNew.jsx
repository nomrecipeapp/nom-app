// "What's new" sheet. Shows once per version to people who were already using
// Nom before the update. New members skip it (onboarding marks it as seen).
// Seen-state is saved on the account (auth user metadata), so it won't show
// again on another phone.
//
// To announce a new version: bump WHATS_NEW_VERSION and rewrite HIGHLIGHTS.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const WHATS_NEW_VERSION = '1.0.3'

const HIGHLIGHTS = [
  { title: 'Notifications on your phone', body: 'Know right away when friends like, comment or want to follow you.' },
  { title: 'Share to feed, or not', body: 'Log a quiet cook that only shows on your profile.' },
  { title: 'Smoother everywhere', body: 'You stay signed in, photos load faster, and taps have a little feel to them.' },
]

let whatsNewOpen = false
export function isWhatsNewOpen() { return whatsNewOpen }

export async function markWhatsNewSeen() {
  try { await supabase.auth.updateUser({ data: { whats_new_seen: WHATS_NEW_VERSION } }) } catch { /* not critical */ }
}

export default function WhatsNew({ session }) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const seen = session?.user?.user_metadata?.whats_new_seen
    if (!session || seen === WHATS_NEW_VERSION) return
    const t = setTimeout(async () => {
      // Re-read the account in case onboarding just marked it as seen
      const { data } = await supabase.auth.getSession()
      if (data?.session?.user?.user_metadata?.whats_new_seen === WHATS_NEW_VERSION) return
      setShown(true)
      whatsNewOpen = true
      requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
    }, 900)
    return () => clearTimeout(t)
  }, [session?.user?.id])

  function close() {
    setOpen(false)
    markWhatsNewSeen()
    setTimeout(() => { setShown(false); whatsNewOpen = false }, 220)
  }

  if (!shown) return null

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 1900,
      background: open ? 'rgba(28,26,23,0.4)' : 'rgba(28,26,23,0)',
      transition: 'background 0.2s ease',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="What's new in Nom" style={{
        width: '100%', maxWidth: '480px', background: 'var(--cream)',
        borderRadius: '20px 20px 0 0',
        padding: '24px 24px calc(28px + var(--safe-bottom))',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Version {WHATS_NEW_VERSION}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: 'var(--ink)', marginBottom: '18px' }}>What's new in Nom</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          {HIGHLIGHTS.map(h => (
            <div key={h.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--clay)', marginTop: '6px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>{h.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.45', marginTop: '2px' }}>{h.body}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={close} style={{
          width: '100%', padding: '15px',
          background: 'var(--clay)', color: 'var(--cream)',
          border: 'none', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        }}>Got it</button>
      </div>
    </div>
  )
}
