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
import Notifications from './Notifications'
import FriendRecipeDetail from './FriendRecipeDetail'
import './index.css'
import ResetPassword from './ResetPassword'
import FollowList from './FollowList'
import Settings from './Settings'

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
  const [scrollToComments, setScrollToComments] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedPost, setSelectedPost] = useState(null)
  const [selectedSaveRecipe, setSelectedSaveRecipe] = useState(null)
  const [recipeBackScreen, setRecipeBackScreen] = useState('cookbook')
  const [selectedSaveScrollToComments, setSelectedSaveScrollToComments] = useState(false)
  const [followListUserId, setFollowListUserId] = useState(null)
  const [followListType, setFollowListType] = useState('following')
  const [profileEditing, setProfileEditing] = useState(false)
  const [cookbookDefaultFilter, setCookbookDefaultFilter] = useState('All')
  const [feedScrollY, setFeedScrollY] = useState(0)
  const [cookbookScrollY, setCookbookScrollY] = useState(0)
  const [cookbookKey, setCookbookKey] = useState(0)
  const [prefillInviteCode, setPrefillInviteCode] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) setPrefillInviteCode(code.toUpperCase())
  }, [])
  const [settingsVisible, setSettingsVisible] = useState(false)

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
      if (event === 'SIGNED_IN' && !onboardingComplete) {
        // Mid-onboarding signup — set session but don't remount Onboarding
        setSession(session)
        setShowLogin(false)
        return
      }
      setSession(session)
      if (session) {
        setShowLogin(false)
        checkOnboarding(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    fetchUnreadCount(session.user.id)
    const interval = setInterval(() => fetchUnreadCount(session.user.id), 30000)
    return () => clearInterval(interval)
  }, [session])

  async function fetchUnreadCount(userId) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false)
    setUnreadCount(count || 0)
  }

  async function checkOnboarding(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', userId)
      .maybeSingle()
    setOnboardingComplete(data?.onboarding_complete === true)
    setLoading(false)
  }

  async function handleOnboardingComplete(action) {
    if (action === 'login') {
      setShowLogin(true)
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setOnboardingComplete(true)
      setScreen('feed')
    }
  }

  function goToFriendRecipeDetail(recipe, toComments = false) {
    window.scrollTo(0, 0)
    setPrevScreen(screen)
    setSelectedSaveRecipe(recipe)
    setSelectedSaveScrollToComments(toComments)
    setScreen('friendRecipeDetail')
  }

  function goToSocialRecipe(cook, toComments = false) {
    window.scrollTo(0, 0)
    setPrevScreen(screen)
    setSelectedCook(cook)
    setScrollToComments(toComments)
    setScreen('socialRecipe')
  }

  function goToFriendProfile(userId) {
    window.scrollTo(0, 0)
    if (session && userId === session.user.id) {
      setPrevScreen(screen)
      setScreen('profile')
      return
    }
    setPrevScreen(screen)
    setSelectedUserId(userId)
    setScreen('friendProfile')
  }

  async function goToRecipeFromId(recipeId) {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single()
    if (data) {
      setRecipeBackScreen(screen)
      setSelectedRecipe(data)
      setScreen('recipe')
    }
  }

  function goToFollowList(userId, type) {
  setPrevScreen(screen)
  setFollowListUserId(userId)
  setFollowListType(type)
  setScreen('followList')
  }

  function goToPost(item) {
    setPrevScreen(screen)
    setSelectedPost(item)
    setScreen('postDetail')
  }

