import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Onboarding from './Onboarding'
import Profile from './Profile'
import Cookbook from './Cookbook'
import AddRecipe from './AddRecipe'
import RecipeDetail from './RecipeDetail'
import SocialRecipeDetail from './SocialRecipeDetail'
import Feed from './Feed'
import Search from './Search'
import FriendProfile from './FriendProfile'
import './index.css'
import ResetPassword from './ResetPassword'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboardingComplete, setOnboardingComplete] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [screen, setScreen] = useState('feed')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [selectedCook, setSelectedCook] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [prevScreen, setPrevScreen] = useState('feed')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkOnboarding(session.user.id)
      else setLoading(false)
    })

const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    setScreen('resetPassword')
    setSession(session)
    setLoading(false)
    return
  }
  setSession(session)
  if (session) checkOnboarding(session.user.id)
})

    return () => subscription.unsubscribe()
  }, [])

async function checkOnboarding(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', userId)
        .single()
      setOnboardingComplete(data?.onboarding_complete === true)
    } catch (e) {
      setOnboardingComplete(false)
    }
    setLoading(false)
  }

  function handleOnboardingComplete(action) {
    if (action === 'login') {
      setShowLogin(true)
    } else {
      setOnboardingComplete(true)
      setScreen('cookbook')
    }
  }

  function goToFriendProfile(userId) {
    setPrevScreen(screen)
    setSelectedUserId(userId)
    setScreen('friendProfile')
  }

  function goToSocialRecipe(cook) {
    setPrevScreen(screen)
    setSelectedCook(cook)
    setScreen('socialRecipe')
  }

  if (loading) return null

  // Not logged in — show onboarding or login
  if (!session) {
    if (showLogin) return <Auth />
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  // Logged in but onboarding not complete
  if (!onboardingComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  const hideNav = screen === 'add'

  return (
    <>
      {screen === 'add' && (
        <AddRecipe
          session={session}
          onSave={() => setScreen('cookbook')}
          onCancel={() => setScreen('cookbook')}
        />
      )}

{screen === 'profile' && (
        <Profile
          session={session}
          onBack={() => setScreen('feed')}
          onSelectRecipe={(recipe) => { setSelectedRecipe(recipe); setScreen('recipe') }}
        />
      )}

      {screen === 'recipe' && selectedRecipe && (
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
      )}

      {screen === 'socialRecipe' && selectedCook && (
        <SocialRecipeDetail
          cook={selectedCook}
          session={session}
          onBack={() => setScreen(prevScreen)}
          onSelectUser={goToFriendProfile}
        />
      )}

      {screen === 'friendProfile' && selectedUserId && (
        <FriendProfile
          userId={selectedUserId}
          session={session}
          onBack={() => setScreen(prevScreen)}
          onSelectCook={goToSocialRecipe}
        />
      )}

      {screen === 'feed' && (
        <Feed
          session={session}
          onSelectCook={goToSocialRecipe}
          onSelectUser={goToFriendProfile}
        />
      )}

      {screen === 'search' && (
        <Search
          session={session}
          onSelectUser={goToFriendProfile}
        />
      )}

      {screen === 'cookbook' && (
        <Cookbook
          session={session}
          onAddRecipe={() => setScreen('add')}
          onSelectRecipe={(recipe) => {
            setSelectedRecipe(recipe)
            setScreen('recipe')
          }}
        />
      )}

      {screen === 'resetPassword' && (
      <ResetPassword
         onComplete={() => {
           setScreen('feed')
          }}
        />
      )}

      {/* Bottom Nav */}
      {!hideNav && (
        <div style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: 'var(--warm-white)',
          borderTop: '1px solid var(--parchment)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '12px 0 20px',
          zIndex: 100
        }}>
          <button onClick={() => setScreen('feed')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 16px'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" stroke={screen === 'feed' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <rect x="13" y="3" width="8" height="8" rx="2" stroke={screen === 'feed' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <rect x="3" y="13" width="8" height="8" rx="2" stroke={screen === 'feed' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <rect x="13" y="13" width="8" height="8" rx="2" stroke={screen === 'feed' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'feed' ? 'var(--clay)' : 'var(--muted)' }}>Feed</span>
          </button>

          <button onClick={() => setScreen('search')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 16px'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke={screen === 'search' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <path d="M16.5 16.5L21 21" stroke={screen === 'search' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'search' ? 'var(--clay)' : 'var(--muted)' }}>Find Cooks</span>
          </button>

          <button onClick={() => setScreen('add')} style={{
            background: 'var(--clay)', border: 'none', cursor: 'pointer',
            width: '48px', height: '48px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '8px',
            boxShadow: '0 4px 12px rgba(196, 113, 58, 0.4)'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>

          <button onClick={() => setScreen('cookbook')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 16px'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 19V8a2 2 0 012-2h12a2 2 0 012 2v11" stroke={screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M4 19h16M9 11h6M9 15h4" stroke={screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)' }}>Cookbook</span>
          </button>

          <button onClick={() => setScreen('profile')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 16px'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke={screen === 'profile' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={screen === 'profile' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'profile' ? 'var(--clay)' : 'var(--muted)' }}>Profile</span>
          </button>
        </div>
      )}
    </>
  )
}