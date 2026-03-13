import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

function FriendRecipeDetail({ recipe, session, onBack, scrollToComments }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duplicate, setDuplicate] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingComments, setLoadingComments] = useState(true)
  const commentsRef = useRef(null)

  const targetType = 'save'
  const targetId = recipe.id

  useEffect(() => {
    fetchLikes()
    fetchComments()
  }, [recipe.id])

  useEffect(() => {
    if (scrollToComments && commentsRef.current) {
      setTimeout(() => {
        commentsRef.current.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
  }, [scrollToComments])

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
    setLoadingComments(true)
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: true })

    if (!data || data.length === 0) { setComments([]); setLoadingComments(false); return }

    const userIds = [...new Set(data.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', userIds)

    setComments(data.map(c => ({
      ...c,
      profiles: profiles?.find(p => p.id === c.user_id) || null
    })))
    setLoadingComments(false)
  }

  async function toggleLike() {
    if (liked) {
      await supabase.from('likes').delete()
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('user_id', session.user.id)
      setLiked(false)
      setLikeCount(c => c - 1)
    } else {
      await supabase.from('likes').upsert({
        user_id: session.user.id,
        target_type: targetType,
        target_id: targetId
      }, { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true })
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

  async function saveRecipe() {
    if (saved || saving) return
    setSaving(true)
    const { data: existing } = await supabase
      .from('recipes')
      .select('id, title')
      .eq('user_id', session.user.id)
      .eq('source_url', recipe.source_url)
      .maybeSingle()

    if (existing) { setDuplicate(existing); setSaving(false); return }

    await supabase.from('recipes').insert({
      user_id: session.user.id,
      title: recipe.title,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      image_url: recipe.image_url,
      cook_time: recipe.cook_time,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      notes: recipe.notes,
      status: 'want_to_make'
    })
    setSaving(false)
    setSaved(true)
  }

  async function addAnyway() {
    setDuplicate(null)
    setSaving(true)
    await supabase.from('recipes').insert({
      user_id: session.user.id,
      title: recipe.title,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      image_url: recipe.image_url,
      cook_time: recipe.cook_time,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      notes: recipe.notes,
      status: 'want_to_make'
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>
      {recipe.image_url ? (
        <div style={{ position: 'relative' }}>
          <img src={recipe.image_url} alt="" style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }} />
          <button onClick={onBack} style={{
            position: 'absolute', top: '16px', left: '16px',
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      ) : (
        <div style={{ padding: '16px 16px 0' }}>
          <button onClick={onBack} style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--parchment)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.2', marginBottom: '10px' }}>{recipe.title}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {recipe.source_name && <div style={{ background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', fontSize: '11px', fontWeight: '500', color: 'var(--charcoal)' }}>{recipe.source_name}</div>}
            {recipe.cook_time && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.cook_time}</div>}
            {recipe.difficulty && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>· {recipe.difficulty}</div>}
          </div>
        </div>

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--parchment)', borderRadius: 'var(--radius-md)',
            padding: '10px 14px', marginBottom: '16px', textDecoration: 'none'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--clay)' }}>View original recipe →</div>
            {recipe.source_name && <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{recipe.source_name}</div>}
          </a>
        )}

        {recipe.ingredients && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>Ingredients</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recipe.ingredients.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--clay)', flexShrink: 0, marginTop: '6px' }} />
                  <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.5' }}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recipe.instructions && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>Instructions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {recipe.instructions.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--clay)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
                  <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.6', flex: 1 }}>{line.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {duplicate && (
          <div style={{ background: '#FEF3E2', border: '1px solid #F5C47A', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9A6B1A', marginBottom: '8px' }}>Already in your Cookbook: "{duplicate.title}"</div>
            <button onClick={addAnyway} style={{
              width: '100%', padding: '8px', background: 'transparent',
              border: '1px solid #F5C47A', borderRadius: 'var(--radius-pill)',
              fontSize: '12px', fontWeight: '600', color: '#9A6B1A', cursor: 'pointer'
            }}>Add Anyway</button>
          </div>
        )}

        {!duplicate && (
          <button onClick={saveRecipe} disabled={saved || saving} style={{
            width: '100%', padding: '15px',
            background: saved ? 'var(--sage)' : 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
            cursor: saved ? 'default' : 'pointer', transition: 'background 0.2s',
            marginBottom: '32px'
          }}>
            {saved ? '✓ Saved to Cookbook' : saving ? 'Saving...' : '+ Save to My Cookbook'}
          </button>
        )}

        {/* Like bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button onClick={toggleLike} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'var(--clay)' : 'none'}>
              <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z"
                stroke={liked ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: '600', color: liked ? 'var(--clay)' : 'var(--muted)' }}>
              {likeCount > 0 ? `${likeCount} ` : ''}{liked ? 'Liked' : 'Like'}
            </span>
          </button>
        </div>

        {/* Comments */}
        <div ref={commentsRef}>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
            Comments{comments.length > 0 ? ` · ${comments.length}` : ''}
          </div>

          {loadingComments ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
          ) : comments.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No comments yet. Be the first!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {comments.map(comment => {
                const name = comment.profiles?.full_name || comment.profiles?.username || 'Someone'
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

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
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
                padding: '10px 16px',
                background: commentBody.trim() ? 'var(--clay)' : 'var(--tan)',
                color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
                cursor: commentBody.trim() ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s', whiteSpace: 'nowrap'
              }}>Post</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Feed({ session, onSelectCook, onSelectUser }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [scrollToComments, setScrollToComments] = useState(false)
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

    const ids = follows.map(f => f.following_id)

    // Fetch cooks
    const { data: cooks } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .in('user_id', ids)
      .order('cooked_at', { ascending: false })
      .limit(40)

    // Fetch saves (want_to_make recipes saved recently)
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

    // Build cook feed items
    const cookItems = (cooks || []).map(c => ({
      ...c,
      _type: 'cook',
      _date: c.cooked_at,
      profiles: profiles?.find(p => p.id === c.user_id) || null
    }))

    // Build save feed items
    const saveItems = (saves || []).map(r => ({
      ...r,
      _type: 'save',
      _date: r.created_at,
      profiles: profiles?.find(p => p.id === r.user_id) || null
    }))

    // Merge and sort by date
    const merged = [...cookItems, ...saveItems]
      .sort((a, b) => new Date(b._date) - new Date(a._date))
      .slice(0, 60)

    setFeed(merged)
    setLoading(false)
    fetchFeedEngagement(merged)
  }

  async function fetchFeedEngagement(items) {
    if (!items || items.length === 0) return

    const cookIds = items.filter(i => i._type === 'cook').map(i => i.id)
    const saveIds = items.filter(i => i._type === 'save').map(i => i.id)

    const likesMap = {}
    const likeCountsMap = {}
    const commentCountsMap = {}

    // Fetch all likes by current user for these items
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

  if (selectedRecipe) return (
    <FriendRecipeDetail
      recipe={selectedRecipe}
      session={session}
      onBack={() => { setSelectedRecipe(null); setScrollToComments(false) }}
      scrollToComments={scrollToComments}
    />
  )

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
                <div key={`save-${item.id}`} onClick={() => setSelectedRecipe(item)} style={{
                  background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--parchment)', overflow: 'hidden', cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                    {/* Avatar — tappable to profile */}
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

                    {/* Name + action */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--ink)' }}>
                          {profile?.full_name || profile?.username || 'Unknown'}
                        </span>
                        {' '}saved a recipe
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>

                  </div>

                  {/* Recipe row */}
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

                  {/* Like + comment bar */}
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
                    <button onClick={e => { e.stopPropagation(); setScrollToComments(true); setSelectedRecipe(item) }} style={{
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
                {/* Header */}
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
                      {new Date(item.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Image */}
                {recipe.image_url && (
                  <img
                    src={recipe.image_url}
                    alt=""
                    style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
                  />
                )}

                {/* Body */}
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

                {/* Like + comment bar */}
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