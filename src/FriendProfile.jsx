import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

export default function FriendProfile({ userId, session, onBack }) {
  const [profile, setProfile] = useState(null)
  const [cooks, setCooks] = useState([])
  const [followStatus, setFollowStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
    fetchCooks()
    fetchFollowStatus()
  }, [userId])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
    setLoading(false)
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
    await supabase.from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', userId)
    setFollowStatus(null)
    setCooks([])
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{
        padding: '24px 24px 0',
        maxWidth: '480px',
        margin: '0 auto'
      }}>
        <button onClick={onBack} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: '600',
          color: 'var(--muted)',
          padding: '0',
          marginBottom: '24px',
          display: 'block'
        }}>← Back</button>

        {/* Profile card */}
        <div style={{
          background: 'var(--warm-white)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--parchment)',
          padding: '24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px', height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--clay), var(--ember))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '22px', fontWeight: '700',
              color: 'var(--cream)',
              flexShrink: 0
            }}>
              {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--ink)',
                letterSpacing: '-0.3px'
              }}>{profile?.full_name || profile?.username}</div>
              {profile?.username && profile?.full_name && (
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>@{profile.username}</div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                {cooks.length} cook{cooks.length !== 1 ? 's' : ''} logged
              </div>
            </div>
          </div>

          {followStatus === 'approved' ? (
            <button onClick={unfollow} style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--muted)',
              border: '1.5px solid var(--tan)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>Following</button>
          ) : followStatus === 'pending' ? (
            <button disabled style={{
              padding: '8px 16px',
              background: 'var(--parchment)',
              color: 'var(--muted)',
              border: '1.5px solid var(--tan)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'not-allowed'
            }}>Requested</button>
          ) : (
            <button onClick={sendFollowRequest} style={{
              padding: '8px 16px',
              background: 'var(--clay)',
              color: 'var(--cream)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>Follow</button>
          )}
        </div>

        {/* Cook history */}
        {followStatus !== 'approved' ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
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
        ) : cooks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            color: 'var(--muted)',
            fontSize: '14px'
          }}>No cooks logged yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cooks.map(cook => {
              const v = verdictStyles[cook.verdict]
              const recipe = cook.recipes
              if (!recipe) return null

              return (
                <div key={cook.id} style={{
                  background: 'var(--warm-white)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--parchment)',
                  overflow: 'hidden'
                }}>
                  {recipe.image_url ? (
                    <img src={recipe.image_url} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ height: '100px', background: 'linear-gradient(135deg, var(--clay) 0%, var(--ember) 60%, var(--tan) 100%)' }} />
                  )}
                  <div style={{ padding: '14px 16px' }}>
                    {v && (
                      <div style={{
                        display: 'inline-flex',
                        background: v.bg,
                        border: '1px solid ' + v.border,
                        borderRadius: 'var(--radius-pill)',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: v.color,
                        marginBottom: '6px'
                      }}>{v.label}</div>
                    )}
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '17px',
                      fontWeight: '500',
                      color: 'var(--ink)',
                      marginBottom: '4px'
                    }}>{recipe.title}</div>
                    {cook.notes && (
                      <div style={{
                        fontSize: '13px',
                        color: 'var(--charcoal)',
                        fontStyle: 'italic',
                        lineHeight: '1.5'
                      }}>"{cook.notes}"</div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                      {new Date(cook.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}