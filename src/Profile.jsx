import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never' },
}

export default function Profile({ session, onBack }) {
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
      .limit(6)
    if (data) setRecentCooks(data)
  }

  async function fetchTopRated() {
    const { data } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .eq('user_id', session.user.id)
      .not('flavor', 'is', null)
      .order('flavor', { ascending: false })
      .limit(6)
    if (data) setTopRated(data)
  }

  async function fetchWantToMake() {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'want_to_make')
      .order('created_at', { ascending: false })
      .limit(6)
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
    if (error) setError(error.message)
    else setEditing(false)
    setSaving(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid var(--tan)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--cream)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    color: 'var(--ink)',
    outline: 'none'
  }

  function HorizontalRow({ items, renderItem }) {
    if (items.length === 0) return null
    return (
      <div style={{
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        padding: '0 20px 4px',
        scrollbarWidth: 'none'
      }}>
        {items.map(renderItem)}
      </div>
    )
  }

  function RecipeThumbnail({ imageUrl, title, badge, dashed }) {
    return (
      <div style={{ flexShrink: 0, width: '88px' }}>
        <div style={{
          width: '88px', height: '88px',
          borderRadius: 'var(--radius-md)',
          background: imageUrl ? 'var(--parchment)' : dashed ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
          marginBottom: '6px',
          position: 'relative',
          overflow: 'hidden',
          border: dashed ? '1.5px dashed var(--tan)' : 'none'
        }}>
          {imageUrl && !dashed && (
            <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {badge && (
            <div style={{
              position: 'absolute',
              bottom: '4px',
              left: '4px',
              background: badge.bg,
              border: badge.border ? '1px solid ' + badge.border : 'none',
              borderRadius: '100px',
              padding: '2px 6px',
              fontSize: '8px',
              fontWeight: '700',
              color: badge.color
            }}>{badge.label}</div>
          )}
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--charcoal)',
          fontWeight: '500',
          lineHeight: '1.3',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>{title}</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '13px',
            fontWeight: '600', color: 'var(--muted)', padding: 0
          }}>← Back</button>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px', fontWeight: '700',
            color: 'var(--ink)'
          }}>My Profile</div>
          <button onClick={() => setEditing(!editing)} style={{
            background: 'var(--parchment)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--charcoal)',
            cursor: 'pointer'
          }}>{editing ? 'Cancel' : 'Edit'}</button>
        </div>

        {/* Edit form */}
        {editing && (
          <div style={{
            margin: '0 20px 20px',
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '20px'
          }}>
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
              width: '100%', marginTop: '16px',
              padding: '12px',
              background: saving ? 'var(--tan)' : 'var(--clay)',
              color: 'var(--cream)', border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '13px',
              fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer'
            }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        )}

        {/* Avatar + name */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', padding: '8px 20px 20px'
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: '28px',
            fontWeight: '700', color: 'var(--cream)',
            marginBottom: '12px',
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
          {/* Following / Followers */}
          <div style={{ display: 'flex', gap: '32px', textAlign: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{following}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Following</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{followers}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Followers</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', padding: '0 20px 20px' }}>
          {[
            { value: stats.saved, label: 'Recipes\nSaved' },
            { value: stats.cooked, label: 'Recipes\nCooked' },
            { value: '—', label: 'Top\nCuisine' }
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--warm-white)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--parchment)',
              padding: '12px 8px',
              textAlign: 'center'
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: '1.4', whiteSpace: 'pre-line' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />

        {/* Recently Cooked */}
        {recentCooks.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Recently Cooked</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
              {recentCooks.map(cook => {
                const v = verdictStyles[cook.verdict]
                const recipe = cook.recipes
                if (!recipe) return null
                return (
                  <div key={cook.id} style={{ flexShrink: 0, width: '88px' }}>
                    <div style={{
                      width: '88px', height: '88px',
                      borderRadius: 'var(--radius-md)',
                      background: recipe.image_url ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
                      marginBottom: '6px', position: 'relative', overflow: 'hidden'
                    }}>
                      {recipe.image_url && <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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
          <div style={{ marginBottom: '20px' }}>
            <div style={{ padding: '0 20px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Top Rated</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
              {topRated.map(cook => {
                const recipe = cook.recipes
                if (!recipe) return null
                return (
                  <div key={cook.id} style={{ flexShrink: 0, width: '88px' }}>
                    <div style={{
                      width: '88px', height: '88px',
                      borderRadius: 'var(--radius-md)',
                      background: recipe.image_url ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
                      marginBottom: '6px', position: 'relative', overflow: 'hidden'
                    }}>
                      {recipe.image_url && <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <div style={{
                        position: 'absolute', bottom: '4px', left: '4px',
                        background: 'var(--ink)', borderRadius: '100px',
                        padding: '2px 6px', fontSize: '8px', fontWeight: '700', color: 'var(--cream)'
                      }}>{cook.flavor}/5</div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--charcoal)', fontWeight: '500', lineHeight: '1.3', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{recipe.title}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />

        {/* Want to Make */}
        {wantToMake.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ padding: '0 20px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Want to Make</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
              {wantToMake.map(recipe => (
                <div key={recipe.id} style={{ flexShrink: 0, width: '88px' }}>
                  <div style={{
                    width: '88px', height: '88px',
                    borderRadius: 'var(--radius-md)',
                    background: recipe.image_url ? 'var(--parchment)' : 'var(--parchment)',
                    marginBottom: '6px', position: 'relative', overflow: 'hidden',
                    border: '1.5px dashed var(--tan)'
                  }}>
                    {recipe.image_url && <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--charcoal)', fontWeight: '500', lineHeight: '1.3', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{recipe.title}</div>
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
            border: '1.5px solid var(--parchment)',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '13px',
            fontWeight: '600', cursor: 'pointer'
          }}>Sign Out</button>
        </div>

      </div>
    </div>
  )
}