import { useState, useEffect, useRef } from 'react'
import { fetchGoTos } from './cookStats'
import { supabase } from './supabase'
import EmptyState from './EmptyState'
import { IconBook, IconPot, IconPlus, IconLock, IconLockOpen } from './icons'
import { shrinkImage } from './shrinkImage'
import { unregisterPush } from './push'
import { LoadError } from './ui'
import { FollowCounts, StatsStrip, ProfileTabs, StatsSkeleton, StatsLists, ActivityList } from './ProfileParts'
import { fetchActivity, recentByRecipe } from './profileData'

export default function Profile({ session, onBack, onSelectRecipe, onSelectCook, onSelectSave, onViewFollowList, externalEditing, onEditingDone, onViewCookbook, onAddRecipe, onLogNewCook }) {
  const [profile, setProfile] = useState({ full_name: '', username: '', avatar_url: null })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [following, setFollowing] = useState(null)
  const [followers, setFollowers] = useState(null)
  const [recentCooks, setRecentCooks] = useState([])
  const [topRated, setTopRated] = useState([])
  const [wantToMake, setWantToMake] = useState([])
  const [listsLoading, setListsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('stats')
  const [activityFeed, setActivityFeed] = useState([])
  const [activityEngagement, setActivityEngagement] = useState({})
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityLoaded, setActivityLoaded] = useState(false)

  const avatarInputRef = useRef(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  useEffect(() => { loadAll() }, [])

  // If the basics can't load (usually no connection), show "Couldn't load" instead
  // of a blank "Your Name" profile with zeros and a "starts here" empty state.
  async function loadAll() {
    setLoadError(false)
    const results = await Promise.all([fetchProfile(), fetchStats(), fetchFollowCounts()])
    if (results.some(ok => ok === false)) { setLoadError(true); return }
    fetchProfileLists()
  }

  useEffect(() => {
    if (externalEditing) setEditing(true)
  }, [externalEditing])

  function handleCancelEdit() {
    setEditing(false)
    setError(null)
    onEditingDone?.()
  }

  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single()
    if (data) setProfile(data)
    const ok = !(error && error.code !== 'PGRST116')
    if (ok) setProfileLoaded(true)
    return ok
  }

  async function fetchStats() {
    const [{ count: saved, error: e1 }, { count: cooked, error: e2 }] = await Promise.all([
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('status', 'cooked')
    ])
    if (e1 || e2) return false
    setStats({ saved: saved || 0, cooked: cooked || 0 })
    return true
  }

  async function fetchFollowCounts() {
    const [{ count: followingCount, error: e1 }, { count: followersCount, error: e2 }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', session.user.id).eq('status', 'approved'),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', session.user.id).eq('status', 'approved')
    ])
    if (e1 || e2) return false
    setFollowing(followingCount || 0)
    setFollowers(followersCount || 0)
    return true
  }

  async function fetchProfileLists() {
    setListsLoading(true)
    const [{ data: cooksData }, { data: wantData }] = await Promise.all([
      supabase.from('cooks').select('*, recipes(*)').eq('user_id', session.user.id)
        .order('cooked_at', { ascending: false }).limit(20),
      supabase.from('recipes').select('*').eq('user_id', session.user.id)
        .eq('status', 'want_to_make').order('created_at', { ascending: false }).limit(5)
    ])

    // Recently cooked — deduplicated by recipe
    if (cooksData) {
      setRecentCooks(recentByRecipe(cooksData))

      // Go-tos: Would Make Again recipes, most-cooked first (counts all cooks, not just these 20)
      fetchGoTos(supabase, session.user.id).then(setTopRated)
    }

    if (wantData) setWantToMake(wantData)
    setListsLoading(false)
  }

  async function fetchActivityFeed() {
    setActivityLoading(true)
    const { items, engagement } = await fetchActivity(supabase, session.user.id, profile)
    setActivityFeed(items)
    setActivityEngagement(engagement)
    setActivityLoading(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, await shrinkImage(file, 512), { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateError } = await supabase.from('profiles')
        .update({ avatar_url: data.publicUrl }).eq('id', session.user.id)
      if (updateError) throw updateError
      setProfile(p => ({ ...p, avatar_url: data.publicUrl }))
    } catch (err) {
      console.error('Avatar upload failed:', err)
    }
    setAvatarUploading(false)
    e.target.value = ''
  }

  async function saveProfile() {
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: profile.full_name,
      username: profile.username,
      updated_at: new Date().toISOString()
    })
    if (error) {
      setError(error.message)
    } else {
      setEditing(false)
      onEditingDone?.()
    }
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
    background: 'var(--cream)', fontFamily: 'var(--font-body)',
    fontSize: '14px', color: 'var(--ink)', outline: 'none'
  }

  // Reusable avatar circle
  const avatarCircle = (size, fontSize) => (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {profile.avatar_url ? (
        <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }} onError={e => { e.target.style.display = 'none' }} />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize, fontWeight: '700',
          color: 'var(--cream)', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)'
        }}>
          {(profile.full_name || profile.username || session.user.email || '?')[0].toUpperCase()}
        </div>
      )}
    </div>
  )


  // Nothing cooked yet: what to say depends on whether the Cookbook has anything in it
  function startRecordEmpty() {
    if (stats && stats.saved === 0) {
      return {
        icon: IconBook,
        title: 'Your cooking record starts here',
        body: 'Add a recipe you love, or log something you just made.',
        primary: { label: 'Add a recipe', icon: IconPlus, onClick: () => onAddRecipe && onAddRecipe() },
        secondary: { label: 'Log a Cook', onClick: () => onLogNewCook && onLogNewCook() },
      }
    }
    const n = stats?.saved || 0
    return {
      icon: IconPot,
      title: 'Your cooking record starts here',
      body: n === 1
        ? 'Made the recipe you saved? Log a Cook to start your record. Your verdicts and top rated recipes show up here.'
        : `Made any of your ${n} recipes? Log a Cook to start your record. Your verdicts and top rated recipes show up here.`,
      primary: { label: 'Log a Cook', icon: IconPot, onClick: () => onViewCookbook && onViewCookbook('All') },
      secondary: { label: 'Add a recipe', onClick: () => onAddRecipe && onAddRecipe() },
    }
  }

  if (loadError) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingTop: 'var(--top-bar-h)' }}>
      <LoadError title="Couldn't load your profile" onRetry={loadAll} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: 'var(--nav-clearance)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ height: 'var(--top-bar-h)' }} />

        {/* Hidden avatar input */}
        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />

        {/* Edit form */}
        {editing && (
          <div style={{ margin: '0 20px 20px', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: 'var(--ink)' }}>Edit profile</div>
              <button onClick={handleCancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--muted)', padding: 0 }}>Cancel</button>
            </div>

            {/* Avatar upload in edit form */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                {profile.avatar_url ? (
                  <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }} />
                ) : (
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }}>
                    {(profile.full_name || profile.username || session.user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                {/* Camera badge */}
                <button aria-label="Change photo"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', borderRadius: '50%', background: 'var(--clay)', border: '2px solid var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {avatarUploading
                    ? <div style={{ width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2.5"/></svg>
                  }
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {avatarUploading ? 'Uploading...' : 'Tap to change photo'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>Full name</label>
                <input value={profile.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>Username</label>
                <input value={profile.username || ''} onChange={e => setProfile({ ...profile, username: e.target.value })} style={inputStyle} placeholder="e.g. alexcooks" />
              </div>
            </div>
            {error && (
              <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', marginTop: '12px' }}>{error}</div>
            )}
            <button onClick={saveProfile} disabled={saving} style={{ width: '100%', marginTop: '16px', padding: '12px', background: saving ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        )}

        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 20px 20px' }}>
          {profileLoaded ? avatarCircle('72px', '28px') : (
            // Still loading: soft placeholders instead of a default "Your Name"
            <div className="nom-skel" aria-hidden="true" style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--parchment)', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }} />
          )}
          {profileLoaded ? (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--ink)', marginBottom: '2px', marginTop: '12px' }}>
              {profile.full_name || profile.username || 'Your name'}
            </div>
          ) : (
            <div role="status" aria-label="Loading your profile" style={{ marginTop: '16px', marginBottom: '16px' }}>
              <div className="nom-skel" style={{ width: '140px', height: '18px', borderRadius: '9px', background: 'var(--parchment)', marginBottom: '8px' }} />
              <div className="nom-skel" style={{ width: '90px', height: '11px', borderRadius: '6px', background: 'var(--parchment)', margin: '0 auto' }} />
            </div>
          )}
          {(profile.username || profile.is_private !== undefined) && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {profile.username && <span>@{profile.username}</span>}
              {profile.username && profile.is_private !== undefined && <span aria-hidden="true">·</span>}
              {profile.is_private !== undefined && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  {profile.is_private === false
                    ? <><IconLockOpen size={11} strokeWidth={2.2} />Public</>
                    : <><IconLock size={11} strokeWidth={2.2} />Private</>}
                </span>
              )}
            </div>
          )}
          <FollowCounts following={following} followers={followers}
            onFollowing={() => onViewFollowList('following')} onFollowers={() => onViewFollowList('followers')} />
        </div>

        <StatsStrip saved={stats === null ? null : stats.saved} cooked={stats === null ? null : stats.cooked}
          onSaved={() => onViewCookbook && onViewCookbook('All')} onCooked={() => onViewCookbook && onViewCookbook('Cooked')} />

        <ProfileTabs tabs={[{ id: 'stats', label: 'Stats' }, { id: 'activity', label: 'Activity' }]} active={activeTab} onChange={tab => {
          setActiveTab(tab)
          if (tab === 'activity' && !activityLoaded) {
            setActivityLoaded(true)
            fetchActivityFeed()
          }
        }} />

        {activeTab === 'stats' && (listsLoading ? <StatsSkeleton /> : <>
          {recentCooks.length === 0 && stats && (
            <div style={{ padding: '0 20px', marginBottom: '24px' }}>
              <EmptyState {...startRecordEmpty()} />
            </div>
          )}
          <StatsLists
            recentCooks={recentCooks} topRated={topRated} wantToMake={wantToMake}
            onSelectRecent={cook => onSelectRecipe(cook.recipes)}
            onSelectGoTo={cook => onSelectRecipe(cook.recipes)}
            onSelectWant={recipe => onSelectRecipe(recipe)}
            onSeeAllWant={onViewCookbook ? () => onViewCookbook('Want to Make') : null}
          />
        </>)}

        {activeTab === 'activity' && (
          <div style={{ padding: '0 20px' }}>
            {activityLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
            ) : activityFeed.length === 0 ? (
              stats && <EmptyState {...startRecordEmpty()} />
            ) : (
              <ActivityList items={activityFeed} engagement={activityEngagement} onSelectCook={onSelectCook} onSelectSave={onSelectRecipe} />
            )}
          </div>
        )}

        {/* Sign out */}
        <div style={{ padding: '20px' }}>
          <button onClick={() => {
            sessionStorage.removeItem('nom_onboarding_step')
            sessionStorage.removeItem('nom_onboarding_user')
            sessionStorage.removeItem('nom_onboarding_name')
            unregisterPush().finally(() => supabase.auth.signOut())
          }} style=
            {{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--parchment)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Sign out</button>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}