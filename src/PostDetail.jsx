import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

export default function PostDetail({ item, session, onBack, onSelectUser, onSelectRecipe }) {
  const [comments, setComments] = useState([])
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const targetType = item._type
  const targetId = item.id

  useEffect(() => {
    fetchLikes()
    fetchComments()
  }, [targetId])

  async function fetchLikes() {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', targetType)
      .eq('target_id', targetId)

    const { data: myLike } = await supabase
      .from('likes')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('user_id', session.user.id)
      .maybeSingle()

    setLikeCount(count || 0)
    setLiked(!!myLike)
  }

  async function fetchComments() {
    setLoading(true)
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: true })

    if (!data || data.length === 0) { setComments([]); setLoading(false); return }

    const userIds = [...new Set(data.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', userIds)

    const withProfiles = data.map(c => ({
      ...c,
      profiles: profiles?.find(p => p.id === c.user_id) || null
    }))

    setComments(withProfiles)
    setLoading(false)
  }

  async function toggleLike() {
    if (liked) {
      await supabase.from('likes')
        .delete()
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('user_id', session.user.id)
      setLiked(false)
      setLikeCount(c => c - 1)
    } else {
      await supabase.from('likes').insert({
        user_id: session.user.id,
        target_type: targetType,
        target_id: targetId
      })
      setLiked(true)
      setLikeCount(c => c + 1)
    }
  }

  async function submitComment() {
    if (!commentBody.trim()) return
    setSubmitting(true)
    await supabase.from('comments').insert({
      user_id: session.user.id,
      target_type: targetType,
      target_id: targetId,
      body: commentBody.trim()
    })
    setCommentBody('')
    await fetchComments()
    setSubmitting(false)
  }

  const profile = item.profiles
  const isCook = item._type === 'cook'
  const recipe = isCook ? item.recipes : item
  const v = isCook ? verdictStyles[item.verdict] : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--parchment)' }}>
          <button onClick={onBack} style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--parchment)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', color: 'var(--ink)', flexShrink: 0
          }}>←</button>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: 'var(--ink)' }}>
            {isCook ? 'Cook Post' : 'Saved Recipe'}
          </div>
        </div>

        {/* Post card */}
        <div style={{ margin: '16px 20px', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', overflow: 'hidden' }}>

          {/* Post header — tappable to profile */}
          <div
            onClick={() => onSelectUser && onSelectUser(item.user_id)}
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
                {profile?.full_name || profile?.username || 'Unknown'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {isCook
                  ? new Date(item.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
              </div>
            </div>
          </div>

          {/* Hero image */}
          {recipe?.image_url && (
            <img
              src={recipe.image_url} alt=""
              onClick={() => onSelectRecipe && onSelectRecipe(item)}
              style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
            />
          )}

          {/* Body */}
          <div
            onClick={() => onSelectRecipe && onSelectRecipe(item)}
            style={{ padding: '14px 16px', cursor: 'pointer' }}
          >
            {v && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: v.bg, border: '1px solid ' + v.border,
                borderRadius: 'var(--radius-pill)', padding: '5px 12px',
                fontSize: '12px', fontWeight: '600', color: v.color, marginBottom: '8px'
              }}>{v.label}</div>
            )}
            {!isCook && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'var(--parchment)', border: '1px solid var(--tan)',
                borderRadius: 'var(--radius-pill)', padding: '5px 12px',
                fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '8px'
              }}>Saved</div>
            )}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '4px' }}>
              {recipe?.title}
            </div>
            {recipe?.source_name && (
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.source_name}</div>
            )}
            {isCook && item.notes && (
              <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.55', fontStyle: 'italic', marginTop: '8px' }}>"{item.notes}"</div>
            )}
          </div>

          {/* Like bar */}
          <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--parchment)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={toggleLike} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'var(--clay)' : 'none'}>
                <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z"
                  stroke={liked ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '600', color: liked ? 'var(--clay)' : 'var(--muted)' }}>
                {likeCount > 0 ? likeCount : ''} {liked ? 'Liked' : 'Like'}
              </span>
            </button>
          </div>
        </div>

        {/* Comments section */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
            Comments {comments.length > 0 ? `· ${comments.length}` : ''}
          </div>

          {loading ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
          ) : comments.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No comments yet. Be the first!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {comments.map(comment => {
                const name = comment.profiles?.full_name || comment.profiles?.username || 'Someone'
                const isOwn = comment.user_id === session.user.id
                return (
                  <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)'
                    }}>{name[0].toUpperCase()}</div>
                    <div style={{ flex: 1, background: 'var(--warm-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--parchment)', padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink)' }}>{name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.5' }}>{comment.body}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Comment input */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '40px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--clay), var(--ember))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)'
            }}>{(session.user.email || '?')[0].toUpperCase()}</div>
            <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder="Add a comment..."
                rows={1}
                style={{
                  flex: 1, padding: '10px 14px',
                  border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
                  background: 'var(--cream)', fontFamily: 'var(--font-body)',
                  fontSize: '14px', color: 'var(--ink)', outline: 'none',
                  resize: 'none', lineHeight: '1.5'
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
              />
              <button onClick={submitComment} disabled={submitting || !commentBody.trim()} style={{
                padding: '10px 16px', background: commentBody.trim() ? 'var(--clay)' : 'var(--tan)',
                color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
                cursor: commentBody.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
                whiteSpace: 'nowrap'
              }}>Post</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}