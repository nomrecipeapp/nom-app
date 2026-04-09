import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function LikesModal({ targetType, targetId, onClose, onSelectUser }) {
  const [likers, setLikers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLikers()
  }, [targetId])

  async function fetchLikers() {
    setLoading(true)
    const { data } = await supabase
      .from('likes')
      .select('user_id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)

    if (!data || data.length === 0) { setLikers([]); setLoading(false); return }

    const userIds = data.map(l => l.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', userIds)

    setLikers(profiles || [])
    setLoading(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--cream)', borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: '360px',
          maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--parchment)',
          flexShrink: 0
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: 'var(--ink)' }}>
            Liked by
          </div>
          <button onClick={onClose} style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--parchment)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', color: 'var(--charcoal)', fontWeight: '600'
          }}>×</button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
          ) : likers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>No likes yet</div>
          ) : (
            likers.map(p => (
              <div
                key={p.id}
                onClick={() => { onClose(); setTimeout(() => onSelectUser(p.id), 50) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 20px', cursor: 'pointer',
                  borderBottom: '1px solid var(--parchment)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--warm-white)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)'
                }}>{(p.full_name || p.username || '?')[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>{p.full_name || p.username}</div>
                  {p.username && p.full_name && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{p.username}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}