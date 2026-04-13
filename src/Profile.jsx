import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never' },
}

function RecipeInitial({ title, dashed }) {
  const letter = (title || '?')[0].toUpperCase()
  return (
    <div style={{
      width: '36px', height: '36px',
      borderRadius: 'var(--radius-md)',
      background: dashed ? 'transparent' : 'linear-gradient(135deg, var(--clay), var(--ember))',
      border: dashed ? '1.5px dashed var(--tan)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontFamily: 'var(--font-display)',
      fontSize: '14px', fontWeight: '700',
      color: dashed ? 'var(--tan)' : 'var(--cream)'
    }}>{letter}</div>
  )
}

function RecipeThumbnailSmall({ recipe, dashed }) {
  return (
    <div style={{
      width: '36px', height: '36px',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden', flexShrink: 0,
      border: dashed ? '1.5px dashed var(--tan)' : 'none',
      background: dashed ? 'transparent' : 'linear-gradient(135deg, var(--clay), var(--ember))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexShrink: 0
    }}>
      {recipe.image_url && (
        <img
          src={recipe.image_url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
          onError={e => e.target.style.display = 'none'}
        />
      )}
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700',
        color: dashed ? 'var(--tan)' : 'var(--cream)'
      }}>{(recipe.title || '?')[0].toUpperCase()}</span>
    </div>
  )
}

