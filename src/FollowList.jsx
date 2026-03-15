import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function FollowList({ userId, type, session, onBack, onSelectUser }) {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)

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
      .select('id, full_name, username')
      .in('id', ids)

    setPeople(profiles || [])
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--parchment)' }}>
          <button onClick={onBack} style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--parchment)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>
            {type === 'following' ? 'Following' : 'Followers'}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
        ) : people.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '8px' }}>
              {type === 'following' ? 'Not following anyone yet' : 'No followers yet'}
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {people.map(person => (
              <div key={person.id} onClick={() => onSelectUser(person.id)} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 20px', cursor: 'pointer',
                borderBottom: '1px solid var(--parchment)',
              }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--cream)'
                }}>
                  {(person.full_name || person.username || '?')[0].toUpperCase()}
                </div>
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