import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { IconX } from './icons'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

// Friends (people you follow) who have this recipe: one row per person, never you, and never
// excludeUserId (the friend whose recipe or cook you're looking at), so it matches the counts on the page.
export default function CircleFriendsModal({ sourceUrl, canonicalId, excludeUserId, session, onClose, onSelectUser }) {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFriends()
  }, [sourceUrl, canonicalId, excludeUserId])

  async function fetchFriends() {
    setLoading(true)

    const { data: following } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')

    if (!following || following.length === 0) { setFriends([]); setLoading(false); return }

    const followingIds = following.map(f => f.following_id).filter(id => id !== session.user.id && id !== excludeUserId)
    if (followingIds.length === 0) { setFriends([]); setLoading(false); return }

    const { data: matchingRecipes } = await supabase
      .from('recipes').select('id, user_id, status, created_at')
      .eq(canonicalId ? 'canonical_id' : 'source_url', canonicalId || sourceUrl)
      .in('user_id', followingIds)

    if (!matchingRecipes || matchingRecipes.length === 0) { setFriends([]); setLoading(false); return }

    const userIds = [...new Set(matchingRecipes.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)

    // For each friend, get their most recent cook if they have one
    const recipeIds = matchingRecipes.map(r => r.id)
    const { data: cooksData } = await supabase
      .from('cooks').select('*')
      .in('recipe_id', recipeIds)
      .order('cooked_at', { ascending: false })

    // One row per person: their latest cook across all their copies, else their newest copy's status
    const results = userIds.map(userId => {
      const theirs = matchingRecipes.filter(r => r.user_id === userId)
      const theirIds = new Set(theirs.map(r => r.id))
      const cook = cooksData?.find(c => theirIds.has(c.recipe_id))
      const newest = [...theirs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      return {
        userId,
        profile: profiles?.find(p => p.id === userId),
        status: cook ? (cook.verdict === 'never_again' ? 'never_again' : 'cooked') : newest.status,
        verdict: cook?.verdict || null,
        notes: cook?.notes || null,
      }
    })

    setFriends(results)
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--cream)', borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: '360px',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--parchment)', flexShrink: 0
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: 'var(--ink)' }}>
            Friends with this recipe
          </div>
          <button className="nom-hit" aria-label="Close" onClick={onClose} style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--parchment)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', color: 'var(--charcoal)', fontWeight: '600'
          }}><IconX size={13} strokeWidth={2.2} /></button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>No friends have this recipe yet</div>
          ) : (
            friends.map((f, i) => {
              const name = f.profile?.full_name || f.profile?.username || 'Someone'
              const v = verdictStyles[f.verdict]
              const statusLabel = f.status === 'cooked' ? 'Cooked' : f.status === 'never_again' ? 'Never Again' : 'Saved'
              return (
                <div key={f.userId} onClick={() => { onClose(); setTimeout(() => onSelectUser(f.userId), 50) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 20px', cursor: 'pointer',
                    borderBottom: i < friends.length - 1 ? '1px solid var(--parchment)' : 'none',
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)',
                    overflow: 'hidden', position: 'relative'
                  }}>
                    {f.profile?.avatar_url
                      ? <img loading="lazy" decoding="async" src={f.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={e => e.target.style.display = 'none'} />
                      : null
                    }
                    <span>{name[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>{name}</div>
                    {f.notes && <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{f.notes}"</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {v ? (
                      <div style={{ background: v.bg, border: '1px solid ' + v.border, borderRadius: 'var(--radius-pill)', padding: '3px 8px', fontSize: '10px', fontWeight: '600', color: v.color }}>{v.label}</div>
                    ) : (
                      <div style={{ background: 'var(--parchment)', border: '1px solid var(--tan)', borderRadius: 'var(--radius-pill)', padding: '3px 8px', fontSize: '10px', fontWeight: '600', color: 'var(--charcoal)' }}>{statusLabel}</div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}