import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (data?.user && !data?.user?.confirmed_at && data?.user?.identities?.length === 0) {
        setError('An account with this email already exists. Try logging in instead.')
      } else setMessage('Check your email to confirm your account.')
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.nomrecipeapp.com'
      })
      if (error) setError(error.message)
      else setMessage('Check your email for a password reset link.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--cream)',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
      }}>

        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '56px',
            fontWeight: '700',
            color: 'var(--clay)',
            letterSpacing: '-2px',
            lineHeight: '1'
          }}>Nom</div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--muted)',
            marginTop: '6px'
          }}>Your kitchen, your story.</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--warm-white)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--parchment)',
          padding: '32px'
        }}>

          {/* Toggle — only show on login/signup, not reset */}
          {mode !== 'reset' && (
            <div style={{
              display: 'flex',
              background: 'var(--parchment)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px',
              marginBottom: '28px'
            }}>
              {['login', 'signup'].map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); setMessage(null) }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    background: mode === m ? 'var(--clay)' : 'transparent',
                    color: mode === m ? 'var(--cream)' : 'var(--muted)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {m === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>
          )}

          {/* Reset mode header */}
          {mode === 'reset' && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--ink)',
                marginBottom: '4px'
              }}>Reset your password</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Enter your email and we'll send you a reset link.
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--charcoal)',
                marginBottom: '6px',
                letterSpacing: '0.04em'
              }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1.5px solid var(--tan)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--cream)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--ink)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Password field — hidden on reset mode */}
            {mode !== 'reset' && (
              <div style={{ marginBottom: '8px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--charcoal)',
                  marginBottom: '6px',
                  letterSpacing: '0.04em'
                }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1.5px solid var(--tan)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--cream)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--ink)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Forgot password link — only on login mode */}
            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(null); setMessage(null) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: 'var(--clay)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Spacer when no forgot password link */}
            {mode === 'signup' && <div style={{ marginBottom: '20px' }} />}

            {error && (
              <div style={{
                background: '#FDE8E8',
                border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: '13px',
                color: '#B85252',
                marginBottom: '16px'
              }}>{error}</div>
            )}

            {message && (
              <div style={{
                background: '#EEF4E5',
                border: '1px solid var(--sage)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: '13px',
                color: 'var(--forest)',
                marginBottom: '16px'
              }}>{message}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>

            {/* Back to login — only on reset mode */}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setMessage(null) }}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px',
                  background: 'transparent',
                  color: 'var(--muted)',
                  border: 'none',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ← Back to log in
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}