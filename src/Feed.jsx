import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

export default function Feed({ session, onSelectRecipe }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])

  useEffect(() => {
    fetchFeed()
    fetchRequests()
  }, [])

  async function fetchFeed() {
    setLoading(true)
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id)
      .eq('status', 'approved')

    if (!follows || follows.length === 0) { setLoading(false); return }

    const ids = follows.map(f => f.following_id)

    const { data: cooks } = await supabase
      .from('cooks')
      .select('*, recipes(*), profiles(*)')
      .in('user_id', ids)
      .order('cooked_at', { ascending: false })
      .limit(40)

    if (cooks) setFeed(cooks)
    setLoading(false)
  }

  async function fetchRequests() {
    const { data, error } = await supabase
      .from('follows')
      .select('*')
      .eq('following_id', session.user.id)
      .eq('status', 'pending')
    if (data && data.length > 0) {
      const followerIds = data.map(r => r.follower_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', followerIds)
      const requestsWithProfiles = data.map(r => ({
        ...r,
        profiles: profiles?.find(p => p.id === r.follower_id) || null
      }))
      setRequests(requestsWithProfiles)
    } else {
      setRequests([])
    }
  }

  async function approveRequest(id) {
    await supabase.from('follows').update({ status: 'approved' }).eq('id', id)
    fetchRequests()
    fetchFeed()
  }

  async function denyRequest(id) {
    await supabase.from('follows').delete().eq('id', id)
    fetchRequests()
  }

  async function saveRecipe(recipe) {
    await supabase.from('recipes').insert({
      user_id: session.user.id,
      title: recipe.title,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      image_url: recipe.image_url,
      cook_time: recipe.cook_time,
      difficulty: recipe.difficulty,
      status: 'want_to_make'
    })
    alert('Saved to your Cookbook!')
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '32px',
        fontWeight: '700',
        color: 'var(--clay)',
        letterSpacing: '-1px',
        marginBottom: '24px'
      }}>Nom</div>

      {requests.length > 0 && (
        <div style={{
          background: 'var(--warm-white)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--parchment)',
          padding: '16px 20px',
          marginBottom: '24px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '12px'
          }}>Follow Requests</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requests.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                    {r.profiles?.full_name || r.profiles?.username || 'Someone'}
                  </div>
                  {r.profiles?.username && (
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{r.profiles.username}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => approveRequest(r.id)} style={{
                    padding: '7px 14px',
                    background: 'var(--clay)',
                    color: 'var(--cream)',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>Approve</button>
                  <button onClick={() => denyRequest(r.id)} style={{
                    padding: '7px 14px',
                    background: 'transparent',
                    color: 'var(--muted)',
                    border: '1.5px solid var(--tan)',
                    borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: '14px' }}>
          Loading...
        </div>
      ) : feed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👥</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: '500',
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>No activity yet</div>
          <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
            Follow some cooks to see what they're making.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feed.map(cook => {
            const v = verdictStyles[cook.verdict]
            const profile = cook.profiles
            const recipe = cook.recipes
            if (!recipe) return null

            return (
              <div key={cook.id} style={{
                background: 'var(--warm-white)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--parchment)',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px' }}>
                  <div style={{
                    width: '36px', height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px', fontWeight: '700',
                    color: 'var(--cream)',
                    flexShrink: 0
                  }}>
                    {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>
                      {profile?.full_name || profile?.username || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {new Date(cook.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                {recipe.image_url ? (
                  <img src={recipe.image_url} alt="" style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ height: '160px', background: 'linear-gradient(135deg, var(--clay) 0%, var(--ember) 60%, var(--tan) 100%)' }} />
                )}

                <div style={{ padding: '14px 16px' }}>
                  {v && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: v.bg,
                      border: '1px solid ' + v.border,
                      borderRadius: 'var(--radius-pill)',
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: v.color,
                      marginBottom: '8px'
                    }}>{v.label}</div>
                  )}

                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '18px',
                    fontWeight: '500',
                    color: 'var(--ink)',
                    marginBottom: '6px'
                  }}>{recipe.title}</div>

                  {cook.notes && (
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--charcoal)',
                      lineHeight: '1.55',
                      fontStyle: 'italic',
                      marginBottom: '12px'
                    }}>"{cook.notes}"</div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--parchment)'
                  }}>
                    <button onClick={() => saveRecipe(recipe)} style={{
                      padding: '8px 16px',
                      background: 'var(--clay)',
                      color: 'var(--cream)',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}>+ Save to Cookbook</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
