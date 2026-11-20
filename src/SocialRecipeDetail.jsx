import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import LikesModal from './LikesModal'
import CircleFriendsModal from './CircleFriendsModal'
import ModerationSheet, { MoreMenuSheet } from './ModerationSheet'
import { getHiddenContent, isHidden } from './moderation'
import { IconCheck, IconChevronRight, IconX, IconPlus } from './icons'
import FloatingAction from './FloatingAction'
import { toast, LoadError } from './ui'
import { useScrollToComments } from './useScrollToComments'
import { RecipeHeader, RecipeBody, RecipeHero, ShareButton, MoreButton, PersonRow, TakeSummary, TakeCard, CircleCooksCard } from './RecipeParts'
import { shareLink, markShared } from './sharedLink'
import { shortDate, scrollToRef } from './recipeStyle'
import { tap, success } from './haptics'

const primaryActionBtn = { width: '100%', padding: '17px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 6px 18px rgba(196,113,58,0.28)' }
const quietActionBtn = { width: '100%', padding: '15px', background: 'var(--parchment)', color: 'var(--charcoal)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }

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
  const saveAnchorRef = useRef(null)
  useEffect(() => {
    if (duplicate) saveAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [duplicate])
  const [myRecipeId, setMyRecipeId] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentsError, setCommentsError] = useState(false)
  const [myCooks, setMyCooks] = useState([])
  const circleRef = useRef(null)
  const [showLikesModal, setShowLikesModal] = useState(false)
  const [showCircleModal, setShowCircleModal] = useState(false)
  const [circleFriendsCount, setCircleFriendsCount] = useState(0)
  const [ownerCounted, setOwnerCounted] = useState(false)
  const [circleFriendAvatars, setCircleFriendAvatars] = useState([])
  const [openMenuId, setOpenMenuId] = useState(null)
  const [moderation, setModeration] = useState(null) // { mode, target }
  const [postMenuOpen, setPostMenuOpen] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingBody, setEditingBody] = useState('')
  const [myProfile, setMyProfile] = useState(null)
  const [overlayPhotos, setOverlayPhotos] = useState(null)
  const [overlayIndex, setOverlayIndex] = useState(0)
  const touchStartX = useRef(null)

  // Mention state
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionResults, setMentionResults] = useState([])
  const [allCommenters, setAllCommenters] = useState([])
  const [followingProfiles, setFollowingProfiles] = useState([])
  const textareaRef = useRef(null)
  const commentsRef = useRef(null)

  const recipe = cook.recipes
  const profile = cook.profiles
  const firstName = (profile?.full_name || '').trim().split(' ')[0] || profile?.username || ''
  const targetType = 'cook'
  const targetId = cook.id

  // Build photo strip
  const cookPhotos = (cook.photo_urls || []).map(url => ({ url, isStock: false }))
  const stockPhoto = recipe?.image_url ? [{ url: recipe.image_url, isStock: true }] : []
  const stripPhotos = [...cookPhotos, ...stockPhoto]
  const showStrip = cookPhotos.length > 0

  // Overlay helpers
  function openOverlay(index) { setOverlayPhotos(stripPhotos.map(p => p.url)); setOverlayIndex(index) }
  function closeOverlay() { setOverlayPhotos(null); setOverlayIndex(0) }
  function overlayNext() { setOverlayIndex(i => (i + 1) % overlayPhotos.length) }
  function overlayPrev() { setOverlayIndex(i => (i - 1 + overlayPhotos.length) % overlayPhotos.length) }
  function handleOverlayTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function handleOverlayTouchEnd(e) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) { diff > 0 ? overlayNext() : overlayPrev() }
    touchStartX.current = null
  }
  

  useEffect(() => {
  fetchMyProfile()
  fetchLikes()
  fetchComments()
  checkIfSaved()
  fetchFollowing()
  fetchCircleFriends()
  if (recipe?.canonical_id) fetchCircleCooks()
  upsertView()
}, [cook.id])

  useScrollToComments(commentsRef, scrollToComments, !loadingComments)

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
    const userIds = [...new Set(matchingRecipes.map(r => r.user_id))].filter(id => id !== session.user.id)
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url').in('id', userIds.slice(0, 3))
    setCircleFriendsCount(userIds.length)
    setOwnerCounted(userIds.includes(cook.user_id))
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
    if (!data) return
    setMyRecipeId(data.id)
    // Your own cooks of it, for the "You'd make it again" line
    const { data: mine } = await supabase.from('cooks').select('id, verdict, cooked_at')
      .eq('recipe_id', data.id).order('cooked_at', { ascending: false })
    setMyCooks(mine || [])
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
    setCommentsError(false)
    const { data, error } = await supabase.from('comments').select('*')
      .eq('target_type', targetType).eq('target_id', targetId)
      .order('created_at', { ascending: true })
    if (error) { setCommentsError(true); setLoadingComments(false); return }
    const hidden = await getHiddenContent(session.user.id)
    const visible = (data || []).filter(c => !isHidden(hidden, 'comment', c.id, c.user_id))
    if (visible.length === 0) { setComments([]); setLoadingComments(false); return }
    const userIds = [...new Set(visible.map(c => c.user_id))]
    const { data: profiles } = await supabase.from('profiles')
      .select('id, full_name, username, avatar_url').in('id', userIds)
    const enriched = visible.map(c => ({ ...c, profiles: profiles?.find(p => p.id === c.user_id) || null }))
    setComments(enriched)
    setAllCommenters(profiles || [])
    setLoadingComments(false)
  }

  function handleCommentChange(e) {
    const val = e.target.value
    setCommentBody(val)
    // Grow the box with the comment (up to about 5 lines) instead of scrolling inside one line
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
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
    tap()
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

    const { error: postError } = await supabase.from('comments').insert({
      user_id: session.user.id, target_type: targetType,
      target_id: targetId, body: commentBody.trim()
    })
    if (postError) {
      // Keep what they typed so they can try again
      toast("Couldn't post your comment. Try again?", { icon: null })
      setSubmitting(false)
      return
    }

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
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
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
    const timesByUser = {}
    for (const c of cooksData) timesByUser[c.user_id] = (timesByUser[c.user_id] || 0) + 1
    const cooksWithProfiles = cooksData.map(c => ({ ...c, profiles: profiles?.find(p => p.id === c.user_id) || null, _times: timesByUser[c.user_id] }))
    const seen = new Set()
    const deduped = cooksWithProfiles.filter(c => {
      if (c.user_id === session.user.id || c.user_id === cook.user_id) return false
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
      source_name: recipe.source_name, image_url: recipe.image_url, cook_time: recipe.cook_time, prep_time: recipe.prep_time,
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
    success()
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
      source_name: recipe.source_name, image_url: recipe.image_url, cook_time: recipe.cook_time, prep_time: recipe.prep_time,
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

  const postOwnerName = profile?.full_name || profile?.username || 'this cook'
  const canModeratePost = cook.user_id !== session.user.id

  function handleModerationClose({ reported, blocked }) {
    const target = moderation?.target
    setModeration(null)
    if (!target) return
    const postGone = (target.type !== 'comment' && reported) || (blocked && target.userId === cook.user_id)
    if (postGone) { onBack && onBack(); return }
    if (reported || blocked) fetchComments()
  }

  if (!recipe) return null

  const allCommentProfiles = [...followingProfiles, ...allCommenters]
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: 'var(--nav-clearance)' }}>

      {/* Fullscreen overlay */}
      {overlayPhotos && (
        <div onClick={closeOverlay} onTouchStart={handleOverlayTouchStart} onTouchEnd={handleOverlayTouchEnd}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button className="nom-hit" aria-label="Close photo" onClick={closeOverlay} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={16} strokeWidth={2.2} /></button>
          <img loading="lazy" decoding="async" src={overlayPhotos[overlayIndex]} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: '8px' }} />
          {overlayPhotos.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); overlayPrev() }} style={{ position: 'absolute', left: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <button onClick={e => { e.stopPropagation(); overlayNext() }} style={{ position: 'absolute', right: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              <div style={{ position: 'absolute', bottom: '24px', display: 'flex', gap: '6px' }}>
                {overlayPhotos.map((_, i) => (
                  <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === overlayIndex ? 'white' : 'rgba(255,255,255,0.35)' }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Photo strip or hero */}
      {showStrip ? (
        <div style={{ marginTop: 'var(--top-bar-h)', overflowX: 'auto', display: 'flex', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingLeft: '16px', paddingBottom: '4px' }}>
          {stripPhotos.map((photo, i) => (
            <div key={i} onClick={() => openOverlay(i)} style={{ position: 'relative', flexShrink: 0, width: '85vw', maxWidth: '400px', height: '240px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginRight: '10px', cursor: 'pointer', background: 'var(--parchment)' }}>
              <img loading="lazy" decoding="async" src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
              {!photo.isStock && profile && (
                <div onClick={e => { e.stopPropagation(); onSelectUser && onSelectUser(cook.user_id) }}
                  style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-pill)', padding: '4px 10px 4px 4px', cursor: 'pointer' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1.5px solid white', overflow: 'hidden', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {profile?.avatar_url
                      ? <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                      : <span style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: '700', color: 'var(--cream)' }}>{(profile?.full_name || profile?.username || '?')[0].toUpperCase()}</span>
                    }
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'white' }}>{isOwner ? 'Made by You' : `Made by ${profile?.full_name || profile?.username}`}</span>
                </div>
              )}
              {photo.isStock && (
                <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-pill)', padding: '3px 8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: 'white' }}>Recipe photo</span>
                </div>
              )}
            </div>
          ))}
          <div style={{ flexShrink: 0, width: '6px' }} />
        </div>
      ) : (
        <RecipeHero url={recipe.image_url} />
      )}

      <div style={{ padding: '24px 24px 0' }}>
        <RecipeHeader recipe={recipe}>
          <ShareButton onClick={() => {
            const fullUrl = shareLink('cook', cook.id)
            if (cook.user_id === session.user.id) markShared('cook', cook.id)
            if (navigator.share) {
              navigator.share({ title: recipe.title, url: fullUrl }).catch(() => {})
            } else {
              navigator.clipboard.writeText(fullUrl).then(() => toast('Link copied'))
            }
          }} />
          {canModeratePost && <MoreButton onClick={() => setPostMenuOpen(true)} />}
        </RecipeHeader>

        {postMenuOpen && (
          <MoreMenuSheet onClose={() => setPostMenuOpen(false)} actions={[
            { label: 'Report post', onTap: () => { setPostMenuOpen(false); setModeration({ mode: 'report', target: { type: 'cook', id: cook.id, userId: cook.user_id, name: postOwnerName } }) } },
            { label: `Block ${postOwnerName}`, danger: true, onTap: () => { setPostMenuOpen(false); setModeration({ mode: 'block', target: { type: 'profile', id: cook.user_id, userId: cook.user_id, name: postOwnerName } }) } },
          ]} />
        )}

        {moderation && (
          <ModerationSheet mode={moderation.mode} target={moderation.target} session={session} onClose={handleModerationClose} />
        )}

        {!isOwner && <PersonRow label="Cooked by" profile={profile} onClick={() => onSelectUser && onSelectUser(cook.user_id)} />}

        {showCircleModal && (
          <CircleFriendsModal
            canonicalId={recipe.canonical_id}
            sourceUrl={recipe.source_url}
            session={session}
            onClose={() => setShowCircleModal(false)}
            onSelectUser={onSelectUser}
          />
        )}

        {!isOwner && (
          <TakeSummary others cooks={myCooks} circleCooks={circleCooks} friendsWithIt={Math.max(0, circleFriendsCount - (ownerCounted ? 1 : 0))} avatars={circleFriendAvatars}
            onYourTake={() => onViewInCookbook && myRecipeId && onViewInCookbook(myRecipeId)}
            onCircle={() => circleCooks.length > 0 ? scrollToRef(circleRef) : setShowCircleModal(true)} />
        )}

        {/* Main action: right under the title, and floats once you scroll past it */}
        <div ref={saveAnchorRef} style={{ marginBottom: '24px', scrollMarginTop: 'calc(var(--top-bar-h) + 12px)' }}>
        {isOwner && myRecipeId && (
          <button onClick={() => onViewInCookbook && onViewInCookbook(myRecipeId)} style={quietActionBtn}>View in Cookbook<IconChevronRight size={12} strokeWidth={2.4} style={{ marginLeft: '3px', marginTop: '-1px' }} /></button>
        )}

        {!isOwner && !duplicate && !myRecipeId && !saved && (
          <button onClick={saveRecipe} disabled={saving} style={primaryActionBtn}>{saving ? 'Saving...' : <><IconPlus size={18} strokeWidth={2.4} />Save to My Cookbook</>}</button>
        )}
        {!isOwner && !duplicate && saved && (
          <div>
            <div style={{ fontSize: '13px', color: 'var(--sage)', fontWeight: '600', textAlign: 'center', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><IconCheck size={14} strokeWidth={2.5} />Saved to Cookbook</div>
            <button onClick={() => onViewInCookbook && onViewInCookbook(myRecipeId || recipe.id)} style={quietActionBtn}>View in Cookbook<IconChevronRight size={12} strokeWidth={2.4} style={{ marginLeft: '3px', marginTop: '-1px' }} /></button>
          </div>
        )}

        {!isOwner && myRecipeId && !saved && (
          <button onClick={() => onViewInCookbook && onViewInCookbook(myRecipeId)} style={quietActionBtn}>You have this · View in Cookbook<IconChevronRight size={12} strokeWidth={2.4} style={{ marginLeft: '3px', marginTop: '-1px' }} /></button>
        )}

        {!isOwner && duplicate && (
          <div style={{ background: '#FEF3E2', border: '1px solid #F5C47A', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9A6B1A', marginBottom: '8px' }}>Already in your Cookbook: "{duplicate.title}"</div>
            <button onClick={addAnyway} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #F5C47A', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: '600', color: '#9A6B1A', cursor: 'pointer' }}>Add anyway</button>
          </div>
        )}
        </div>

        <TakeCard
          label={isOwner ? 'Your take' : firstName ? `${firstName}'s take` : 'Their take'}
          sub={`Cooked ${shortDate(cook.cooked_at)}`}
          cook={cook}
        />

        <RecipeBody recipe={recipe} />

        <CircleCooksCard ref={circleRef} others circleCooks={circleCooks} friendsCount={circleFriendsCount} onSeeAll={() => setShowCircleModal(true)} onSelectUser={onSelectUser} />

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
            <button className="nom-hit" aria-label="Like" onClick={toggleLike} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'var(--clay)' : 'none'}>
                <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z"
                  stroke={liked ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {likeCount > 0 ? (
              <button className="nom-hit" onClick={() => setShowLikesModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: liked ? 'var(--clay)' : 'var(--muted)' }}>{likeCount} {likeCount === 1 ? 'Like' : 'Likes'}</span>
              </button>
            ) : (
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)' }}>Like</span>
            )}
          </div>
        </div>

        <div ref={commentsRef} style={{ scrollMarginTop: 'calc(var(--top-bar-h) + 12px)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
            Comments{comments.length > 0 ? ` · ${comments.length}` : ''}
          </div>

          {loadingComments ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
          ) : commentsError ? (
            <LoadError compact title="Couldn't load comments" onRetry={fetchComments} />
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
                const canReport = !isCommentAuthor
                const showMenu = canEdit || canDelete || canReport

                function shareContent(url, title) {
                    const fullUrl = `https://www.nomrecipeapp.com${url}`
                    if (navigator.share) {
                      navigator.share({ title, url: fullUrl }).catch(() => {})
                    } else {
                      navigator.clipboard.writeText(fullUrl).then(() => {
                        toast('Link copied')
                      }).catch(() => {})
                    }
                  }

                return (
                  <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {comment.profiles?.avatar_url ? (
                      <img loading="lazy" decoding="async" src={comment.profiles.avatar_url} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
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
                              borderBottom: (canDelete || canReport) ? '1px solid var(--parchment)' : 'none'
                            }}
                            >Edit</button>
                          )}
                          {canDelete && (
                            <button onClick={() => deleteComment(comment.id)} style={{
                              width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                              textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '13px',
                              fontWeight: '500', color: '#B85252', cursor: 'pointer',
                              borderBottom: canReport ? '1px solid var(--parchment)' : 'none'
                            }}
                            >Delete</button>
                          )}
                          {canReport && (
                            <button onClick={() => { setOpenMenuId(null); setModeration({ mode: 'report', target: { type: 'comment', id: comment.id, userId: comment.user_id, name } }) }} style={{
                              width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                              textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '13px',
                              fontWeight: '500', color: 'var(--ink)', cursor: 'pointer'
                            }}>Report</button>
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
                <img loading="lazy" decoding="async" src={myProfile.avatar_url} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)' }}>{(session.user.email || '?')[0].toUpperCase()}</div>
              )}
              <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea
                  ref={textareaRef}
                  value={commentBody}
                  onChange={handleCommentChange}
                  placeholder="Add a comment..."
                  rows={1}
                  style={{
                    flex: 1, minWidth: 0, padding: '10px 14px',
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
      {isOwner && myRecipeId && (
        <FloatingAction
          anchorRef={saveAnchorRef}
          tone="quiet"
          label="View in Cookbook"
          onClick={() => onViewInCookbook && onViewInCookbook(myRecipeId)}
        />
      )}
      {!isOwner && (
        <FloatingAction
          anchorRef={saveAnchorRef}
          show={!duplicate}
          tone={saved ? 'success' : myRecipeId ? 'quiet' : 'primary'}
          icon={saved ? IconCheck : (myRecipeId ? null : IconPlus)}
          label={saved ? 'Saved · View in Cookbook' : myRecipeId ? 'You have this · View in Cookbook' : saving ? 'Saving...' : 'Save to My Cookbook'}
          disabled={saving}
          onClick={() => {
            if (saved) { onViewInCookbook && onViewInCookbook(myRecipeId || recipe.id); return }
            if (myRecipeId) { onViewInCookbook && onViewInCookbook(myRecipeId); return }
            saveRecipe()
          }}
        />
      )}
    </div>
  )
}
