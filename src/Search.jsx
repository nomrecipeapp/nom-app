import { useState } from 'react'
import { supabase } from './supabase'

export default function Search({ session, onSelectUser }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [followStates, setFollowStates] = useState({})

  async function search() {
    if (!query.trim()) return
    setLoading(true)

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .neq('id', session.user.id)
      .limit(20)

    if (data) {
      setResults(data)

      // Check follow status for each result
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id, status')
        .eq('follower_id', session.user.id)
        .in('following_id', data.map(p => p.id))

      const states = {}
      if (follows) follows.forEach(f => { states[f.following_id] = f.status })
      setFollowStates(states)
    }

    setLoading(false)
  }

  async function sendFollowRequest(userId) {
  await supabase.from('follows').insert({
    follower_id: session.user.id,
    following_id: userId,
    status: 'pending'
  })
  setFollowStates(s => ({ ...s, [userId]: 'pending' }))
  // Notify the person being requested
  await supabase.from('notifications').insert({
    recipient_id: userId,
    actor_id: session.user.id,
    type: 'follow_request',
  })
}

  async function unfollow(userId) {
    await supabase.from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', userId)
    setFollowStates(s => ({ ...s, [userId]: null }))
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '28px',
        fontWeight: '700',
        color: 'var(--ink)',
        letterSpacing: '-0.5px',
        marginBottom: '24px'
      }}>Find Cooks</div>

      {/* Search input */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search by name or username..."
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1.5px solid var(--tan)',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--warm-white)',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--ink)',
            outline: 'none'
          }}
        />
        <button onClick={search} style={{
          padding: '12px 20px',
          background: 'var(--clay)',
          color: 'var(--cream)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer'
        }}>Search</button>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' }}>
          Searching...
        </div>
      ) : results.length === 0 && query ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' }}>
          No cooks found for "{query}"
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {results.map(profile => {
            const followStatus = followStates[profile.id]
            return (
              <div key={profile.id} style={{
                background: 'var(--warm-white)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--parchment)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }} onClick={() => onSelectUser(profile.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px', height: '42px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px', fontWeight: '700',
                    color: 'var(--cream)',
                    flexShrink: 0
                  }}>
                    {(profile.full_name || profile.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                      {profile.full_name || profile.username}
                    </div>
                    {profile.username && profile.full_name && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{profile.username}</div>
                    )}
                  </div>
                </div>

                {followStatus === 'approved' ? (
                  <button onClick={() => unfollow(profile.id)} style={{
                    padding: '7px 14px',
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
                    padding: '7px 14px',
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
                  <button onClick={() => sendFollowRequest(profile.id)} style={{
                    padding: '7px 14px',
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
            )
          })}
        </div>
      )}
    </div>
  )
}