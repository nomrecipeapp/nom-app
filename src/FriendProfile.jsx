import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never' },
}

export default function FriendProfile({ userId, session, onBack }) {
  const [profile, setProfile] = useState(null)
  const [cooks, setCooks] = useState([])
  const [stats, setStats] = useState({ saved: 0, cooked: 0 })
  const [followStatus, setFollowStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
    fetchFollowStatus()
  }, [userId])

  useEffect(() => {
    if (followStatus === 'approved') {
      fetchCooks()
      fetchStats()
    }
  }, [followStatus])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
    setLoading(false)
  }

  async function fetchStats() {
    const { count: saved } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: cooked } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'cooked')

    setStats({ saved: saved || 0, cooked: cooked || 0 })
  }

  async function fetchCooks() {
    const { data } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .eq('user_id', userId)
      .order('cooked_at', { ascending: false })
      .limit(20)
    if (data) setCooks(data)
  }

  async function fetchFollowStatus() {
    const { data } = await supabase
      .from('follows')
      .select('status')
      .eq('follower_id', session.user.id)
      .eq('following_id', userId)
      .single()
    if (data) setFollowStatus(data.status)
    else setFollowStatus(null)
  }

  async function sendFollowRequest() {
    await supabase.from('follows').insert({
      follower_id: session.user.id,
      following_id: userId,
      status: 'pending'
    })
    setFollowStatus('pending')
  }

  async function unfollow() {
    if (!confirm('Unfollow this cook?')) return
    await supabase.from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', userId)
    setFollowStatus(null)
    setCooks([])
    setStats({ saved: 0, cooked: 0 })
  }

  const recentCooks = cooks.slice(0, 6)
  const topRated = cooks
    .filter(c => c.flavor)
    .sort((a, b) => b.flavor - a.flavor)
    .slice(0, 6)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Back nav */}
        <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            background: 'var(--parchment)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
            color: 'var(--ink)'
          }}>←</button>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--ink)'
          }}>{profile?.full_name || profile?.username || ''}</div>
        </div>

        {/* Avatar + name + follow */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 20px 20px'
        }}>
          <div style={{
            width: '72px', height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: '28px', fontWeight: '700',
            color: 'var(--cream)',
            marginBottom: '12px',
            boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)'
          }}>
            {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
          </div>

          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--ink)',
            marginBottom: '2px'
          }}>{profile?.full_name || profile?.username}</div>

          {profile?.username && profile?.full_name && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>@{profile.username}</div>
          )}

          {/* Follow button */}
          <div style={{ marginBottom: '20px' }}>
            {followStatus === 'approved' ? (
              <button onClick={unfollow} style={{
                padding: '10px 32px',
                background: 'var(--ink)',
                color: 'var(--cream)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>Following</button>
            ) : followStatus === 'pending' ? (
              <button disabled style={{
                padding: '10px 32px',
                background: 'var(--parchment)',
                color: 'var(--muted)',
                border: '1.5px solid var(--tan)',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'not-allowed'
              }}>Requested</button>
            ) : (
              <button onClick={sendFollowRequest} style={{
                padding: '10px 32px',
                background: 'transparent',
                color: 'var(--clay)',
                border: '2px solid var(--clay)',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>Request to Follow</button>
            )}
          </div>

          {/* Stats */}
          {followStatus === 'approved' && (
            <div style={{ display: 'flex', gap: '32px', textAlign: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{stats.saved}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Saved</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{stats.cooked}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Cooked</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />

        {/* Not following state */}
        {followStatus !== 'approved' && (
          <div style={{
            textAlign: 'center',
            padding: '32px 20px',
            color: 'var(--muted)'
          }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔒</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: '500',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>Private Cookbook</div>
            <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
              Follow {profile?.full_name || 'this cook'} to see what they're making.
            </div>
          </div>
        )}

        {/* Recently Cooked */}
        {followStatus === 'approved' && recentCooks.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              padding: '0 20px',
              marginBottom: '12px'
            }}>Recently Cooked</div>
            <div style={{
              display: 'flex',
              gap: '10px',
              overflowX: 'auto',
              padding: '0 20px 4px',
              scrollbarWidth: 'none'
            }}>
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
                      marginBottom: '6px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {recipe.image_url && (
                        <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      {v && (
                        <div style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          background: v.bg,
                          border: '1px solid ' + v.border,
                          borderRadius: '100px',
                          padding: '2px 6px',
                          fontSize: '8px',
                          fontWeight: '700',
                          color: v.color
                        }}>{v.label}</div>
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
                    }}>{recipe.title}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {followStatus === 'approved' && recentCooks.length > 0 && (
          <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />
        )}

        {/* Top Rated */}
        {followStatus === 'approved' && topRated.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              padding: '0 20px',
              marginBottom: '12px'
            }}>Top Rated</div>
            <div style={{
              display: 'flex',
              gap: '10px',
              overflowX: 'auto',
              padding: '0 20px 4px',
              scrollbarWidth: 'none'
            }}>
              {topRated.map(cook => {
                const recipe = cook.recipes
                if (!recipe) return null
                return (
                  <div key={cook.id} style={{ flexShrink: 0, width: '88px' }}>
                    <div style={{
                      width: '88px', height: '88px',
                      borderRadius: 'var(--radius-md)',
                      background: recipe.image_url ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
                      marginBottom: '6px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {recipe.image_url && (
                        <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <div style={{
                        position: 'absolute',
                        bottom: '4px',
                        left: '4px',
                        background: 'var(--ink)',
                        borderRadius: '100px',
                        padding: '2px 6px',
                        fontSize: '8px',
                        fontWeight: '700',
                        color: 'var(--cream)'
                      }}>{cook.flavor}/5</div>
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
                    }}>{recipe.title}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Want to Make private notice */}
        {followStatus === 'approved' && (
          <div style={{
            margin: '0 20px',
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--parchment)',
            padding: '12px 16px',
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--muted)'
          }}>Want to Make list is private</div>
        )}

      </div>
    </div>
  )
}