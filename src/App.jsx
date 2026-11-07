import { useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
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
import Landing from './Landing'
import { runBackGuard, hasBackGuard } from './backGuard'

// Screens that always show a Back button, even when opened from a shared link
const DETAIL_SCREENS = ['recipe', 'socialRecipe', 'friendRecipeDetail', 'friendProfile', 'followList', 'notifications']
// Screens where swiping from the left edge should never go back (forms you could lose)
const NO_SWIPE_SCREENS = ['feed', 'add', 'resetPassword']

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  // Public homepage for every logged-out web visitor, invite links (?code=) included.
  // Sign-in and sign-up happen in the iOS app for now; the homepage only points to the App Store.
  const [showLanding, setShowLanding] = useState(() => !Capacitor.isNativePlatform())
  const [screen, setScreen] = useState('feed')
  // Add Recipe can open with "Log a cook right away" already switched on (from Profile's empty state)
  const [addStartLogging, setAddStartLogging] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [selectedCook, setSelectedCook] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [scrollToComments, setScrollToComments] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedPost, setSelectedPost] = useState(null)
  const [selectedSaveRecipe, setSelectedSaveRecipe] = useState(null)
  const [selectedSaveScrollToComments, setSelectedSaveScrollToComments] = useState(false)
  const [followListUserId, setFollowListUserId] = useState(null)
  const [followListType, setFollowListType] = useState('following')
  const [profileEditing, setProfileEditing] = useState(false)
  const [cookbookDefaultFilter, setCookbookDefaultFilter] = useState('All')
  const [feedScrollY, setFeedScrollY] = useState(0)
  const [cookbookScrollY, setCookbookScrollY] = useState(0)
  const [cookbookKey, setCookbookKey] = useState(0)
  const [prefillInviteCode, setPrefillInviteCode] = useState('')
  const [startOnWaitlist, setStartOnWaitlist] = useState(false)
  const [startOnSignup, setStartOnSignup] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [midSignup, setMidSignup] = useState(false)
  const [pendingRecipeId, setPendingRecipeId] = useState(null)
  const [pendingCookId, setPendingCookId] = useState(null)
  // Back history: each entry is a snapshot of where you were (screen + what was open).
  // Tapping a bottom tab clears it. Back (button or swipe) pops the last entry.
  const navRef = useRef([])
  const [navDepth, setNavDepth] = useState(0)
  const pendingScrollRef = useRef(null)
  const swipeRef = useRef(null)
  const settingsRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    // Style.Light = dark clock/icons, for the app's light --cream background
    // (the plugin names styles by background, not text color). setBackgroundColor is Android-only
    // in this plugin — iOS shows the page background through the overlay.
    StatusBar.setStyle({ style: Style.Light })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) setPrefillInviteCode(code.toUpperCase())
    const recipe = params.get('recipe')
    if (recipe) setPendingRecipeId(recipe)
    const cook = params.get('cook')
    if (cook) setPendingCookId(cook)
  }, [])

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
      // On log out (or account delete), forget the last person's app state
      // so the next sign-up starts fresh at onboarding
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setOnboardingComplete(false)
        setSettingsVisible(false)
        setScreen('feed')
        navRef.current = []
        setNavDepth(0)
        setShowLanding(!Capacitor.isNativePlatform())
        return
      }
      // During signup, the SIGNED_IN event fires before we finish onboarding
      // We use user_metadata to detect this — new users won't have onboarding_complete set
      if (event === 'SIGNED_IN' && !session?.user?.user_metadata?.onboarding_complete) {
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

  useEffect(() => {
    if (!session || !onboardingComplete) return
    if (!pendingRecipeId && !pendingCookId) return

    async function handlePendingShare() {
      if (pendingCookId) {
        const { data: cook } = await supabase
          .from('cooks').select('*, recipes(*), profiles(*)')
          .eq('id', pendingCookId).single()
        if (!cook) return
        setPendingCookId(null)
        window.history.replaceState({}, '', window.location.pathname)
        if (cook.user_id === session.user.id) {
          pushNav()
          setSelectedRecipe(cook.recipes)
          setScreen('recipe')
          return
        }
        const { data: follow } = await supabase.from('follows')
          .select('status').eq('follower_id', session.user.id)
          .eq('following_id', cook.user_id).eq('status', 'approved').maybeSingle()
        if (follow) {
          goToSocialRecipe(cook)
        } else {
          goToFriendProfile(cook.user_id)
        }
      } else if (pendingRecipeId) {
        const { data: recipe } = await supabase
          .from('recipes').select('*')
          .eq('id', pendingRecipeId).single()
        if (!recipe) return
        setPendingRecipeId(null)
        window.history.replaceState({}, '', window.location.pathname)
        if (recipe.user_id === session.user.id) {
          pushNav()
          setSelectedRecipe(recipe)
          setScreen('recipe')
          return
        }
        const { data: follow } = await supabase.from('follows')
          .select('status').eq('follower_id', session.user.id)
          .eq('following_id', recipe.user_id).eq('status', 'approved').maybeSingle()
        if (follow) {
          goToFriendRecipeDetail(recipe)
        } else {
          goToFriendProfile(recipe.user_id)
        }
      }
    }

    handlePendingShare()
  }, [session, onboardingComplete, pendingRecipeId, pendingCookId])

  // After Back, put the page back where you had scrolled to.
  // Screens load their data after they appear, so try again a moment later too.
  useEffect(() => {
    const y = pendingScrollRef.current
    if (y === null) return
    pendingScrollRef.current = null
    if (!y) return
    const raf = requestAnimationFrame(() => window.scrollTo(0, y))
    const t = setTimeout(() => { if (window.scrollY < y - 4) window.scrollTo(0, y) }, 350)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [screen, navDepth])

  // Swipe from the left edge to go back, like other iPhone apps.
  // The current screen follows your finger; let go past a third of the way (or flick) to go back.
  const swipeStateRef = useRef({ canSwipe: false, goBack: () => {} })
  useEffect(() => {
    swipeStateRef.current = {
      canSwipe: settingsVisible || (!NO_SWIPE_SCREENS.includes(screen) && (navDepth > 0 || DETAIL_SCREENS.includes(screen))),
      goBack,
    }
  })

  useEffect(() => {
    if (!('ontouchstart' in window)) return
    const EDGE = 24
    let start = null
    let el = null
    let dragging = false
    let last = null
    let velocity = 0

    // Touches on pop-ups and floating buttons inside a screen shouldn't start a swipe
    function onFixedLayer(target, root) {
      for (let n = target; n && n !== root; n = n.parentElement) {
        if (getComputedStyle(n).position === 'fixed') return true
      }
      return false
    }

    function reset(target) {
      if (!target) return
      target.style.transition = ''
      target.style.transform = ''
      target.style.boxShadow = ''
      target.style.willChange = ''
      document.body.style.background = ''
    }

    function onStart(e) {
      start = null
      if (e.touches.length !== 1 || !swipeStateRef.current.canSwipe || hasBackGuard()) return
      const t = e.touches[0]
      if (t.clientX > EDGE) return
      el = settingsRef.current || swipeRef.current
      if (!el || !el.contains(e.target)) return
      if (onFixedLayer(e.target, el)) return
      start = { x: t.clientX, y: t.clientY }
      last = { x: t.clientX, time: e.timeStamp }
      velocity = 0
      dragging = false
    }

    function onMove(e) {
      if (!start) return
      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (!dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > dx) { start = null; return }
        if (dx < 8) return
        dragging = true
        el.style.transition = 'none'
        el.style.willChange = 'transform'
        el.style.boxShadow = '-10px 0 24px rgba(28,26,23,0.14)'
        // A slightly darker backdrop shows behind the screen as it slides away
        document.body.style.background = 'var(--parchment)'
      }
      e.preventDefault()
      const dt = e.timeStamp - last.time
      if (dt > 0) velocity = (t.clientX - last.x) / dt
      last = { x: t.clientX, time: e.timeStamp }
      el.style.transform = `translateX(${Math.max(0, dx)}px)`
    }

    function onEnd(e) {
      if (!start) return
      const target = el
      const wasDragging = dragging
      const endX = e.changedTouches[0]?.clientX ?? start.x
      const dx = endX - start.x
      start = null
      dragging = false
      if (!wasDragging) return
      const width = window.innerWidth
      const goingBack = dx > width / 3 || (dx > 40 && velocity > 0.5)
      target.style.transition = 'transform 0.2s ease-out'
      target.style.transform = goingBack ? `translateX(${width}px)` : 'translateX(0)'
      setTimeout(() => {
        if (goingBack) {
          swipeStateRef.current.goBack()
          // Let the previous screen draw before sliding this one back into place
          setTimeout(() => reset(target), 60)
        } else {
          reset(target)
        }
      }, 200)
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [])

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
      setSettingsVisible(false)
      setMidSignup(false)
      setScreen('feed')
    }
  }

  // ── Back history ──

  function snapshot() {
    return { screen, selectedRecipe, selectedCook, selectedUserId, selectedSaveRecipe, followListUserId, followListType, scrollY: window.scrollY }
  }

  function pushNav() {
    navRef.current = [...navRef.current, snapshot()].slice(-40)
    setNavDepth(navRef.current.length)
  }

  function resetNav(entries = []) {
    navRef.current = entries
    setNavDepth(entries.length)
  }

  // Bottom tabs start a fresh history
  function goTab(tab) {
    resetNav()
    setScrollToComments(false)
    setSelectedSaveScrollToComments(false)
    setScreen(tab)
  }

  function goBack() {
    if (runBackGuard()) return
    if (settingsVisible) { setSettingsVisible(false); return }
    const stack = navRef.current
    const prev = stack[stack.length - 1]
    resetNav(stack.slice(0, -1))
    setScrollToComments(false)
    setSelectedSaveScrollToComments(false)
    if (!prev) { setScreen('feed'); return }
    if ('selectedRecipe' in prev) setSelectedRecipe(prev.selectedRecipe)
    if ('selectedCook' in prev) setSelectedCook(prev.selectedCook)
    if ('selectedUserId' in prev) setSelectedUserId(prev.selectedUserId)
    if ('selectedSaveRecipe' in prev) setSelectedSaveRecipe(prev.selectedSaveRecipe)
    if ('followListUserId' in prev) setFollowListUserId(prev.followListUserId)
    if ('followListType' in prev) setFollowListType(prev.followListType)
    pendingScrollRef.current = prev.scrollY || 0
    setScreen(prev.screen)
  }

  function goToFriendRecipeDetail(recipe, toComments = false) {
    pushNav()
    window.scrollTo(0, 0)
    setSelectedSaveRecipe(recipe)
    setSelectedSaveScrollToComments(toComments)
    setScreen('friendRecipeDetail')
  }

  function goToSocialRecipe(cook, toComments = false) {
    pushNav()
    window.scrollTo(0, 0)
    setSelectedCook(cook)
    setScrollToComments(toComments)
    setScreen('socialRecipe')
  }

  function goToFriendProfile(userId) {
    pushNav()
    window.scrollTo(0, 0)
    if (session && userId === session.user.id) {
      setScreen('profile')
      return
    }
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
      pushNav()
      window.scrollTo(0, 0)
      setSelectedRecipe(data)
      setScreen('recipe')
    }
  }

  function goToFollowList(userId, type) {
    pushNav()
    window.scrollTo(0, 0)
    setFollowListUserId(userId)
    setFollowListType(type)
    setScreen('followList')
  }

  function goToPost(item) {
    pushNav()
    setSelectedPost(item)
    setScreen('postDetail')
  }

  if (showLogin) return <Auth
    onBack={() => { setStartOnWaitlist(false); setStartOnSignup(false); setShowLogin(false) }}
    onSignUp={() => { setStartOnWaitlist(false); setStartOnSignup(true); setShowLanding(false); setShowLogin(false) }}
  />
  if (loading) return null
  if (!session && showLanding) return <Landing inviteCode={prefillInviteCode} />
  if (!session) return <Onboarding onComplete={handleOnboardingComplete} prefillInviteCode={prefillInviteCode} startOnWaitlist={startOnWaitlist} startOnSignup={startOnSignup} />
  if (!onboardingComplete) return <Onboarding session={session} onComplete={handleOnboardingComplete} prefillInviteCode={prefillInviteCode} />

  function openAdd(startLogging = false) { pushNav(); setAddStartLogging(startLogging); setScreen('add') }

  const hideNav = screen === 'add'
  const hideTopBar = screen === 'add' || screen === 'resetPassword'

  const screenTitles = {
    cookbook: 'Cookbook',
    search: 'Find',
    profile: 'My Profile',
    notifications: 'Notifications',
    friendProfile: '',
    followList: followListType === 'following' ? 'Following' : 'Followers',
  }

  return (
    <>
      {!hideTopBar && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          maxWidth: '480px', margin: '0 auto',
          height: 'var(--top-bar-h)', background: 'var(--cream)',
          borderBottom: '1px solid var(--parchment)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', paddingTop: 'var(--safe-top)', zIndex: 200,
        }}>
          <div style={{ width: '72px' }}>
            {screen === 'feed' ? (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--clay)', letterSpacing: '-0.5px' }}>nom</div>
            ) : (navDepth > 0 || DETAIL_SCREENS.includes(screen)) ? (
              <button onClick={goBack} style={{
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

          <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '600', color: 'var(--ink)', textAlign: 'center', flex: 1 }}>
            {screenTitles[screen] || ''}
          </div>

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
              <button onClick={() => { pushNav(); setScreen('notifications'); setUnreadCount(0) }} style={{
                position: 'relative', width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--warm-white)', border: '1px solid var(--parchment)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        <div ref={settingsRef} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--cream)', overflowY: 'auto' }}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            maxWidth: '480px', margin: '0 auto',
            height: 'var(--top-bar-h)', background: 'var(--cream)',
            borderBottom: '1px solid var(--parchment)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', paddingTop: 'var(--safe-top)', zIndex: 301
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

      {/* Everything below the top bar; this is what slides when you swipe back */}
      <div ref={swipeRef} style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {screen === 'notifications' && (
        <Notifications
          session={session}
          onSelectUser={goToFriendProfile}
          onSelectCook={(cook, toComments) => goToSocialRecipe(cook, toComments)}
          onSelectSaveCard={(recipe, toComments) => goToFriendRecipeDetail(recipe, toComments)}
          onClose={() => { goBack(); fetchUnreadCount(session.user.id) }}
          onMarkedRead={() => fetchUnreadCount(session.user.id)}
        />
      )}

      {screen === 'add' && (
        <AddRecipe
          session={session}
          startLogging={addStartLogging}
          onSave={(recipe, logCookNow) => {
            setCookbookKey(k => k + 1)
            setCookbookScrollY(0)
            if (logCookNow && recipe) {
              // Back from the new recipe goes to the Cookbook
              resetNav([{ screen: 'cookbook', scrollY: 0 }])
              setSelectedRecipe(recipe)
              setScreen('recipe')
            } else {
              goTab('cookbook')
            }
          }}
          onCancel={goBack}
        />
      )}

      {screen === 'profile' && (
        <Profile
          session={session}
          onBack={goBack}
          onSelectRecipe={(recipe) => { pushNav(); window.scrollTo(0, 0); setSelectedRecipe(recipe); setScreen('recipe') }}
          onSelectCook={goToSocialRecipe}
          onSelectSave={goToFriendRecipeDetail}
          onViewFollowList={(type) => goToFollowList(session.user.id, type)}
          externalEditing={profileEditing}
          onEditingDone={() => setProfileEditing(false)}
          onViewCookbook={(filter) => { setCookbookDefaultFilter(filter); setCookbookKey(k => k + 1); goTab('cookbook') }}
          onAddRecipe={() => openAdd()}
          onLogNewCook={() => openAdd(true)}
        />
      )}

      {screen === 'recipe' && selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          session={session}
          onBack={goBack}
          onSelectUser={goToFriendProfile}
          onUpdate={async () => {
            const { data } = await supabase.from('recipes').select('*').eq('id', selectedRecipe.id).single()
            if (data) setSelectedRecipe(data)
          }}
        />
      )}

      {screen === 'socialRecipe' && selectedCook && (
        <SocialRecipeDetail
          cook={selectedCook}
          session={session}
          onBack={goBack}
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
          onBack={goBack}
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
          onBack={goBack}
          onSelectCook={goToSocialRecipe}
          onSelectSave={goToFriendRecipeDetail}
          onViewFollowList={(userId, type) => goToFollowList(userId, type)}
        />
      )}

      {screen === 'followList' && followListUserId && (
        <FollowList
          userId={followListUserId}
          type={followListType}
          session={session}
          onBack={goBack}
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
          onGoToSearch={() => goTab('search')}
          onGoToCookbook={() => goTab('cookbook')}
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
            pushNav()
            window.scrollTo(0, 0)
            setSelectedRecipe(recipe)
            setScreen('recipe')
          }}
        />
      )}

      <div style={{ display: screen === 'cookbook' ? 'block' : 'none', height: '100vh', overflowY: 'auto' }} id="cookbook-scroll-container">
        <Cookbook
          key={cookbookKey}
          session={session}
          onAddRecipe={() => openAdd()}
          defaultFilter={cookbookDefaultFilter}
          visible={screen === 'cookbook'}
          onSelectRecipe={(recipe) => {
            pushNav()
            window.scrollTo(0, 0)
            setSelectedRecipe(recipe)
            setScreen('recipe')
          }}
          onSelectUser={goToFriendProfile}
          savedScrollY={cookbookScrollY}
          onScrollChange={setCookbookScrollY}
        />
      </div>

      {screen === 'resetPassword' && (
        <ResetPassword onComplete={() => goTab('feed')} />
      )}
      </div>

      {!hideNav && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--warm-white)', borderTop: '1px solid var(--parchment)',
          display: 'flex', justifyContent: 'space-evenly', alignItems: 'center',
          height: 'var(--bottom-nav-h)', padding: '12px 0 0', paddingBottom: 'var(--bottom-nav-pad)', zIndex: 100
        }}>
          <button onClick={() => goTab('feed')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0', flex: 1 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" stroke={screen === 'feed' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <rect x="13" y="3" width="8" height="8" rx="2" stroke={screen === 'feed' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <rect x="3" y="13" width="8" height="8" rx="2" stroke={screen === 'feed' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <rect x="13" y="13" width="8" height="8" rx="2" stroke={screen === 'feed' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'feed' ? 'var(--clay)' : 'var(--muted)' }}>Feed</span>
          </button>

          <button onClick={() => goTab('search')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0', flex: 1 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke={screen === 'search' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8"/>
              <path d="M16.5 16.5L21 21" stroke={screen === 'search' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'search' ? 'var(--clay)' : 'var(--muted)' }}>Find</span>
          </button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={() => openAdd()} style={{
              background: 'var(--clay)', border: 'none', cursor: 'pointer',
              width: '48px', height: '48px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '8px', boxShadow: '0 4px 12px rgba(196, 113, 58, 0.4)'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <button onClick={() => goTab('cookbook')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0', flex: 1 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 19V8a2 2 0 012-2h12a2 2 0 012 2v11" stroke={screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M4 19h16M9 11h6M9 15h4" stroke={screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '600', color: screen === 'cookbook' ? 'var(--clay)' : 'var(--muted)' }}>Cookbook</span>
          </button>

          <button onClick={() => goTab('profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0', flex: 1 }}>
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