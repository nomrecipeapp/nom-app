import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

export default function FriendRecipeDetail({ recipe, session, onBack, scrollToComments, isOwner, onViewInCookbook }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duplicate, setDuplicate] = useState(null)
  const [myRecipeId, setMyRecipeId] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingComments, setLoadingComments] = useState(true)
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  const commentsRef = useRef(null)

  const targetType = 'save'
  const targetId = recipe.id

  useEffect(() => {
    fetchLikes()
    fetchComments()
    checkIfSaved()
  }, [recipe.id])

  async function checkIfSaved() {
    if (!recipe?.source_url) return
    const { data } = await supabase
      .from('recipes')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('source_url', recipe.source_url)
      .maybeSingle()
    if (data) setMyRecipeId(data.id)
  }

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
      if (recipe.user_id && recipe.user_id !== session.user.id) {
        await supabase.from('notifications').insert({
          recipient_id: recipe.user_id,
          actor_id: session.user.id,
          type: 'like',
          recipe_id: recipe.id,
          target_type: targetType,
          target_id: targetId,
        })
      }
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
    if (recipe.user_id && recipe.user_id !== session.user.id) {
      await supabase.from('notifications').insert({
        recipient_id: recipe.user_id,
        actor_id: session.user.id,
        type: 'comment',
        recipe_id: recipe.id,
        target_type: targetType,
        target_id: targetId,
      })
    }
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
    if (recipe.user_id && recipe.user_id !== session.user.id) {
      await supabase.from('notifications').insert({
        recipient_id: recipe.user_id,
        actor_id: session.user.id,
        type: 'save',
        recipe_id: recipe.id,
        target_type: 'save',
        target_id: recipe.id,
      })
    }
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
    if (recipe.user_id && recipe.user_id !== session.user.id) {
      await supabase.from('notifications').insert({
        recipient_id: recipe.user_id,
        actor_id: session.user.id,
        type: 'save',
        recipe_id: recipe.id,
        target_type: 'save',
        target_id: recipe.id,
      })
    }
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

        {/* Collapsible ingredients */}
        {recipe.ingredients && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', marginBottom: '16px', overflow: 'hidden' }}>
            <button onClick={() => setIngredientsOpen(o => !o)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Ingredients</div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: ingredientsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {ingredientsOpen && (
              <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recipe.ingredients.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--clay)', flexShrink: 0, marginTop: '6px' }} />
                    <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.5' }}>{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Owner: View in Cookbook */}
        {isOwner && (
          <button onClick={() => onViewInCookbook && onViewInCookbook(recipe.id)} style={{
            width: '100%', padding: '15px',
            background: 'var(--parchment)', color: 'var(--charcoal)',
            border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
            cursor: 'pointer', marginBottom: '32px'
          }}>View in Cookbook →</button>
        )}

        {/* Non-owner: save or already saved */}
        {!isOwner && !duplicate && !myRecipeId && (
          <button onClick={saveRecipe} disabled={saved || saving} style={{
            width: '100%', padding: '15px',
            background: saved ? 'var(--sage)' : 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
            cursor: saved ? 'default' : 'pointer', transition: 'background 0.2s',
            marginBottom: '16px'
          }}>
            {saved ? '✓ Saved to Cookbook' : saving ? 'Saving...' : '+ Save to My Cookbook'}
          </button>
        )}

        {!isOwner && myRecipeId && !saved && (
          <button onClick={() => onViewInCookbook && onViewInCookbook(myRecipeId)} style={{
            width: '100%', padding: '15px',
            background: 'var(--parchment)', color: 'var(--charcoal)',
            border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
            cursor: 'pointer', marginBottom: '32px'
          }}>You have this — View in Cookbook →</button>
        )}

        {!isOwner && duplicate && (
          <div style={{ background: '#FEF3E2', border: '1px solid #F5C47A', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9A6B1A', marginBottom: '8px' }}>Already in your Cookbook: "{duplicate.title}"</div>
            <button onClick={addAnyway} style={{
              width: '100%', padding: '8px', background: 'transparent',
              border: '1px solid #F5C47A', borderRadius: 'var(--radius-pill)',
              fontSize: '12px', fontWeight: '600', color: '#9A6B1A', cursor: 'pointer'
            }}>Add Anyway</button>
          </div>
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