import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import './index.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null

  if (!session) return <Auth />

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '72px',
        fontWeight: '700',
        color: 'var(--clay)',
        letterSpacing: '-3px',
        lineHeight: '1'
      }}>
        Nom
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: '14px',
        color: 'var(--muted)',
      }}>
        Logged in as {session.user.email}
      </div>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          padding: '10px 24px',
          background: 'transparent',
          color: 'var(--clay)',
          border: '2px solid var(--clay)',
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Log out
      </button>
    </div>
  )
}