import { useState } from 'react'
import { REPORT_REASONS, submitReport, blockUser } from './moderation'

// Bottom sheets for Report + Block. Same look as the Settings sheets.
// target: { type: 'comment' | 'cook' | 'save' | 'profile', id, userId, name }

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const sheetStyle = { background: 'var(--cream)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 24px calc(32px + var(--safe-bottom))', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', boxSizing: 'border-box' }
const titleStyle = { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)', marginBottom: '8px' }
const bodyStyle = { fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.6', marginBottom: '20px' }
const primaryBtn = { width: '100%', padding: '14px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px' }
const dangerBtn = { ...primaryBtn, background: '#C05050', color: 'white' }
const quietBtn = { width: '100%', padding: '12px', background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }
const errorStyle = { background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', marginBottom: '12px' }

const typeWord = { comment: 'comment', cook: 'post', save: 'post', profile: 'profile' }

export function MoreMenuSheet({ actions, onClose }) {
  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...sheetStyle, padding: '12px 0 calc(16px + var(--safe-bottom))' }}>
        {actions.map((a, i) => (
          <button key={a.label} onClick={a.onTap} style={{
            width: '100%', padding: '16px 24px', background: 'none', border: 'none',
            borderBottom: i < actions.length - 1 ? '1px solid var(--parchment)' : 'none',
            textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '500',
            color: a.danger ? '#C05050' : 'var(--ink)', cursor: 'pointer'
          }}>{a.label}</button>
        ))}
        <button onClick={onClose} style={{ ...quietBtn, marginTop: '4px' }}>Cancel</button>
      </div>
    </div>
  )
}

// mode: 'report' starts with reasons; 'block' starts at the block confirmation.
// onClose({ reported, blocked }) tells the screen what happened so it can hide things.
export default function ModerationSheet({ mode = 'report', target, session, onClose }) {
  const [step, setStep] = useState(mode === 'block' ? 'confirmBlock' : 'reason')
  const [reason, setReason] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [reported, setReported] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const name = target.name || 'this person'
  const canBlock = target.userId && target.userId !== session.user.id
  const word = typeWord[target.type] || 'post'

  function close() { onClose({ reported, blocked }) }

  async function sendReport() {
    if (!reason) return
    setBusy(true); setError(null)
    const err = await submitReport({
      reporterId: session.user.id, targetType: target.type, targetId: target.id,
      reportedUserId: target.userId, reason, note,
    })
    setBusy(false)
    if (err) { console.error('Report failed:', err); setError("We couldn't send your report. Please try again."); return }
    setReported(true)
    setStep('reported')
  }

  async function confirmBlock() {
    setBusy(true); setError(null)
    const err = await blockUser(session.user.id, target.userId)
    setBusy(false)
    if (err) { console.error('Block failed:', err); setError(`We couldn't block ${name}. Please try again.`); return }
    setBlocked(true)
    setStep('blocked')
  }

  return (
    <div onClick={busy ? undefined : close} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={sheetStyle}>

        {step === 'reason' && (
          <>
            <div style={titleStyle}>Report this {word}</div>
            <div style={{ ...bodyStyle, marginBottom: '16px' }}>Why are you reporting it? Your report is private.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {REPORT_REASONS.map(r => {
                const selected = reason === r.key
                return (
                  <button key={r.key} onClick={() => setReason(r.key)} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '13px 14px',
                    background: selected ? 'var(--parchment)' : 'var(--warm-white)',
                    border: `1.5px solid ${selected ? 'var(--clay)' : 'var(--parchment)'}`,
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '500', color: 'var(--ink)'
                  }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${selected ? 'var(--clay)' : 'var(--tan)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                      {selected && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--clay)' }} />}
                    </span>
                    {r.label}
                  </button>
                )
              })}
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Anything else we should know? (optional)" rows={2} maxLength={500} style={{
              width: '100%', padding: '12px 14px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
              background: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)',
              outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: '14px'
            }} />
            {error && <div style={errorStyle}>{error}</div>}
            <button onClick={sendReport} disabled={!reason || busy} style={{ ...primaryBtn, background: reason ? 'var(--clay)' : 'var(--tan)', cursor: reason ? 'pointer' : 'not-allowed' }}>
              {busy ? 'Sending...' : 'Send report'}
            </button>
            <button onClick={close} disabled={busy} style={quietBtn}>Cancel</button>
          </>
        )}

        {step === 'reported' && (
          <>
            <div style={titleStyle}>Thanks for letting us know</div>
            <div style={bodyStyle}>
              We review every report within 24 hours.{target.type !== 'profile' ? ` You won't see this ${word} anymore.` : ''}
            </div>
            {canBlock && (
              <button onClick={() => { setError(null); setStep('confirmBlock') }} style={{ ...primaryBtn, background: 'transparent', color: '#C05050', border: '1.5px solid #F0C8C8' }}>
                Block {name}
              </button>
            )}
            <button onClick={close} style={primaryBtn}>Done</button>
          </>
        )}

        {step === 'confirmBlock' && (
          <>
            <div style={{ ...titleStyle, color: '#C05050' }}>Block {name}?</div>
            <div style={bodyStyle}>
              They won't be able to find your profile or request to follow you, and you'll stop seeing each other's posts and comments. They won't be told you blocked them.
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <button onClick={confirmBlock} disabled={busy} style={dangerBtn}>{busy ? 'Blocking...' : 'Block'}</button>
            <button onClick={close} disabled={busy} style={quietBtn}>Cancel</button>
          </>
        )}

        {step === 'blocked' && (
          <>
            <div style={titleStyle}>{name} is blocked</div>
            <div style={bodyStyle}>You can unblock them anytime in Settings, under Privacy.</div>
            <button onClick={close} style={primaryBtn}>Done</button>
          </>
        )}
      </div>
    </div>
  )
}
