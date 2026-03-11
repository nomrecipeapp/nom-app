import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Profile from './Profile'
import Cookbook from './Cookbook'
import AddRecipe from './AddRecipe'
import RecipeDetail from './RecipeDetail'
import './index.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('cookbook')
  const [selectedRecipe, setSelectedRecipe] = useState(null)

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

  if (screen === 'add') return (
    <AddRecipe
      session={session}
      onSave={() => setScreen('cookbook')}
      onCancel={() => setScreen('cookbook')}
    />
  )

  if (screen === 'profile') return (
    <Profile
      session={session}
      onBack={() => setScreen('cookbook')}
    />
  )

  if (screen === 'recipe' && selectedRecipe) return (
    <RecipeDetail
      recipe={selectedRecipe}
      session={session}
      onBack={() => setScreen('cookbook')}
      onUpdate={async () => {
        const { data } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', selectedRecipe.id)
          .single()
        if (data) setSelectedRecipe(data)
        setScreen('recipe')
      }}
    />
  )

  return (
    <>
      <Cookbook
        session={session}
        onAddRecipe={() => setScreen('add')}
        onSelectRecipe={(recipe) => {
          setSelectedRecipe(recipe)
          setScreen('recipe')
        }}
      />

      {/* Bottom nav */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--warm-white)',
        borderTop: '1px solid var(--parchment)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 0 20px',
        zIndex: 100
      }}>
        <button onClick={() => setScreen('cookbook')} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 20px'
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 19V8a2 2 0 012-2h12a2 2 0 012 2v11" stroke={screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M4 19h16M9 11h6M9 15h4" stroke={screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)' }}>Cookbook</span>
        </button>

        <button onClick={() => setScreen('profile')} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 20px'
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke={screen === 'profile' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={screen === 'profile' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'profile' ? 'var(--clay)' : 'var(--muted)' }}>Profile</span>
        </button>
      </div>
    </>
  )
}