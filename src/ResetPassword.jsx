import { useState } from 'react'
import { supabase } from './supabase'

export default function ResetPassword({ onComplete }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function handleReset() {
    setError(null)
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setSaving(false); return }
    setDone(true)
    setSaving(false)
    setTimeout(() => onComplete(), 1500)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--tan)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--cream)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    color: 'var(--ink)',
    outline: 'none',
    boxSizing: 'border-box'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--ink)',
          marginBottom: '8px'
        }}>Set new password</div>

        <div style={{
          fontSize: '14px',
          color: 'var(--muted)',
          marginBottom: '32px',
          lineHeight: '1.5'
        }}>Choose a new password for your account.</div>

        {done ? (
          <div style={{
            background: '#EEF4E5',
            border: '1px solid #7A8C6E',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            fontSize: '14px',
            color: '#4A5E42',
            fontWeight: '500'
          }}>✓ Password updated! Redirecting...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your new password"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                background: '#FDE8E8',
                border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#B85252'
              }}>{error}</div>
            )}

            <button onClick={handleReset} disabled={saving} style={{
              width: '100%',
              padding: '14px',
              background: saving ? 'var(--tan)' : 'var(--clay)',
              color: 'var(--cream)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              marginTop: '4px'
            }}>{saving ? 'Saving...' : 'Update Password'}</button>
          </div>
        )}

      </div>
    </div>
  )
}