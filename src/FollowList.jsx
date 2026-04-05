import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function FollowList({ userId, type, session, onBack, onSelectUser }) {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchList()
  }, [userId, type])

  async function fetchList() {
    setLoading(true)
    let ids = []

    if (type === 'following') {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .eq('status', 'approved')
      ids = (data || []).map(f => f.following_id)
    } else {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId)
        .eq('status', 'approved')
      ids = (data || []).map(f => f.follower_id)
    }

    if (ids.length === 0) { setPeople([]); setLoading(false); return }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', ids)

    setPeople(profiles || [])
    setLoading(false)
  }

  const filtered = people.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Spacer for top bar */}
        <div style={{ height: '54px' }} />

        {/* Search bar */}
        {!loading && people.length > 0 && (
          <div style={{ padding: '12px 20px 4px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'var(--warm-white)', border: '1.5px solid var(--tan)',
              borderRadius: 'var(--radius-pill)', padding: '10px 16px'
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
                <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                style={{
                  flex: 1, border: 'none', background: 'none',
                  fontFamily: 'var(--font-body)', fontSize: '14px',
                  color: 'var(--ink)', outline: 'none'
                }}
              />
              {search.length > 0 && (
                <button onClick={() => setSearch('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: '18px', padding: 0, lineHeight: 1
                }}>×</button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
        ) : people.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '8px' }}>
              {type === 'following' ? 'Not following anyone yet' : 'No followers yet'}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: '13px' }}>
            No results for "{search}"
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {filtered.map(person => (
              <div key={person.id} onClick={() => onSelectUser(person.id)} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 20px', cursor: 'pointer',
                borderBottom: '1px solid var(--parchment)',
              }}>
                {person.avatar_url
                  ? <img src={person.avatar_url} alt="" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{
                      width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--cream)'
                    }}>
                      {(person.full_name || person.username || '?')[0].toUpperCase()}
                    </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                    {person.full_name || person.username}
                  </div>
                  {person.username && person.full_name && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>@{person.username}</div>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}