if (showLogin) return <Auth />
  if (loading) return null
  if (!session) return <Onboarding onComplete={handleOnboardingComplete} prefillInviteCode={prefillInviteCode} />
  if (!onboardingComplete) return <Onboarding session={session} onComplete={handleOnboardingComplete} prefillInviteCode={prefillInviteCode} />

  const hideNav = screen === 'add'
  const hideTopBar = screen === 'add' || screen === 'resetPassword'

  // What the back button does per screen
  const screensWithBack = ['cookbook', 'search', 'profile', 'notifications', 'recipe', 'socialRecipe', 'friendRecipeDetail', 'friendProfile', 'followList']

  // Center title per screen
  const screenTitles = {
    cookbook: 'Cookbook',
    search: 'Find',
    profile: 'My Profile',
    notifications: 'Notifications',
    friendProfile: selectedUserId ? '' : '',
    followList: followListType === 'following' ? 'Following' : 'Followers',
  }

  return (
    <>
      {/* Top bar */}
      {!hideTopBar && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          maxWidth: '480px', margin: '0 auto',
          height: '54px',
          background: 'var(--cream)',
          borderBottom: '1px solid var(--parchment)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 200,
        }}>

          {/* Left */}
          <div style={{ width: '72px' }}>
          {screen === 'feed' ? (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--clay)', letterSpacing: '-0.5px' }}>Nom</div>
            ) : ['recipe', 'socialRecipe', 'friendRecipeDetail', 'friendProfile', 'followList', 'notifications'].includes(screen) ? (
              <button onClick={() => screen === 'recipe' ? setScreen(recipeBackScreen) : setScreen(prevScreen)} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>Back</span>
              </button>
            ) : (
              <div style={{ width: '72px' }} />
            )}
          </div>

          {/* Center */}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '600', color: 'var(--ink)', textAlign: 'center', flex: 1 }}>
            {screenTitles[screen] || ''}
          </div>

          {/* Right */}
          <div style={{ width: '72px', display: 'flex', justifyContent: 'flex-end' }}>
            {screen === 'profile' ? (
              <button onClick={() => setSettingsVisible(true)} style={{
                background: 'var(--parchment)', border: 'none', borderRadius: 'var(--radius-pill)',
                padding: '6px 12px', fontFamily: 'var(--font-body)', fontSize: '12px',
                fontWeight: '600', color: 'var(--charcoal)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="var(--charcoal)" strokeWidth="1.8"/>
                  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="var(--charcoal)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Settings
              </button>
            ) : screen === 'notifications' ? null : (
              <button onClick={() => { setPrevScreen(screen); setScreen('notifications') }} style={{
                position: 'relative',
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--warm-white)',
                border: '1px solid var(--parchment)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                    stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {unreadCount > 0 && (
                  <div style={{
                    position: 'absolute', top: '-3px', right: '-3px',
                    minWidth: '18px', height: '18px', borderRadius: '9px',
                    background: 'var(--clay)', color: 'white',
                    fontSize: '10px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', border: '2px solid var(--cream)',
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </button>
            )}
          </div>

        </div>
      )}

      {settingsVisible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--cream)', overflowY: 'auto' }}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            maxWidth: '480px', margin: '0 auto',
            height: '54px', background: 'var(--cream)',
            borderBottom: '1px solid var(--parchment)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', zIndex: 301
          }}>
            <button onClick={() => setSettingsVisible(false)} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>Profile</span>
            </button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '600', color: 'var(--ink)' }}>Settings</div>
            <div style={{ width: '72px' }} />
          </div>
          <Settings session={session} onBack={() => setSettingsVisible(false)} />
        </div>
      )}

      {screen === 'notifications' && (
        <Notifications
          session={session}
          onSelectUser={goToFriendProfile}
          onSelectCook={(cook, toComments) => goToSocialRecipe(cook, toComments)}
          onSelectSaveCard={(recipe, toComments) => goToFriendRecipeDetail(recipe, toComments)}
          onClose={() => { setScreen(prevScreen); fetchUnreadCount(session.user.id) }}
        />
      )}

      {screen === 'add' && (
        <AddRecipe
          session={session}
          onSave={(recipe, logCookNow) => {
            if (logCookNow && recipe) {
              setRecipeBackScreen('cookbook')
              setSelectedRecipe(recipe)
              setScreen('recipe')
            } else {
              setCookbookKey(k => k + 1)
              setCookbookScrollY(0)
              setScreen('cookbook')
            }
          }}
          onCancel={() => setScreen('cookbook')}
        />
      )}

      {screen === 'profile' && (
        <Profile
          session={session}
          onBack={() => setScreen(prevScreen)}
          onSelectRecipe={(recipe) => { setRecipeBackScreen('profile'); setSelectedRecipe(recipe); setScreen('recipe') }}
          onViewFollowList={(type) => goToFollowList(session.user.id, type)}
          externalEditing={profileEditing}
          onEditingDone={() => setProfileEditing(false)}
          onViewCookbook={(filter) => { setCookbookDefaultFilter(filter); setPrevScreen('profile'); setScreen('cookbook') }}
        />
      )}

      {screen === 'recipe' && selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          session={session}
          onBack={() => setScreen(recipeBackScreen)}
          onSelectUser={goToFriendProfile}
          onUpdate={async () => {
            const { data } = await supabase
              .from('recipes')
              .select('*')
              .eq('id', selectedRecipe.id)
              .single()
            if (data) setSelectedRecipe(data)
            setScreen('recipe')
            setRecipeBackScreen(recipeBackScreen)
          }}
        />
      )}

      {screen === 'socialRecipe' && selectedCook && (
        <SocialRecipeDetail
          cook={selectedCook}
          session={session}
          onBack={() => { setScreen(prevScreen); setScrollToComments(false) }}
          onSelectUser={goToFriendProfile}
          scrollToComments={scrollToComments}
          isOwner={selectedCook.user_id === session.user.id}
          onViewInCookbook={goToRecipeFromId}
        />
      )}

      {screen === 'friendRecipeDetail' && selectedSaveRecipe && (
        <FriendRecipeDetail
          recipe={selectedSaveRecipe}
          session={session}
          onBack={() => { setScreen(prevScreen); setSelectedSaveScrollToComments(false) }}
          scrollToComments={selectedSaveScrollToComments}
          isOwner={selectedSaveRecipe.user_id === session.user.id}
          onViewInCookbook={goToRecipeFromId}
          onSelectUser={goToFriendProfile}
        />
      )}

      {screen === 'friendProfile' && selectedUserId && (
        <FriendProfile
          userId={selectedUserId}
          session={session}
          onBack={() => setScreen(prevScreen)}
          onSelectCook={goToSocialRecipe}
          onViewFollowList={(userId, type) => goToFollowList(userId, type)}
        />
      )}

      {screen === 'followList' && followListUserId && (
        <FollowList
            userId={followListUserId}
            type={followListType}
            session={session}
            onBack={() => setScreen(prevScreen)}
            onSelectUser={goToFriendProfile}
        />
      )}

      <div style={{ display: screen === 'feed' ? 'block' : 'none', height: '100vh', overflowY: 'auto' }} id="feed-scroll-container">
      <Feed
        session={session}
        onSelectCook={goToSocialRecipe}
        onSelectUser={goToFriendProfile}
        onSelectPost={goToPost}
        onSelectSave={goToFriendRecipeDetail}
        onGoToSearch={() => setScreen('search')}
        onGoToCookbook={() => setScreen('cookbook')}
        savedScrollY={feedScrollY}
        onScrollChange={setFeedScrollY}
      />
    </div>

      {screen === 'search' && (
        <Search
          session={session}
          onSelectUser={goToFriendProfile}
          onSelectSave={goToFriendRecipeDetail}
          onSelectCook={goToSocialRecipe}
          onSelectRecipe={(recipe) => {
            console.log('onSelectRecipe called, recipe:', recipe.title)
            setRecipeBackScreen('search')
            setSelectedRecipe(recipe)
            setScreen('recipe')
          }}
        />
      )}

      <div style={{ display: screen === 'cookbook' ? 'block' : 'none', height: '100vh', overflowY: 'auto' }} id="cookbook-scroll-container">
        <Cookbook
          key={cookbookKey}
          session={session}
          onAddRecipe={() => setScreen('add')}
          defaultFilter={cookbookDefaultFilter}
          onSelectRecipe={(recipe) => {
            window.scrollTo(0, 0)
            setRecipeBackScreen('cookbook')
            setSelectedRecipe(recipe)
            setScreen('recipe')
          }}
          onSelectUser={goToFriendProfile}
          savedScrollY={cookbookScrollY}
          onScrollChange={setCookbookScrollY}
        />
      </div>

      {screen === 'resetPassword' && (
        <ResetPassword
          onComplete={() => { setScreen('feed') }}
        />
      )}

      {!hideNav && (
        <div style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: 'var(--warm-white)',
          borderTop: '1px solid var(--parchment)',
          display: 'flex',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          padding: '12px 0 20px',
          zIndex: 100
        }}>
          <button onClick={() => setScreen('feed')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0', flex: 1
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
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0', flex: 1
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke={screen === 'search' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <path d="M16.5 16.5L21 21" stroke={screen === 'search' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'search' ? 'var(--clay)' : 'var(--muted)' }}>Find</span>
          </button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          </div>

          <button onClick={() => setScreen('cookbook')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0', flex: 1
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 19V8a2 2 0 012-2h12a2 2 0 012 2v11" stroke={screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M4 19h16M9 11h6M9 15h4" stroke={screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)' }}>Cookbook</span>
          </button>

          <button onClick={() => setScreen('profile')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0', flex: 1
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