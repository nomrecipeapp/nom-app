import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import LikesModal from './LikesModal'
import CircleFriendsModal from './CircleFriendsModal'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

const verdictStylesShort = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never' },
}

function renderCommentBody(body, onSelectUser, profiles) {
  const parts = body.split(/(@\w+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.slice(1)
      const profile = profiles?.find(p => p.username === username)
      return (
        <span key={i} onClick={() => profile && onSelectUser && onSelectUser(profile.id)}
          style={{ color: 'var(--clay)', fontWeight: '600', cursor: profile ? 'pointer' : 'default' }}>
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function SocialRecipeDetail({ cook, session, onBack, onSelectUser, scrollToComments, isOwner, onViewInCookbook }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [circleCooks, setCircleCooks] = useState([])
  const [duplicate, setDuplicate] = useState(null)
  const [myRecipeId, setMyRecipeId] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingComments, setLoadingComments] = useState(true)
  const [ingredientsOpen, setIngredientsOpen] = useState(true)
  const [directionsOpen, setDirectionsOpen] = useState(true)
  const [showLikesModal, setShowLikesModal] = useState(false)
  const [showCircleModal, setShowCircleModal] = useState(false)
  const [circleFriendsCount, setCircleFriendsCount] = useState(0)
  const [circleFriendAvatars, setCircleFriendAvatars] = useState([])
  const [openMenuId, setOpenMenuId] = useState(null)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingBody, setEditingBody] = useState('')
  const [myProfile, setMyProfile] = useState(null)

  // Mention state
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionResults, setMentionResults] = useState([])
  const [allCommenters, setAllCommenters] = useState([])
  const [followingProfiles, setFollowingProfiles] = useState([])
  const textareaRef = useRef(null)
  const commentsRef = useRef(null)

  const recipe = cook.recipes
  const profile = cook.profiles
  const v = verdictStyles[cook.verdict]
  const targetType = 'cook'
  const targetId = cook.id

  useEffect(() => {
  fetchMyProfile()
  fetchLikes()
  fetchComments()
  checkIfSaved()
  fetchFollowing()
  fetchCircleFriends()
  upsertView()
}, [cook.id])

  useEffect(() => {
    if (scrollToComments && commentsRef.current) {
      setTimeout(() => { commentsRef.current.scrollIntoView({ behavior: 'smooth' }) }, 300)
    }
  }, [scrollToComments])

  async function fetchFollowing() {
    const { data: follows } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!follows || follows.length === 0) return
    const ids = follows.map(f => f.following_id)
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url').in('id', ids)
    setFollowingProfiles(profiles || [])
  }

  async function fetchCircleFriends() {
    if (!recipe?.canonical_id) return
    const { data: following } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!following || following.length === 0) return
    const followingIds = following.map(f => f.following_id)
    const { data: matchingRecipes } = await supabase
      .from('recipes').select('id, user_id')
      .eq('canonical_id', recipe.canonical_id).in('user_id', followingIds)
    if (!matchingRecipes || matchingRecipes.length === 0) return
    const userIds = [...new Set(matchingRecipes.map(r => r.user_id))].filter(id => id !== cook.user_id)
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url').in('id', userIds.slice(0, 3))
    setCircleFriendsCount(userIds.length)
    setCircleFriendAvatars(profiles || [])
  }

  async function fetchMyProfile() {
  const { data } = await supabase.from('profiles')
    .select('avatar_url').eq('id', session.user.id).single()
  if (data) setMyProfile(data)
  }

  async function upsertView() {
    if (!recipe?.id) return
    await supabase.from('recipe_views').upsert(
      { user_id: session.user.id, recipe_id: recipe.id, viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,recipe_id' }
    )
  }

  async function checkIfSaved() {
    if (!recipe?.canonical_id) return
    const { data } = await supabase.from('recipes').select('id')
      .eq('user_id', session.user.id).eq('canonical_id', recipe.canonical_id).maybeSingle()
    if (data) setMyRecipeId(data.id)
  }

  async function fetchLikes() {
    const { count } = await supabase.from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', targetType).eq('target_id', targetId)
    const { data: myLike } = await supabase.from('likes').select('id')
      .eq('target_type', targetType).eq('target_id', targetId)
      .eq('user_id', session.user.id).maybeSingle()
    setLikeCount(count || 0)
    setLiked(!!myLike)
  }

  async function fetchComments() {
    setLoadingComments(true)
    const { data } = await supabase.from('comments').select('*')
      .eq('target_type', targetType).eq('target_id', targetId)
      .order('created_at', { ascending: true })
    if (!data || data.length === 0) { setComments([]); setLoadingComments(false); return }
    const userIds = [...new Set(data.map(c => c.user_id))]
    const { data: profiles } = await supabase.from('profiles')
      .select('id, full_name, username, avatar_url').in('id', userIds)
    const enriched = data.map(c => ({ ...c, profiles: profiles?.find(p => p.id === c.user_id) || null }))
    setComments(enriched)
    setAllCommenters(profiles || [])
    setLoadingComments(false)
  }

  function handleCommentChange(e) {
    const val = e.target.value
    setCommentBody(val)
    const cursor = e.target.selectionStart
    const textUpToCursor = val.slice(0, cursor)
    const match = textUpToCursor.match(/@(\w*)$/)
    if (match) {
      const query = match[1].toLowerCase()
      setMentionQuery(query)
      const combined = [...followingProfiles, ...allCommenters]
      const deduped = combined.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx)
        .filter(p => p.id !== session.user.id)
      const filtered = deduped.filter(p =>
        p.username?.toLowerCase().includes(query) ||
        p.full_name?.toLowerCase().includes(query)
      )
      setMentionResults(filtered.slice(0, 6))
    } else {
      setMentionQuery(null)
      setMentionResults([])
    }
  }

  function insertMention(profile) {
    const cursor = textareaRef.current?.selectionStart || commentBody.length
    const textUpToCursor = commentBody.slice(0, cursor)
    const beforeMention = textUpToCursor.replace(/@\w*$/, '')
    const after = commentBody.slice(cursor)
    const newBody = `${beforeMention}@${profile.username} ${after}`
    setCommentBody(newBody)
    setMentionQuery(null)
    setMentionResults([])
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function toggleLike() {
    if (liked) {
      await supabase.from('likes').delete()
        .eq('target_type', targetType).eq('target_id', targetId).eq('user_id', session.user.id)
      setLiked(false); setLikeCount(c => c - 1)
    } else {
      await supabase.from('likes').upsert({
        user_id: session.user.id, target_type: targetType, target_id: targetId
      }, { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true })
      setLiked(true); setLikeCount(c => c + 1)
      if (cook.user_id !== session.user.id) {
        await supabase.from('notifications').insert({
          recipient_id: cook.user_id, actor_id: session.user.id,
          type: 'like', recipe_id: cook.recipe_id, target_type: targetType, target_id: targetId,
        })
      }
    }
  }

  async function deleteComment(commentId) {
    await supabase.from('comments').delete().eq('id', commentId)
    setOpenMenuId(null)
    await fetchComments()
  }

  async function saveEditComment(commentId) {
    if (!editingBody.trim()) return
    await supabase.from('comments').update({ body: editingBody.trim() }).eq('id', commentId)
    setEditingCommentId(null)
    setEditingBody('')
    await fetchComments()
  }

  async function submitComment() {
    if (!commentBody.trim()) return
    setSubmitting(true)

    await supabase.from('comments').insert({
      user_id: session.user.id, target_type: targetType,
      target_id: targetId, body: commentBody.trim()
    })

    if (cook.user_id !== session.user.id) {
      await supabase.from('notifications').insert({
        recipient_id: cook.user_id, actor_id: session.user.id,
        type: 'comment', recipe_id: cook.recipe_id, target_type: targetType, target_id: targetId,
      })
    }

    // Mention notifications
    const mentionMatches = commentBody.match(/@(\w+)/g) || []
    for (const mention of mentionMatches) {
      const username = mention.slice(1)
      const { data: mentionedProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      if (mentionedProfile && mentionedProfile.id !== session.user.id) {
        await supabase.from('notifications').insert({
          recipient_id: mentionedProfile.id, actor_id: session.user.id,
          type: 'mention', recipe_id: cook.recipe_id, target_type: targetType, target_id: targetId,
        })
      }
    }

    setCommentBody('')
    setMentionQuery(null)
    setMentionResults([])
    await fetchComments()
    setSubmitting(false)
  }

  async function fetchCircleCooks() {
    const { data: following } = await supabase.from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!following || following.length === 0) return
    const followingIds = following.map(f => f.following_id)
    const { data: matchingRecipes } = await supabase.from('recipes').select('id, user_id')
      .eq('canonical_id', recipe.canonical_id).in('user_id', followingIds)
    if (!matchingRecipes || matchingRecipes.length === 0) return
    const recipeIds = matchingRecipes.map(r => r.id)
    const { data: cooksData } = await supabase.from('cooks').select('*')
      .in('recipe_id', recipeIds).order('cooked_at', { ascending: false })
    if (!cooksData || cooksData.length === 0) return
    const userIds = [...new Set(cooksData.map(c => c.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
    const cooksWithProfiles = cooksData.map(c => ({ ...c, profiles: profiles?.find(p => p.id === c.user_id) || null }))
    const seen = new Set()
    const deduped = cooksWithProfiles.filter(c => {
      if (c.user_id === cook.user_id) return false
      if (seen.has(c.user_id)) return false
      seen.add(c.user_id); return true
    })
    setCircleCooks(deduped)
  }

  async function saveRecipe() {
    if (saved || saving) return
    setSaving(true)
    const { data: existing } = await supabase.from('recipes').select('id, title')
      .eq('user_id', session.user.id).eq('canonical_id', recipe.canonical_id).maybeSingle()
    if (existing) { setDuplicate(existing); setSaving(false); return }
    const { data: canonicalData } = await supabase
      .from('recipes').select('canonical_id')
      .eq('id', recipe.id).single()

    await supabase.from('recipes').insert({
      user_id: session.user.id, title: recipe.title, source_url: recipe.source_url,
      source_name: recipe.source_name, image_url: recipe.image_url, cook_time: recipe.cook_time,
      difficulty: recipe.difficulty, ingredients: recipe.ingredients,
      instructions: recipe.instructions, status: 'want_to_make',
      canonical_id: canonicalData?.canonical_id || crypto.randomUUID(),
      saved_from_recipe_id: recipe.id
    })
    if (cook.user_id !== session.user.id) {
      await supabase.from('notifications').insert({
        recipient_id: cook.user_id, actor_id: session.user.id,
        type: 'save', recipe_id: recipe.id, target_type: 'cook', target_id: cook.id,
      })
    }
    setSaving(false)
    setSaved(true)
    const { data: newRecipe } = await supabase
      .from('recipes').select('id')
      .eq('user_id', session.user.id).eq('canonical_id', recipe.canonical_id).maybeSingle()
    if (newRecipe) setMyRecipeId(newRecipe.id)
  }

  async function addAnyway() {
    setDuplicate(null); setSaving(true)
    const { data: canonicalData } = await supabase
      .from('recipes').select('canonical_id')
      .eq('id', recipe.id).single()

    await supabase.from('recipes').insert({
      user_id: session.user.id, title: recipe.title, source_url: recipe.source_url,
      source_name: recipe.source_name, image_url: recipe.image_url, cook_time: recipe.cook_time,
      difficulty: recipe.difficulty, ingredients: recipe.ingredients,
      instructions: recipe.instructions, status: 'want_to_make',
      canonical_id: canonicalData?.canonical_id || crypto.randomUUID(),
      saved_from_recipe_id: recipe.id
    })
    if (cook.user_id !== session.user.id) {
      await supabase.from('notifications').insert({
        recipient_id: cook.user_id, actor_id: session.user.id,
        type: 'save', recipe_id: recipe.id, target_type: 'cook', target_id: cook.id,
      })
    }
    setSaving(false); setSaved(true)
  }

  if (!recipe) return null

  const allCommentProfiles = [...followingProfiles, ...allCommenters]
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>

      {(cook.photo_urls?.[0] || recipe.image_url) ? (
        <div style={{ marginTop: '54px' }}>
          <img src={cook.photo_urls?.[0] || recipe.image_url} alt="" style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }} />
        </div>
      ) : (
        <div style={{ height: '54px' }} />
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

        {showCircleModal && (
          <CircleFriendsModal
            canonicalId={recipe.canonical_id}
            sourceUrl={recipe.source_url}
            session={session}
            onClose={() => setShowCircleModal(false)}
            onSelectUser={onSelectUser}
          />
        )}

        {circleFriendsCount > 0 && (
          <div onClick={() => setShowCircleModal(true)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--parchment)', borderRadius: 'var(--radius-md)',
            padding: '10px 14px', marginBottom: '12px', cursor: 'pointer'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex' }}>
                {circleFriendAvatars.map((p, i) => (
                  <div key={p.id} style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: '700', color: 'var(--cream)',
                    marginLeft: i === 0 ? '0' : '-6px', border: '2px solid var(--parchment)', flexShrink: 0
                  }}>{(p.full_name || p.username || '?')[0].toUpperCase()}</div>
                ))}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--charcoal)' }}>
                <span style={{ fontWeight: '600', color: 'var(--clay)' }}>{circleFriendsCount} {circleFriendsCount === 1 ? 'friend' : 'friends'}</span> also {circleFriendsCount === 1 ? 'has' : 'have'} this
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--clay)', fontWeight: '600' }}>See all →</span>
          </div>
        )}

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

        <div style={{ height: '1px', background: 'var(--parchment)', marginBottom: '16px' }} />

        <div onClick={() => onSelectUser && onSelectUser(cook.user_id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{(profile?.full_name || profile?.username || '?')[0].toUpperCase()}</div>
          )}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '1px' }}>Cooked by</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{profile?.full_name || profile?.username || 'Unknown'} →</div>
          </div>
        </div>

        {v && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: v.bg, border: '1px solid ' + v.border, borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: '12px', fontWeight: '600', color: v.color }}>{v.label}</div>
          </div>
        )}

        {cook.photo_urls && cook.photo_urls.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' }}>
            {cook.photo_urls.slice(1).map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
            ))}
          </div>
        )}

        {cook.notes && (
          <div style={{ background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Notes</div>
            <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.6', fontStyle: 'italic' }}>"{cook.notes}"</div>
          </div>
        )}

        {(cook.flavor || cook.effort || cook.would_share || cook.true_to_recipe) && (
          <div style={{ background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Scores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cook.flavor && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Flavor</div><div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.flavor}/5</div></div>}
              {cook.effort && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Effort vs. Reward</div><div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.effort}/5</div></div>}
              {cook.would_share && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Would Share</div><div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.would_share}/5</div></div>}
              {cook.true_to_recipe && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>True to Recipe</div><div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.true_to_recipe}/5</div></div>}
            </div>
          </div>
        )}

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

      {recipe.instructions && (
                <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', marginBottom: '16px', overflow: 'hidden' }}>
                  <button onClick={() => setDirectionsOpen(o => !o)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Directions</div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: directionsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <path d="M6 9l6 6 6-6" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {directionsOpen && (
                    <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {recipe.instructions.split('\n').filter(Boolean).map((line, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--clay)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
                          <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.6', flex: 1 }}>{line.replace(/^\d+\.\s*/, '')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
        
        {circleCooks.length > 0 && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>From Your Circle</div>
              {circleCooks.length > 3 && (
                <button onClick={() => setShowCircleModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--clay)', padding: 0 }}>See all {circleCooks.length} →</button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {circleCooks.slice(0, 3).map((c, i) => {
                const vs = verdictStylesShort[c.verdict]
                const name = c.profiles?.full_name || c.profiles?.username || 'Someone'
                return (
                  <div key={c.id} style={{ paddingBottom: i < Math.min(circleCooks.length, 3) - 1 ? '14px' : '0', borderBottom: i < Math.min(circleCooks.length, 3) - 1 ? '1px solid var(--parchment)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0
                        }}>{name[0].toUpperCase()}</div>
                        <span onClick={() => onSelectUser && onSelectUser(c.user_id)} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--tan)' }}>{name}</span>
                      </div>
                      {vs && <div style={{ background: vs.bg, border: '1px solid ' + vs.border, borderRadius: '100px', padding: '2px 8px', fontSize: '10px', fontWeight: '700', color: vs.color }}>{vs.label}</div>}
                    </div>
                    {c.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: '1.5', paddingLeft: '36px' }}>"{c.notes}"</div>}
                    {c.flavor && <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '36px', marginTop: '4px' }}>Flavor <strong style={{ color: 'var(--clay)' }}>{c.flavor}/5</strong></div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {isOwner && myRecipeId && (
          <button onClick={() => onViewInCookbook && onViewInCookbook(myRecipeId)} style={{
            width: '100%', padding: '15px', background: 'var(--parchment)', color: 'var(--charcoal)',
            border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '32px'
          }}>View in Cookbook →</button>
        )}

        {!isOwner && !duplicate && !myRecipeId && !saved && (
          <button onClick={saveRecipe} disabled={saving} style={{
            width: '100%', padding: '15px',
            background: 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
            cursor: 'pointer', transition: 'background 0.2s', marginBottom: '16px'
          }}>{saving ? 'Saving...' : '+ Save to My Cookbook'}</button>
        )}
        {!isOwner && !duplicate && saved && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--sage)', fontWeight: '600', textAlign: 'center', marginBottom: '8px' }}>✓ Saved to Cookbook</div>
            <button onClick={() => onViewInCookbook && onViewInCookbook(myRecipeId || recipe.id)} style={{
              width: '100%', padding: '12px',
              background: 'var(--parchment)', color: 'var(--charcoal)',
              border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
            }}>View in Cookbook →</button>
          </div>
        )}

        {!isOwner && myRecipeId && !saved && (
          <button onClick={() => onViewInCookbook && onViewInCookbook(myRecipeId)} style={{
            width: '100%', padding: '15px', background: 'var(--parchment)', color: 'var(--charcoal)',
            border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '32px'
          }}>You have this — View in Cookbook →</button>
        )}

        {!isOwner && duplicate && (
          <div style={{ background: '#FEF3E2', border: '1px solid #F5C47A', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9A6B1A', marginBottom: '8px' }}>Already in your Cookbook: "{duplicate.title}"</div>
            <button onClick={addAnyway} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #F5C47A', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: '600', color: '#9A6B1A', cursor: 'pointer' }}>Add Anyway</button>
          </div>
        )}

        {showLikesModal && (
          <LikesModal
            targetType={targetType}
            targetId={targetId}
            onClose={() => setShowLikesModal(false)}
            onSelectUser={onSelectUser}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={toggleLike} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'var(--clay)' : 'none'}>
                <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z"
                  stroke={liked ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {likeCount > 0 ? (
              <button onClick={() => setShowLikesModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: liked ? 'var(--clay)' : 'var(--muted)' }}>{likeCount} {liked ? 'Liked' : 'Like'}</span>
              </button>
            ) : (
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)' }}>Like</span>
            )}
          </div>
        </div>

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
                const isCommentAuthor = comment.user_id === session.user.id
                const isPostOwner = (targetType === 'cook' ? cook?.user_id : recipe?.user_id) === session.user.id
                const canEdit = isCommentAuthor
                const canDelete = isCommentAuthor || isPostOwner
                const showMenu = canEdit || canDelete

                return (
                  <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {comment.profiles?.avatar_url ? (
                      <img src={comment.profiles.avatar_url} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)' }}>{name[0].toUpperCase()}</div>
                    )}

                    <div style={{ flex: 1, position: 'relative' }}>
                      <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--parchment)', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span onClick={() => onSelectUser && onSelectUser(comment.user_id)} style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--tan)' }}>{name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            {showMenu && (
                              <button onClick={() => setOpenMenuId(openMenuId === comment.id ? null : comment.id)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--muted)', fontSize: '16px', padding: '0 2px',
                                lineHeight: 1, fontWeight: '700'
                              }}>⋯</button>
                            )}
                          </div>
                        </div>

                        {editingCommentId === comment.id ? (
                          <div>
                            <textarea
                              value={editingBody}
                              onChange={e => setEditingBody(e.target.value)}
                              rows={2}
                              style={{
                                width: '100%', padding: '8px 10px',
                                border: '1.5px solid var(--clay)', borderRadius: 'var(--radius-md)',
                                background: 'var(--cream)', fontFamily: 'var(--font-body)',
                                fontSize: '13px', color: 'var(--ink)', outline: 'none',
                                resize: 'none', lineHeight: '1.5', boxSizing: 'border-box'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                              <button onClick={() => saveEditComment(comment.id)} style={{
                                padding: '5px 12px', background: 'var(--clay)', color: 'var(--cream)',
                                border: 'none', borderRadius: 'var(--radius-pill)',
                                fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                              }}>Save</button>
                              <button onClick={() => { setEditingCommentId(null); setEditingBody('') }} style={{
                                padding: '5px 12px', background: 'transparent', color: 'var(--muted)',
                                border: '1px solid var(--tan)', borderRadius: 'var(--radius-pill)',
                                fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                              }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.5' }}>
                            {renderCommentBody(comment.body, onSelectUser, allCommentProfiles)}
                          </div>
                        )}
                      </div>

                      {/* Dropdown menu */}
                      {openMenuId === comment.id && (
                        <div style={{
                          position: 'absolute', top: '100%', right: 0,
                          background: 'var(--warm-white)', border: '1px solid var(--parchment)',
                          borderRadius: 'var(--radius-md)', marginTop: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50,
                          minWidth: '120px', overflow: 'hidden'
                        }}>
                          {canEdit && (
                            <button onClick={() => { setEditingCommentId(comment.id); setEditingBody(comment.body); setOpenMenuId(null) }} style={{
                              width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                              textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '13px',
                              fontWeight: '500', color: 'var(--ink)', cursor: 'pointer',
                              borderBottom: canDelete ? '1px solid var(--parchment)' : 'none'
                            }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--parchment)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >Edit</button>
                          )}
                          {canDelete && (
                            <button onClick={() => deleteComment(comment.id)} style={{
                              width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                              textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '13px',
                              fontWeight: '500', color: '#B85252', cursor: 'pointer'
                            }}
                              onMouseEnter={e => e.currentTarget.style.background = '#FDE8E8'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >Delete</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Comment input with mention dropdown */}
          <div style={{ position: 'relative' }}>
            {mentionQuery !== null && mentionResults.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '40px', right: '0',
                background: 'var(--warm-white)', border: '1px solid var(--parchment)',
                borderRadius: 'var(--radius-md)', marginBottom: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden'
              }}>
                {mentionResults.map(p => (
                  <div key={p.id} onMouseDown={e => { e.preventDefault(); insertMention(p) }} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', cursor: 'pointer',
                    borderBottom: '1px solid var(--parchment)',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--parchment)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)'
                    }}>{(p.full_name || p.username || '?')[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{p.full_name || p.username}</div>
                      {p.username && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{p.username}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              {myProfile?.avatar_url ? (
                <img src={myProfile.avatar_url} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)' }}>{(session.user.email || '?')[0].toUpperCase()}</div>
              )}
              <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea
                  ref={textareaRef}
                  value={commentBody}
                  onChange={handleCommentChange}
                  placeholder="Add a comment... (type @ to mention)"
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
    </div>
  )
}