export default function Profile({ session, onBack, onSelectRecipe, onSelectCook, onSelectSave, onViewFollowList, externalEditing, onEditingDone, onViewCookbook }) {
  const [profile, setProfile] = useState({ full_name: '', username: '', avatar_url: null })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
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

  useEffect(() => {
    Promise.all([fetchProfile(), fetchStats(), fetchFollowCounts()])
      .then(() => fetchProfileLists())
  }, [])

  useEffect(() => {
    if (externalEditing) setEditing(true)
  }, [externalEditing])

  function handleCancelEdit() {
    setEditing(false)
    setError(null)
    onEditingDone?.()
  }

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single()
    if (data) setProfile(data)
  }

  async function fetchStats() {
    const [{ count: saved }, { count: cooked }] = await Promise.all([
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('status', 'cooked')
    ])
    setStats({ saved: saved || 0, cooked: cooked || 0 })
  }

  async function fetchFollowCounts() {
    const [{ count: followingCount }, { count: followersCount }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', session.user.id).eq('status', 'approved'),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', session.user.id).eq('status', 'approved')
    ])
    setFollowing(followingCount || 0)
    setFollowers(followersCount || 0)
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
      const seen = new Set()
      const deduped = cooksData.filter(c => {
        if (!c.recipes) return false
        if (seen.has(c.recipe_id)) return false
        seen.add(c.recipe_id); return true
      })
      setRecentCooks(deduped.slice(0, 5))

      // Top rated — derived from same cooksData
      const recipeMap = {}
      cooksData.forEach(cook => {
        if (!cook.recipes) return
        const id = cook.recipe_id
        if (!recipeMap[id]) recipeMap[id] = { cook, scores: [], recipe: cook.recipes }
        const scores = [cook.flavor, cook.effort, cook.would_share, cook.true_to_recipe].filter(Boolean)
        if (scores.length > 0) recipeMap[id].scores.push(...scores)
      })
      const ranked = Object.values(recipeMap)
        .map(entry => ({ ...entry.cook, recipes: entry.recipe, avgScore: entry.scores.length > 0 ? entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length : 0 }))
        .filter(e => e.avgScore > 0).sort((a, b) => b.avgScore - a.avgScore).slice(0, 5)
      setTopRated(ranked)
    }

    if (wantData) setWantToMake(wantData)
    setListsLoading(false)
  }

  async function fetchActivityFeed() {
    setActivityLoading(true)
    const { data: cooks } = await supabase
      .from('cooks').select('*, recipes(*)')
      .eq('user_id', session.user.id)
      .order('cooked_at', { ascending: false }).limit(30)

    const [{ data: saves }] = await Promise.all([
      supabase.from('recipes').select('*').eq('user_id', session.user.id)
        .eq('status', 'want_to_make').order('created_at', { ascending: false }).limit(30)
    ])

    // Merge cooks and saves into one activity feed sorted by date
    const cookItems = (cooks || []).filter(c => c.recipes).map(c => ({ ...c, profiles: profile, _type: 'cook', _date: c.cooked_at }))
    const saveItems = (saves || []).map(r => ({ ...r, _type: 'save', _date: r.created_at }))
    const merged = [...cookItems, ...saveItems].sort((a, b) => new Date(b._date) - new Date(a._date))
    setActivityFeed(merged)

    const cookIds = (cooks || []).map(c => c.id)
    const saveIds = (saves || []).map(r => r.id)

    const queries = []
    if (cookIds.length > 0) {
      queries.push(supabase.from('likes').select('target_id').eq('target_type', 'cook').in('target_id', cookIds))
      queries.push(supabase.from('comments').select('target_id').eq('target_type', 'cook').in('target_id', cookIds))
    } else {
      queries.push(Promise.resolve({ data: [] }))
      queries.push(Promise.resolve({ data: [] }))
    }
    if (saveIds.length > 0) {
      queries.push(supabase.from('likes').select('target_id').eq('target_type', 'save').in('target_id', saveIds))
      queries.push(supabase.from('comments').select('target_id').eq('target_type', 'save').in('target_id', saveIds))
    } else {
      queries.push(Promise.resolve({ data: [] }))
      queries.push(Promise.resolve({ data: [] }))
    }

    const [{ data: cookLikes }, { data: cookComments }, { data: saveLikes }, { data: saveComments }] = await Promise.all(queries)

    const eng = {}
    cookIds.forEach(id => {
      eng[`cook-${id}`] = {
        likes: cookLikes?.filter(l => l.target_id === id).length || 0,
        comments: cookComments?.filter(c => c.target_id === id).length || 0,
      }
    })
    saveIds.forEach(id => {
      eng[`save-${id}`] = {
        likes: saveLikes?.filter(l => l.target_id === id).length || 0,
        comments: saveComments?.filter(c => c.target_id === id).length || 0,
      }
    })
    setActivityEngagement(eng)
    setActivityLoading(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
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

  const sectionLabel = {
    fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px'
  }

  const listRow = {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0'
  }

  // Reusable avatar circle
  const avatarCircle = (size, fontSize) => (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }} onError={e => { e.target.style.display = 'none' }} />
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ height: '54px' }} />

        {/* Hidden avatar input */}
        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />

        {/* Edit form */}
        {editing && (
          <div style={{ margin: '0 20px 20px', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: 'var(--ink)' }}>Edit Profile</div>
              <button onClick={handleCancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--muted)', padding: 0 }}>Cancel</button>
            </div>

            {/* Avatar upload in edit form */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }} />
                ) : (
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }}>
                    {(profile.full_name || profile.username || session.user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                {/* Camera badge */}
                <button
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>Full Name</label>
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
            <button onClick={saveProfile} disabled={saving} style={{ width: '100%', marginTop: '16px', padding: '12px', background: saving ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        )}

        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 20px 20px' }}>
          {avatarCircle('72px', '28px')}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--ink)', marginBottom: '2px', marginTop: '12px' }}>
            {profile.full_name || profile.username || 'Your Name'}
          </div>
          {profile.username && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>@{profile.username}</div>
          )}
          <div style={{ display: 'flex', gap: '32px', textAlign: 'center' }}>
            <button onClick={() => onViewFollowList('following')} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{following === null ? '—' : following}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Following</div>
            </button>
            <button onClick={() => onViewFollowList('followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{followers === null ? '—' : followers}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Followers</div>
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--parchment)', borderBottom: '1px solid var(--parchment)', margin: '0 0 20px' }}>
          <button onClick={() => onViewCookbook && onViewCookbook('All')} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', borderRight: '1px solid var(--parchment)', cursor: 'pointer' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{stats === null ? '—' : stats.saved}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Saved</div>
          </button>
          <button onClick={() => onViewCookbook && onViewCookbook('Cooked')} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', borderRight: '1px solid var(--parchment)', cursor: 'pointer' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{stats === null ? '—' : stats.cooked}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Cooked</div>
          </button>
          <div style={{ flex: 1, padding: '12px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--ink)' }}>—</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Top cuisine</div>
          </div>
        </div>
        
        {/* Tabs */}
        <div style={{
          display: 'flex', margin: '0 0 20px',
          borderBottom: '2px solid var(--parchment)',
        }}>
          {['stats', 'activity'].map(tab => (
            <button key={tab} onClick={() => {
              setActiveTab(tab)
              if (tab === 'activity' && !activityLoaded) {
                setActivityLoaded(true)
                fetchActivityFeed()
              }
            }} style={{
              flex: 1, padding: '12px',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--clay)' : '2px solid transparent',
              marginBottom: '-2px',
              fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
              color: activeTab === tab ? 'var(--clay)' : 'var(--muted)',
              cursor: 'pointer', transition: 'all 0.15s'
            }}>
              {tab === 'stats' ? 'Stats' : 'Activity'}
            </button>
          ))}
        </div>

        {activeTab === 'stats' && <>
          {listsLoading ? (
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[1,2,3].map(i => (
                <div key={i}>
                  <div style={{ height: '12px', width: '80px', background: 'var(--parchment)', borderRadius: '6px', marginBottom: '16px' }} />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[1,2,3,4,5].map(j => (
                      <div key={j} style={{ width: '88px', height: '88px', borderRadius: 'var(--radius-md)', background: 'var(--parchment)', flexShrink: 0 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <>
          {/* Recently Cooked */}
          {recentCooks.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ padding: '0 20px', marginBottom: '12px' }}>
                <div style={sectionLabel}>Recently Cooked</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
                {recentCooks.map(cook => {
                  const v = verdictStyles[cook.verdict]
                  const recipe = cook.recipes
                  if (!recipe) return null
                  return (
                    <div key={cook.id} onClick={() => onSelectRecipe(recipe)} style={{ flexShrink: 0, width: '88px', cursor: 'pointer' }}>
                      <div style={{ width: '88px', height: '88px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--clay), var(--ember))', marginBottom: '6px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {recipe.image_url && (
                          <img
                            src={recipe.image_url}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                            onError={e => e.target.style.display = 'none'}
                          />
                        )}
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                        {v && (
                          <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: v.bg, border: '1px solid ' + v.border, borderRadius: '100px', padding: '2px 6px', fontSize: '8px', fontWeight: '700', color: v.color }}>{v.label}</div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--charcoal)', fontWeight: '500', lineHeight: '1.3', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{recipe.title}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />

          {/* Top Rated */}
          {topRated.length > 0 && (
            <div style={{ padding: '0 20px', marginBottom: '20px' }}>
              <div style={sectionLabel}>Top Rated</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {topRated.map(cook => {
                  const recipe = cook.recipes
                  if (!recipe) return null
                  return (
                    <div key={cook.id} onClick={() => onSelectRecipe(recipe)} style={{ ...listRow, cursor: 'pointer' }}>
                      <RecipeThumbnailSmall recipe={recipe} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                        {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{recipe.source_name}</div>}
                      </div>
                      <div style={{ background: 'var(--ink)', borderRadius: '100px', padding: '3px 8px', fontSize: '10px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{cook.avgScore.toFixed(1)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />

          {/* Want to Make */}
          {wantToMake.length > 0 && (
            <div style={{ padding: '0 20px', marginBottom: '20px' }}>
              <div style={sectionLabel}>Want to Make</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {wantToMake.map(recipe => (
                  <div key={recipe.id} onClick={() => onSelectRecipe(recipe)} style={{ ...listRow, cursor: 'pointer' }}>
                    <RecipeThumbnailSmall recipe={recipe} dashed />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                      {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{recipe.source_name}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>}
        </>}

        {activeTab === 'activity' && (
          <div style={{ padding: '0 20px' }}>
            {activityLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
            ) : activityFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '8px' }}>No cooks logged yet</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Log a cook from any recipe in your Cookbook.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activityFeed.map(item => {
                  if (item._type === 'save') {
                    return (
                      <div key={`save-${item.id}`} onClick={() => onSelectRecipe && onSelectRecipe(item)} style={{
                        background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--parchment)', overflow: 'hidden', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                        <div style={{
                          width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                          flexShrink: 0, overflow: 'hidden', position: 'relative',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {item.image_url && (
                            <img src={item.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                          )}
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--cream)' }}>{(item.title || '?')[0].toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Saved a recipe</div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          {item.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{item.source_name}</div>}
                        </div>
                        <div style={{ background: 'var(--parchment)', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--muted)', flexShrink: 0 }}>Want to Make</div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderTop: '1px solid var(--parchment)' }}>
                        {(() => { const eng = activityEngagement[`save-${item.id}`] || { likes: 0, comments: 0 }; return (<>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.likes > 0 ? `${eng.likes} ` : ''}Like</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.comments > 0 ? `${eng.comments} ` : ''}Comment</span>
                          </div>
                        </>)})()}
                      </div>
                    </div>
                  )
                }

                  const recipe = item.recipes
                  if (!recipe) return null
                  const eng = activityEngagement[`cook-${item.id}`] || { likes: 0, comments: 0 }
                  const verdictMap = {
                    would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
                    it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
                    never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
                  }
                  const v = verdictMap[item.verdict]
                  return (
                    <div key={`cook-${item.id}`} onClick={() => onSelectCook && onSelectCook(item)} style={{
                      background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--parchment)', overflow: 'hidden', cursor: 'pointer'
                    }}>
                      {(item.photo_urls?.[0] || recipe.image_url) && (
                        <img src={item.photo_urls?.[0] || recipe.image_url} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                      )}
                      <div style={{ padding: '14px 16px' }}>
                        {v && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', background: v.bg, border: '1px solid ' + v.border, borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '11px', fontWeight: '600', color: v.color, marginBottom: '6px' }}>{v.label}</div>
                        )}
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '500', color: 'var(--ink)', marginBottom: '4px' }}>{recipe.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date(item.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        {item.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.55', fontStyle: 'italic', marginTop: '8px' }}>"{item.notes}"</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderTop: '1px solid var(--parchment)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.likes > 0 ? `${eng.likes} ` : ''}Like</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.comments > 0 ? `${eng.comments} ` : ''}Comment</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Sign out */}
        <div style={{ padding: '20px' }}>
          <button onClick={() => {
            sessionStorage.removeItem('nom_onboarding_step')
            sessionStorage.removeItem('nom_onboarding_user')
            sessionStorage.removeItem('nom_onboarding_name')
            supabase.auth.signOut()
          }} style=
            {{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--parchment)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Sign Out</button>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}