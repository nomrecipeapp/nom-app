import { useState, useEffect } from 'react'
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
  if (recipe.image_url) {
    return (
      <div style={{
        width: '36px', height: '36px',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden', flexShrink: 0,
        border: dashed ? '1.5px dashed var(--tan)' : 'none'
      }}>
        <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return <RecipeInitial title={recipe.title} dashed={dashed} />
}

export default function Profile({ session, onBack, onSelectRecipe, onViewFollowList, externalEditing, onEditingDone, onViewCookbook }) {
  const [profile, setProfile] = useState({ full_name: '', username: '' })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ saved: 0, cooked: 0 })
  const [following, setFollowing] = useState(0)
  const [followers, setFollowers] = useState(0)
  const [recentCooks, setRecentCooks] = useState([])
  const [topRated, setTopRated] = useState([])
  const [wantToMake, setWantToMake] = useState([])

  useEffect(() => {
    fetchProfile()
    fetchStats()
    fetchFollowCounts()
    fetchRecentCooks()
    fetchTopRated()
    fetchWantToMake()
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
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (data) setProfile(data)
  }

  async function fetchStats() {
    const { count: saved } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)

    const { count: cooked } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('status', 'cooked')

    setStats({ saved: saved || 0, cooked: cooked || 0 })
  }

  async function fetchFollowCounts() {
    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', session.user.id)
      .eq('status', 'approved')

    const { count: followersCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', session.user.id)
      .eq('status', 'approved')

    setFollowing(followingCount || 0)
    setFollowers(followersCount || 0)
  }

  async function fetchRecentCooks() {
    const { data } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .eq('user_id', session.user.id)
      .order('cooked_at', { ascending: false })
      .limit(50)

    if (!data) return

    const seen = new Set()
    const deduped = data.filter(c => {
      if (!c.recipes) return false
      if (seen.has(c.recipe_id)) return false
      seen.add(c.recipe_id)
      return true
    })

    setRecentCooks(deduped.slice(0, 5))
  }

  async function fetchTopRated() {
    const { data } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .eq('user_id', session.user.id)
      .not('flavor', 'is', null)
      .order('cooked_at', { ascending: false })
      .limit(100)

    if (!data) return

    const recipeMap = {}
    data.forEach(cook => {
      if (!cook.recipes) return
      const id = cook.recipe_id
      if (!recipeMap[id]) recipeMap[id] = { cook, scores: [], recipe: cook.recipes }
      const scores = [cook.flavor, cook.effort, cook.would_share, cook.true_to_recipe].filter(Boolean)
      if (scores.length > 0) recipeMap[id].scores.push(...scores)
    })

    const ranked = Object.values(recipeMap)
      .map(entry => ({
        ...entry.cook,
        recipes: entry.recipe,
        avgScore: entry.scores.length > 0
          ? entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length
          : 0
      }))
      .filter(e => e.avgScore > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)

    setTopRated(ranked)
  }

  async function fetchWantToMake() {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'want_to_make')
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setWantToMake(data)
  }

  async function saveProfile() {
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .upsert({
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Spacer for top bar */}
        <div style={{ height: '54px' }} />

        {/* Edit form */}
        {editing && (
          <div style={{
            margin: '0 20px 20px', background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: 'var(--ink)' }}>Edit Profile</div>
              <button onClick={handleCancelEdit} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '13px',
                fontWeight: '600', color: 'var(--muted)', padding: 0
              }}>Cancel</button>
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
            <button onClick={saveProfile} disabled={saving} style={{
              width: '100%', marginTop: '16px', padding: '12px',
              background: saving ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)',
              border: 'none', borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '13px',
              fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer'
            }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        )}

        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 20px 20px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700',
            color: 'var(--cream)', marginBottom: '12px',
            boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)'
          }}>
            {(profile.full_name || profile.username || session.user.email || '?')[0].toUpperCase()}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--ink)', marginBottom: '2px' }}>
            {profile.full_name || profile.username || 'Your Name'}
          </div>
          {profile.username && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>@{profile.username}</div>
          )}
          <div style={{ display: 'flex', gap: '32px', textAlign: 'center' }}>
            <button onClick={() => onViewFollowList('following')} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{following}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Following</div>
            </button>
            <button onClick={() => onViewFollowList('followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{followers}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Followers</div>
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{
          display: 'flex', borderTop: '1px solid var(--parchment)',
          borderBottom: '1px solid var(--parchment)', margin: '0 0 20px'
        }}>
          <button onClick={() => onViewCookbook && onViewCookbook('All')} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', borderRight: '1px solid var(--parchment)', cursor: 'pointer' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{stats.saved}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Saved</div>
          </button>
          <button onClick={() => onViewCookbook && onViewCookbook('Cooked')} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', borderRight: '1px solid var(--parchment)', cursor: 'pointer' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{stats.cooked}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Cooked</div>
          </button>
          <div style={{ flex: 1, padding: '12px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--ink)' }}>—</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Top cuisine</div>
          </div>
        </div>

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
                    <div style={{
                      width: '88px', height: '88px', borderRadius: 'var(--radius-md)',
                      background: recipe.image_url ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
                      marginBottom: '6px', position: 'relative', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {recipe.image_url
                        ? <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                      }
                      {v && (
                        <div style={{
                          position: 'absolute', bottom: '4px', left: '4px',
                          background: v.bg, border: '1px solid ' + v.border,
                          borderRadius: '100px', padding: '2px 6px',
                          fontSize: '8px', fontWeight: '700', color: v.color
                        }}>{v.label}</div>
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
                    <div style={{
                      background: 'var(--ink)', borderRadius: '100px',
                      padding: '3px 8px', fontSize: '10px',
                      fontWeight: '700', color: 'var(--cream)', flexShrink: 0
                    }}>{cook.avgScore.toFixed(1)}</div>
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

        {/* Sign out */}
        <div style={{ padding: '20px' }}>
          <button onClick={() => supabase.auth.signOut()} style={{
            width: '100%', padding: '12px',
            background: 'transparent', color: 'var(--muted)',
            border: '1.5px solid var(--parchment)', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '13px',
            fontWeight: '600', cursor: 'pointer'
          }}>Sign Out</button>
        </div>

      </div>
    </div>
  )
}