import { useState } from 'react'
import { supabase } from './supabase'
import { IconChevronLeft } from './icons'

export default function Auth({ onBack, onSignUp }) {
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

    if (mode === 'reset') {
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

  const inputStyle = {
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
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--cream)',
      padding: '24px',
      paddingTop: 'calc(24px + var(--safe-top))',
      paddingBottom: 'calc(24px + var(--safe-bottom))'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', padding: '0 0 24px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
        )}

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '56px',
            fontWeight: '700',
            color: 'var(--clay)',
            letterSpacing: '-2px',
            lineHeight: '1'
          }}>nom</div>
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

          {/* Heading */}
          {mode !== 'reset' && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: 'var(--ink)', marginBottom: '24px' }}>Welcome back</div>
          )}

          {/* Reset mode header */}
          {mode === 'reset' && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>Reset your password</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Enter your email and we'll send you a reset link.</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '12px', fontWeight: '600',
                color: 'var(--charcoal)', marginBottom: '6px', letterSpacing: '0.04em'
              }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>

            {/* Password */}
            {mode !== 'reset' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', fontSize: '12px', fontWeight: '600',
                  color: 'var(--charcoal)', marginBottom: '6px', letterSpacing: '0.04em'
                }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
              </div>
            )}

            {/* Forgot password */}
            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(null); setMessage(null) }}
                  style={{
                    background: 'none', border: 'none', fontSize: '12px',
                    color: 'var(--clay)', fontFamily: 'var(--font-body)',
                    fontWeight: '600', cursor: 'pointer', padding: 0
                  }}
                >Forgot password?</button>
              </div>
            )}

            {error && (
              <div style={{
                background: '#FDE8E8', border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)', padding: '12px 16px',
                fontSize: '13px', color: '#B85252', marginBottom: '16px'
              }}>{error}</div>
            )}

            {message && (
              <div style={{
                background: '#EEF4E5', border: '1px solid var(--sage)',
                borderRadius: 'var(--radius-md)', padding: '12px 16px',
                fontSize: '13px', color: 'var(--forest)', marginBottom: '16px'
              }}>{message}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)', border: 'none',
                borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)',
                fontSize: '14px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s'
              }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Send reset link'}
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setMessage(null) }}
                style={{
                  width: '100%', marginTop: '12px', padding: '12px',
                  background: 'transparent', color: 'var(--muted)', border: 'none',
                  fontFamily: 'var(--font-body)', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconChevronLeft size={15} />Back to sign in</span>
              </button>
            )}

          </form>
        </div>

        {mode === 'login' && onSignUp && (
          <button type="button" onClick={onSignUp} style={{ width: '100%', marginTop: '20px', padding: '10px', background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }}>
            New to Nom? <span style={{ color: 'var(--clay)', fontWeight: '600' }}>I have an invite code</span>
          </button>
        )}
      </div>
    </div>
  )
}