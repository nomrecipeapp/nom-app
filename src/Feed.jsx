import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

import FriendRecipeDetail from './FriendRecipeDetail'

export default function Feed({ session, onSelectCook, onSelectUser, onSelectSave }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [feedLikes, setFeedLikes] = useState({})
  const [feedLikeCounts, setFeedLikeCounts] = useState({})
  const [feedCommentCounts, setFeedCommentCounts] = useState({})

  useEffect(() => {
    fetchFeed()
    fetchRequests()
  }, [session.user.id])

  async function fetchFeed() {
    setLoading(true)
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id)
      .eq('status', 'approved')

    if (!follows || follows.length === 0) { setLoading(false); return }

    const ids = [...follows.map(f => f.following_id), session.user.id]

    const { data: cooks } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .in('user_id', ids)
      .order('cooked_at', { ascending: false })
      .limit(40)

    const { data: saves } = await supabase
      .from('recipes')
      .select('*')
      .in('user_id', ids)
      .eq('status', 'want_to_make')
      .order('created_at', { ascending: false })
      .limit(40)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', ids)

    const cookItems = (cooks || []).map(c => ({
      ...c,
      _type: 'cook',
      _date: c.cooked_at,
      profiles: profiles?.find(p => p.id === c.user_id) || null
    }))

    const saveItems = (saves || []).map(r => ({
      ...r,
      _type: 'save',
      _date: r.created_at,
      profiles: profiles?.find(p => p.id === r.user_id) || null
    }))

    const merged = [...cookItems, ...saveItems]
      .sort((a, b) => new Date(b._date) - new Date(a._date))
      .slice(0, 60)

    setFeed(merged)
    setLoading(false)
    await fetchFeedEngagement(merged)
  }

  async function fetchFeedEngagement(items) {
    if (!items || items.length === 0) return

    const cookIds = items.filter(i => i._type === 'cook').map(i => i.id)
    const saveIds = items.filter(i => i._type === 'save').map(i => i.id)

    const likesMap = {}
    const likeCountsMap = {}
    const commentCountsMap = {}

    if (cookIds.length > 0) {
      const { data: cookLikes } = await supabase.from('likes').select('target_id').eq('target_type', 'cook').eq('user_id', session.user.id).in('target_id', cookIds)
      cookLikes?.forEach(l => { likesMap[`cook-${l.target_id}`] = true })
      for (const id of cookIds) {
        const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('target_type', 'cook').eq('target_id', id)
        likeCountsMap[`cook-${id}`] = count || 0
        const { count: cc } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('target_type', 'cook').eq('target_id', id)
        commentCountsMap[`cook-${id}`] = cc || 0
      }
    }

    if (saveIds.length > 0) {
      const { data: saveLikes } = await supabase.from('likes').select('target_id').eq('target_type', 'save').eq('user_id', session.user.id).in('target_id', saveIds)
      saveLikes?.forEach(l => { likesMap[`save-${l.target_id}`] = true })
      for (const id of saveIds) {
        const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('target_type', 'save').eq('target_id', id)
        likeCountsMap[`save-${id}`] = count || 0
        const { count: cc } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('target_type', 'save').eq('target_id', id)
        commentCountsMap[`save-${id}`] = cc || 0
      }
    }

    setFeedLikes(likesMap)
    setFeedLikeCounts(likeCountsMap)
    setFeedCommentCounts(commentCountsMap)
  }

  async function toggleFeedLike(e, item) {
    e.stopPropagation()
    const key = `${item._type}-${item.id}`
    const isLiked = feedLikes[key]
    if (isLiked) {
      await supabase.from('likes').delete().eq('target_type', item._type).eq('target_id', item.id).eq('user_id', session.user.id)
      setFeedLikes(prev => ({ ...prev, [key]: false }))
      setFeedLikeCounts(prev => ({ ...prev, [key]: (prev[key] || 1) - 1 }))
    } else {
      await supabase.from('likes').upsert({ user_id: session.user.id, target_type: item._type, target_id: item.id }, { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true })
      setFeedLikes(prev => ({ ...prev, [key]: true }))
      setFeedLikeCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
      if (item.user_id !== session.user.id) {
        await supabase.from('notifications').insert({
          recipient_id: item.user_id,
          actor_id: session.user.id,
          type: 'like',
          recipe_id: item._type === 'cook' ? item.recipe_id : item.id,
          target_type: item._type,
          target_id: item.id,
        })
      }
    }
  }

  async function fetchRequests() {
    const { data } = await supabase
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
      setRequests(data.map(r => ({
        ...r,
        profiles: profiles?.find(p => p.id === r.follower_id) || null
      })))
    } else {
      setRequests([])
    }
  }

  async function approveRequest(id) {
    await supabase.from('follows').update({ status: 'approved' }).eq('id', id)
    const request = requests.find(r => r.id === id)
    if (request) {
      await supabase.from('notifications').insert({
        recipient_id: request.follower_id,
        actor_id: session.user.id,
        type: 'follow_approved',
      })
    }
    fetchRequests()
    fetchFeed()
  }

  async function denyRequest(id) {
    await supabase.from('follows').delete().eq('id', id)
    fetchRequests()
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>

      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '700',
        color: 'var(--clay)', letterSpacing: '-1px', marginBottom: '24px'
      }}>Nom</div>

      {requests.length > 0 && (
        <div style={{
          background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--parchment)', padding: '16px 20px', marginBottom: '24px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Follow Requests</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requests.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>{r.profiles?.full_name || r.profiles?.username || 'Someone'}</div>
                  {r.profiles?.username && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{r.profiles.username}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => approveRequest(r.id)} style={{
                    padding: '7px 14px', background: 'var(--clay)', color: 'var(--cream)',
                    border: 'none', borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                  }}>Approve</button>
                  <button onClick={() => denyRequest(r.id)} style={{
                    padding: '7px 14px', background: 'transparent', color: 'var(--muted)',
                    border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                  }}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
      ) : feed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '500', color: 'var(--ink)', marginBottom: '8px' }}>No activity yet</div>
          <div style={{ fontSize: '13px', lineHeight: '1.6' }}>Follow some cooks to see what they're making.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feed.map(item => {
            const profile = item.profiles

            // --- SAVE CARD ---
            if (item._type === 'save') {
              return (
                <div key={`save-${item.id}`} onClick={() => onSelectSave(item)} style={{
                  background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--parchment)', overflow: 'hidden', cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                    <div
                      onClick={e => { e.stopPropagation(); onSelectUser && onSelectUser(item.user_id) }}
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700',
                        color: 'var(--cream)', flexShrink: 0, cursor: 'pointer'
                      }}>
                      {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--ink)' }}>
                          {item.user_id === session.user.id ? 'You' : (profile?.full_name || profile?.username || 'Unknown')}
                        </span>
                        {' '}saved a recipe
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px 14px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                      overflow: 'hidden', flexShrink: 0,
                      background: item.image_url ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {item.image_url
                        ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--cream)' }}>{(item.title || '?')[0].toUpperCase()}</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                      {item.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{item.source_name}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 16px 12px', borderTop: '1px solid var(--parchment)' }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={e => toggleFeedLike(e, item)} style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={feedLikes[`save-${item.id}`] ? 'var(--clay)' : 'none'}>
                        <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z"
                          stroke={feedLikes[`save-${item.id}`] ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: feedLikes[`save-${item.id}`] ? 'var(--clay)' : 'var(--muted)' }}>
                        {feedLikeCounts[`save-${item.id}`] > 0 ? feedLikeCounts[`save-${item.id}`] : ''} {feedLikes[`save-${item.id}`] ? 'Liked' : 'Like'}
                      </span>
                    </button>
                    <button onClick={e => { e.stopPropagation(); onSelectSave(item, true) }} style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                          stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>
                        {feedCommentCounts[`save-${item.id}`] > 0 ? feedCommentCounts[`save-${item.id}`] : ''} Comment
                      </span>
                    </button>
                  </div>
                </div>
              )
            }

            // --- COOK CARD ---
            const v = verdictStyles[item.verdict]
            const recipe = item.recipes
            if (!recipe) return null

            return (
              <div key={`cook-${item.id}`} onClick={() => onSelectCook(item)} style={{
                cursor: 'pointer',
                background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--parchment)', overflow: 'hidden'
              }}>
                <div
                  onClick={e => { e.stopPropagation(); onSelectUser && onSelectUser(item.user_id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', cursor: 'pointer' }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700',
                    color: 'var(--cream)', flexShrink: 0
                  }}>
                    {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>
                      {item.user_id === session.user.id ? 'You' : (profile?.full_name || profile?.username || 'Unknown')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {new Date(item.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                {recipe.image_url && (
                  <img src={recipe.image_url} alt="" style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                )}

                <div style={{ padding: '14px 16px' }}>
                  {v && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: v.bg, border: '1px solid ' + v.border,
                      borderRadius: 'var(--radius-pill)', padding: '5px 12px',
                      fontSize: '12px', fontWeight: '600', color: v.color, marginBottom: '8px'
                    }}>{v.label}</div>
                  )}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '6px' }}>{recipe.title}</div>
                  {item.notes && (
                    <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.55', fontStyle: 'italic' }}>"{item.notes}"</div>
                  )}
                </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 16px 12px', borderTop: '1px solid var(--parchment)' }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={e => toggleFeedLike(e, item)} style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={feedLikes[`cook-${item.id}`] ? 'var(--clay)' : 'none'}>
                        <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z"
                          stroke={feedLikes[`cook-${item.id}`] ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: feedLikes[`cook-${item.id}`] ? 'var(--clay)' : 'var(--muted)' }}>
                        {feedLikeCounts[`cook-${item.id}`] > 0 ? feedLikeCounts[`cook-${item.id}`] : ''} {feedLikes[`cook-${item.id}`] ? 'Liked' : 'Like'}
                      </span>
                    </button>
                    <button onClick={e => { e.stopPropagation(); onSelectCook(item, true) }} style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                          stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>
                        {feedCommentCounts[`cook-${item.id}`] > 0 ? feedCommentCounts[`cook-${item.id}`] : ''} Comment
                      </span>
                    </button>
                  </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}