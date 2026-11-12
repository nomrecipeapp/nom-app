import SectionTextarea from './SectionTextarea'
import { linkProps } from './openLink'
import { maybeAskForRating } from './rating'
import { useState, useEffect, useRef, forwardRef } from 'react'
import { ordinal } from './cookStats'
import { supabase } from './supabase'
import CircleFriendsModal from './CircleFriendsModal'
import { IconChevronRight, IconX, IconPot } from './icons'
import FloatingAction from './FloatingAction'
import { confirmSheet, toast, ShareToFeedToggle } from './ui'
import { PRESET_TAGS, tagChoices, addTag, hasTag, tagKey } from './tags'
import { IngredientList, InstructionList, CopyIngredientsButton, RecipeTimes } from './RecipeContent'
import { setBackGuard } from './backGuard'
import { tap, success } from './haptics'
import { shrinkImage } from './shrinkImage'

const verdictOptions = [
  { value: 'would_make_again', label: 'Would Make Again', sub: 'A keeper', bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42' },
  { value: 'it_was_fine', label: 'It Was Fine', sub: 'No regrets, no encore', bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A' },
  { value: 'never_again', label: 'Never Again', sub: 'Duly noted', bg: '#F4E8E8', border: '#C47070', color: '#9B4040' },
]

const nuanceCategories = [
  { key: 'flavor', label: 'Flavor' },
  { key: 'effort', label: 'Effort vs. Reward' },
  { key: 'would_share', label: 'Would Share' },
  { key: 'true_to_recipe', label: 'True to Recipe' },
]

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never' },
}



const SLIDERS = [
  { key: 'flavor', label: 'Flavor', short: 'Flavor' },
  { key: 'effort', label: 'Effort vs. Reward', short: 'Effort' },
  { key: 'would_share', label: 'Would Share', short: 'Share' },
  { key: 'true_to_recipe', label: 'True to Recipe', short: 'True to recipe' },
]
const sectionLabelStyle = { fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }
function shortDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }
function scrollToRef(ref) { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

const YOUR_VERDICT = {
  would_make_again: { text: "You'd make it again", icon: 'M5 12.5l4.5 4.5L19 7.5' },
  it_was_fine: { text: 'You thought it was fine', icon: 'M6 12h12' },
  never_again: { text: "You'd never make it again", icon: 'M7 7l10 10M17 7L7 17' },
}
const roundIconBtn = { width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'var(--parchment)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

// "2 friends made it. Both would make it again." / "1 friend made it. Thought it was fine."
function friendsHeadline(circleCooks) {
  const n = circleCooks.length
  const verdicts = new Set(circleCooks.map(c => c.verdict))
  const lead = `${n} ${n === 1 ? 'friend' : 'friends'} made it.`
  if (verdicts.size === 1) {
    const phrase = VERDICT_PHRASE[circleCooks[0].verdict]
    if (!phrase) return [lead, '']
    const who = n === 1 ? '' : n === 2 ? 'Both ' : `All ${n} `
    return [lead, who ? `${who}${phrase}.` : phrase[0].toUpperCase() + phrase.slice(1) + '.']
  }
  const again = circleCooks.filter(c => c.verdict === 'would_make_again').length
  return [lead, again > 0 ? `${again} would make it again.` : '']
}

function Avatars({ people }) {
  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      {people.slice(0, 3).map((p, i) => {
        const name = p?.full_name || p?.username || '?'
        return (
          <div key={p?.id || i} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid var(--warm-white)', marginLeft: i ? '-10px' : 0, overflow: 'hidden', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)' }}>
            {p?.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name[0].toUpperCase()}
          </div>
        )
      })}
    </div>
  )
}

// One card under the title: your verdict and what friends thought. Hidden when there's nothing to say.
function TakeSummary({ cooks, circleCooks, friendsWithIt, avatars, onYourTake, onCircle }) {
  const latest = cooks[0]
  const n = circleCooks.length
  if (!latest && n === 0 && !friendsWithIt) return null
  const yv = latest && YOUR_VERDICT[latest.verdict]
  const vs = latest && verdictOptions.find(o => o.value === latest.verdict)
  const row = { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', color: 'inherit' }
  const sub = { fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }
  const chevron = <IconChevronRight size={16} strokeWidth={2.4} style={{ color: 'var(--clay)', flexShrink: 0 }} />
  const savedOnly = Math.max(0, (friendsWithIt || 0) - n)
  const [lead, rest] = n > 0 ? friendsHeadline(circleCooks) : ['', '']
  return (
    <div style={{ background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px' }}>
      {latest && (
        <button onClick={onYourTake} style={row}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: vs?.bg || 'var(--parchment)', border: `1px solid ${vs?.border || 'var(--tan)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vs?.color || 'var(--charcoal)'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={yv?.icon || 'M5 12.5l4.5 4.5L19 7.5'} /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: vs?.color || 'var(--ink)' }}>{yv?.text || 'You made this'}</div>
            <div style={sub}>{cooks.length === 1 ? `Made once · ${shortDate(latest.cooked_at)}` : `Made ${cooks.length} times · last ${shortDate(latest.cooked_at)}`}</div>
          </div>
          {chevron}
        </button>
      )}
      {latest && (n > 0 || friendsWithIt > 0) && <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 16px' }} />}
      {(n > 0 || friendsWithIt > 0) && (
        <button onClick={onCircle} style={row}>
          <Avatars people={n > 0 ? circleCooks.map(c => c.profiles) : avatars} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {n > 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--ink)' }}><strong style={{ fontWeight: '700' }}>{lead}</strong>{rest ? ` ${rest}` : ''}</div>
            ) : (
              <div style={{ fontSize: '14px', color: 'var(--ink)' }}><strong style={{ fontWeight: '700' }}>{friendsWithIt} {friendsWithIt === 1 ? 'friend has' : 'friends have'} this.</strong></div>
            )}
            <div style={sub}>{n > 0 ? (savedOnly > 0 ? `${savedOnly} more saved it` : 'See what they thought') : 'Nobody has cooked it yet'}</div>
          </div>
          {chevron}
        </button>
      )}
    </div>
  )
}

// Your latest cook, labeled with its date.
const YourTake = forwardRef(function YourTake({ cook, times, onSeeAll }, ref) {
  const v = verdictOptions.find(o => o.value === cook.verdict)
  const filled = SLIDERS.filter(s => cook[s.key])
  return (
    <div ref={ref} style={{ scrollMarginTop: 'calc(var(--top-bar-h) + 12px)', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: filled.length || cook.notes ? '16px' : '12px' }}>
        <div>
          <div style={sectionLabelStyle}>Your take</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>From your latest cook, {shortDate(cook.cooked_at)}</div>
        </div>
        {v && <div style={{ background: v.bg, border: '1px solid ' + v.border, borderRadius: '100px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', color: v.color, whiteSpace: 'nowrap' }}>{v.label}</div>}
      </div>
      {filled.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: cook.notes ? '14px' : '4px' }}>
          {filled.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--charcoal)', width: '120px', flexShrink: 0 }}>{s.label}</span>
              <div aria-hidden="true" style={{ flex: 1, height: '6px', borderRadius: '100px', background: 'var(--parchment)', overflow: 'hidden' }}>
                <div style={{ width: `${cook[s.key] * 20}%`, height: '100%', background: 'var(--clay)', borderRadius: '100px' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: 'var(--clay)', width: '28px', textAlign: 'right', flexShrink: 0 }}>{cook[s.key]}/5</span>
            </div>
          ))}
        </div>
      )}
      {cook.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: '1.5' }}>"{cook.notes}"</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '4px', borderTop: '1px solid var(--parchment)' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)' }}>You've made this {times === 1 ? 'once' : `${times} times`}</span>
        {times > 1 && (
          <button className="nom-hit" onClick={onSeeAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', color: 'var(--clay)', padding: '12px 0' }}>See all cooks<IconChevronRight size={12} strokeWidth={2.4} style={{ marginLeft: '3px', marginTop: '-1px' }} /></button>
        )}
      </div>
    </div>
  )
})

const VERDICT_PHRASE = { would_make_again: 'would make it again', it_was_fine: 'thought it was fine', never_again: 'would never make it again' }

// "1 friend made this and would make it again."
// "4 friends made this. 3 would make it again, 1 thought it was fine."
// "3 friends made this. All 3 would make it again."
function CircleTally({ circleCooks }) {
  const n = circleCooks.length
  const count = k => circleCooks.filter(c => c.verdict === k).length
  const again = count('would_make_again'), fine = count('it_was_fine'), never = count('never_again')
  const parts = [
    again && `${again} ${VERDICT_PHRASE.would_make_again}`,
    fine && `${fine} ${VERDICT_PHRASE.it_was_fine}`,
    never && `${never} ${VERDICT_PHRASE.never_again}`,
  ].filter(Boolean)
  const only = [again, fine, never].filter(Boolean).length === 1
  const sentence = n === 1
    ? <><strong style={{ color: 'var(--ink)' }}>1 friend made this</strong>{VERDICT_PHRASE[circleCooks[0].verdict] ? ` and ${VERDICT_PHRASE[circleCooks[0].verdict]}.` : '.'}</>
    : <><strong style={{ color: 'var(--ink)' }}>{n} friends made this.</strong> {only && parts.length ? `All ${n} ${VERDICT_PHRASE[[['would_make_again', again], ['it_was_fine', fine], ['never_again', never]].find(([, c]) => c)[0]]}.` : parts.length ? parts.join(', ') + '.' : ''}</>
  const seg = (k, color) => count(k) > 0 && <div style={{ flex: count(k), background: color }} />
  return (
    <div style={{ background: 'var(--parchment)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.45', marginBottom: '8px' }}>
        {sentence}
      </div>
      <div role="img" aria-label={parts.join(', ')} style={{ display: 'flex', gap: '3px', height: '8px', borderRadius: '100px', overflow: 'hidden' }}>
        {seg('would_make_again', '#7A8C6E')}{seg('it_was_fine', '#E8A87C')}{seg('never_again', '#C47070')}
      </div>
    </div>
  )
}

// A friend's sliders as small chips: "Flavor 5 · Effort 4 ..."
function SliderChips({ cook, style }) {
  const filled = SLIDERS.filter(s => cook[s.key])
  if (filled.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', ...style }}>
      {filled.map(s => (
        <span key={s.key} style={{ padding: '3px 8px', borderRadius: '100px', background: 'var(--parchment)', fontSize: '11px', color: 'var(--charcoal)' }}>{s.short} <strong style={{ color: 'var(--clay)' }}>{cook[s.key]}</strong></span>
      ))}
    </div>
  )
}

export default function RecipeDetail({ recipe: initialRecipe, session, onBack, onUpdate, onSelectUser }) {
  const [recipe, setRecipe] = useState(initialRecipe)
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [verdict, setVerdict] = useState(null)
  const [scores, setScores] = useState({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 })
  const [cookNotes, setCookNotes] = useState('')
  const [shareToFeed, setShareToFeed] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [error, setError] = useState(null)
  const [editError, setEditError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [cooks, setCooks] = useState([])
  const [loadingCooks, setLoadingCooks] = useState(true)
  const [circleCooks, setCircleCooks] = useState([])
  const yourTakeRef = useRef(null)
  const circleRef = useRef(null)
  const historyRef = useRef(null)
  const [circleFriendsCount, setCircleFriendsCount] = useState(0)
  const [circleFriendAvatars, setCircleFriendAvatars] = useState([])
  const [showCircleModal, setShowCircleModal] = useState(false)
  const [availableTags, setAvailableTags] = useState(PRESET_TAGS)
  const [myProfile, setMyProfile] = useState(null)

  // Cook photo state
  const [cookPhotoFiles, setCookPhotoFiles] = useState([])
  const [cookPhotoPreviews, setCookPhotoPreviews] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const cookPhotoInputRef = useRef(null)
  const logButtonRef = useRef(null)
  const logFormRef = useRef(null)

  // Recipe thumbnail edit state
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const thumbnailInputRef = useRef(null)
  const editPhotoInputRef = useRef(null)
  const [editPhotoUploading, setEditPhotoUploading] = useState(false)

  // Photo overlay state
  const [overlayPhotos, setOverlayPhotos] = useState(null)
  const [overlayIndex, setOverlayIndex] = useState(0)
  const touchStartX = useRef(null)

  // Cook history menu state
  const [openCookMenuId, setOpenCookMenuId] = useState(null)
  const [deletingCookId, setDeletingCookId] = useState(null)
  const [editingCookId, setEditingCookId] = useState(null)
  const [editCookForm, setEditCookForm] = useState(null)
  const editCookPhotoInputRef = useRef(null)
  const [editCookPhotoFiles, setEditCookPhotoFiles] = useState([])
  const [editCookPhotoPreviews, setEditCookPhotoPreviews] = useState([])
  const [editCookUploading, setEditCookUploading] = useState(false)
  const [editCookSaving, setEditCookSaving] = useState(false)
  const [editCookError, setEditCookError] = useState(null)

  useEffect(() => {
    fetchUserTags()
    fetchMyProfile()
  }, [])

  // While editing the recipe or a cook, Back (button or swipe) closes the editor instead of leaving
  useEffect(() => {
    if (editing) return setBackGuard(() => { setEditing(false); setEditError(null); return true })
    if (editingCookId) return setBackGuard(() => { setEditingCookId(null); setEditCookForm(null); return true })
  }, [editing, editingCookId])

  function openEdit() {
    setEditForm({ title: recipe.title || '', source_name: recipe.source_name || '', source_url: recipe.source_url || '', image_url: recipe.image_url || '', cook_time: recipe.cook_time || '', prep_time: recipe.prep_time || '', difficulty: recipe.difficulty || '', ingredients: recipe.ingredients || '', instructions: recipe.instructions || '', notes: recipe.notes || '', tags: recipe.tags || [] })
    setEditing(true)
    window.scrollTo(0, 0)
  }

  async function fetchUserTags() {
    const { data } = await supabase.from('recipes').select('tags').eq('user_id', session.user.id)
    if (!data) return
    setAvailableTags(tagChoices(data.flatMap(r => r.tags || [])))
  }

  async function fetchMyProfile() {
    const { data } = await supabase.from('profiles')
      .select('id, full_name, username, avatar_url')
      .eq('id', session.user.id).single()
    if (data) setMyProfile(data)
  }

  const [editForm, setEditForm] = useState({
    title: recipe.title || '',
    source_name: recipe.source_name || '',
    source_url: recipe.source_url || '',
    image_url: recipe.image_url || '',
    cook_time: recipe.cook_time || '', prep_time: recipe.prep_time || '',
    difficulty: recipe.difficulty || '',
    ingredients: recipe.ingredients || '',
    instructions: recipe.instructions || '',
    notes: recipe.notes || '',
    tags: recipe.tags || [],
  })

  useEffect(() => {
      fetchCooks()
    if (recipe.canonical_id) fetchCircleCooks()
    if (recipe.canonical_id) fetchCircleFriends()
    upsertView()
  }, [recipe.id])

  // Close cook menu on outside click
  useEffect(() => {
    if (!openCookMenuId) return
    function handleClick() { setOpenCookMenuId(null) }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openCookMenuId])

  async function fetchCooks() {
    setLoadingCooks(true)
    const { data } = await supabase
      .from('cooks').select('*').eq('recipe_id', recipe.id)
      .order('cooked_at', { ascending: false })
    if (data) setCooks(data)
    setLoadingCooks(false)
  }

  async function fetchCircleCooks() {
    const { data: following } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!following || following.length === 0) return
    const followingIds = following.map(f => f.following_id)
    const { data: matchingRecipes } = await supabase
      .from('recipes').select('id, user_id')
      .eq('canonical_id', recipe.canonical_id).in('user_id', followingIds)
    if (!matchingRecipes || matchingRecipes.length === 0) return
    const recipeIds = matchingRecipes.map(r => r.id)
    const { data: cooksData } = await supabase
      .from('cooks').select('*')
      .in('recipe_id', recipeIds).order('cooked_at', { ascending: false })
    if (!cooksData || cooksData.length === 0) return
    const userIds = [...new Set(cooksData.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
    const timesByUser = {}
    for (const c of cooksData) timesByUser[c.user_id] = (timesByUser[c.user_id] || 0) + 1
    const cooksWithProfiles = cooksData.map(c => ({
      ...c, profiles: profiles?.find(p => p.id === c.user_id) || null, _times: timesByUser[c.user_id]
    }))
    const seen = new Set()
    const deduped = cooksWithProfiles.filter(c => {
      if (seen.has(c.user_id)) return false
      seen.add(c.user_id); return true
    })
    setCircleCooks(deduped)
    const allFriendIds = [...new Set(matchingRecipes.map(r => r.user_id))]
    const { data: teaserProfiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url').in('id', allFriendIds.slice(0, 3))
    setCircleFriendsCount(allFriendIds.length)
    setCircleFriendAvatars(teaserProfiles || [])
  }

  async function fetchCircleFriends() {
    if (!recipe.canonical_id) return
    const { data: following } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!following || following.length === 0) return
    const followingIds = following.map(f => f.following_id)
    const { data: matchingRecipes } = await supabase
      .from('recipes').select('id, user_id')
      .eq('canonical_id', recipe.canonical_id).in('user_id', followingIds)
    if (!matchingRecipes || matchingRecipes.length === 0) return
    const userIds = [...new Set(matchingRecipes.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url').in('id', userIds.slice(0, 3))
    setCircleFriendsCount(userIds.length)
    setCircleFriendAvatars(profiles || [])
  }

  async function upsertView() {
    await supabase.from('recipe_views').upsert(
      { user_id: session.user.id, recipe_id: recipe.id, viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,recipe_id' }
    )
  }

  // ---- PHOTO UPLOAD HELPERS ----

  async function uploadFileToStorage(file, bucket) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, await shrinkImage(file), { upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  function handleCookPhotoChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setCookPhotoFiles(files)
    setCookPhotoPreviews(files.map(f => URL.createObjectURL(f)))
  }

  function removeCookPhoto(index) {
    setCookPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setCookPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleThumbnailChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnailUploading(true)
    try {
      const url = await uploadFileToStorage(file, 'recipe-images')
      const { data } = await supabase
        .from('recipes').update({ image_url: url }).eq('id', recipe.id).select().single()
      if (data) { setRecipe(data); onUpdate() }
    } catch (err) {
      console.error('Thumbnail upload failed:', err)
    }
    setThumbnailUploading(false)
    e.target.value = ''
  }

  // ---- PHOTO OVERLAY ----

  function openOverlay(photos, startIndex) {
    setOverlayPhotos(photos)
    setOverlayIndex(startIndex)
  }

  function closeOverlay() {
    setOverlayPhotos(null)
    setOverlayIndex(0)
  }

  function overlayNext() {
    setOverlayIndex(i => (i + 1) % overlayPhotos.length)
  }

  function overlayPrev() {
    setOverlayIndex(i => (i - 1 + overlayPhotos.length) % overlayPhotos.length)
  }

  function handleOverlayTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleOverlayTouchEnd(e) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      diff > 0 ? overlayNext() : overlayPrev()
    }
    touchStartX.current = null
  }

  // ---- DELETE COOK ----

  async function deleteCook(cookId) {
    setDeletingCookId(cookId)
    setOpenCookMenuId(null)
    const { data, error } = await supabase.from('cooks').delete().eq('id', cookId).select('id')
    if (error || !data?.length) {
      setDeletingCookId(null)
      toast("Couldn't delete this cook. Try again?", { icon: null })
      return
    }
    await fetchCooks()
    onUpdate()
    setDeletingCookId(null)
  }

  function startEditCook(cook) {
  setEditingCookId(cook.id)
  setEditCookForm({
    verdict: cook.verdict || null,
    flavor: cook.flavor || 0,
    effort: cook.effort || 0,
    would_share: cook.would_share || 0,
    true_to_recipe: cook.true_to_recipe || 0,
    notes: cook.notes || '',
    existingPhotos: cook.photo_urls || [],
  })
  setEditCookPhotoFiles([])
  setEditCookPhotoPreviews([])
  setEditCookError(null)
  setOpenCookMenuId(null)
}

async function saveEditCook() {
  if (!editCookForm.verdict) { setEditCookError('Please select a verdict.'); return }
  setEditCookSaving(true)
  setEditCookError(null)

  let newPhotoUrls = []
  if (editCookPhotoFiles.length > 0) {
    setEditCookUploading(true)
    try {
      newPhotoUrls = await Promise.all(
        editCookPhotoFiles.map(f => uploadFileToStorage(f, 'cook-photos'))
      )
    } catch (err) {
      setEditCookError('Photo upload failed. Try again.')
      setEditCookUploading(false)
      setEditCookSaving(false)
      return
    }
    setEditCookUploading(false)
  }

  const allPhotos = [...editCookForm.existingPhotos, ...newPhotoUrls]
  const newStatus = editCookForm.verdict === 'never_again' ? 'never_again' : 'cooked'

  try {
    const { error: cookUpdateError } = await supabase.from('cooks').update({
      verdict: editCookForm.verdict,
      flavor: editCookForm.flavor || null,
      effort: editCookForm.effort || null,
      would_share: editCookForm.would_share || null,
      true_to_recipe: editCookForm.true_to_recipe || null,
      notes: editCookForm.notes || null,
      photo_urls: allPhotos.length > 0 ? allPhotos : null,
    }).eq('id', editingCookId)
    if (cookUpdateError) throw new Error(cookUpdateError.message)

    await supabase.from('recipes')
      .update({ status: newStatus }).eq('id', recipe.id)

    setEditingCookId(null)
    setEditCookForm(null)
    setEditCookPhotoFiles([])
    setEditCookPhotoPreviews([])
    await fetchCooks()
    onUpdate()
  } catch(err) {
    setEditCookError('Failed to save. Try again.')
  }
  setEditCookSaving(false)
}

  // ---- LOG COOK ----

  async function logCook() {
    if (!verdict) { setError('Please select a verdict.'); return }
    setSaving(true)
    setError(null)

    let photoUrls = []
    if (cookPhotoFiles.length > 0) {
      setUploadingPhotos(true)
      try {
        photoUrls = await Promise.all(
          cookPhotoFiles.map(f => uploadFileToStorage(f, 'cook-photos'))
        )
      } catch (err) {
        setError('Photo upload failed. Try again.')
        setUploadingPhotos(false)
        setSaving(false)
        return
      }
      setUploadingPhotos(false)
    }

    const newStatus = verdict === 'never_again' ? 'never_again' : 'cooked'

    const { error: cookError } = await supabase.from('cooks').insert({
      user_id: session.user.id,
      recipe_id: recipe.id,
      verdict,
      flavor: scores.flavor || null,
      effort: scores.effort || null,
      would_share: scores.would_share || null,
      true_to_recipe: scores.true_to_recipe || null,
      notes: cookNotes || null,
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
      ...(shareToFeed ? {} : { shared_to_feed: false }),
    })

    if (cookError) { setError(cookError.message); setSaving(false); return }

    await supabase.from('recipes')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', recipe.id)

    success()
    maybeAskForRating(session.user.id, verdict)
    setLogging(false)
    setVerdict(null)
    setScores({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 })
    setCookNotes('')
    setShareToFeed(true)
    setCookPhotoFiles([])
    setCookPhotoPreviews([])
    await fetchCooks()
    onUpdate()
    setSaving(false)
  }

  // ---- SAVE EDIT ----

  async function saveEdit() {
    if (!editForm.title.trim()) { setEditError('Title is required.'); return }
    setSavingEdit(true)
    setEditError(null)
    const { data, error } = await supabase
      .from('recipes').update({
        title: editForm.title.trim(),
        source_name: editForm.source_name.trim() || null,
        source_url: editForm.source_url.trim() || null,
        image_url: editForm.image_url.trim() || null,
        cook_time: editForm.cook_time.trim() || null,
        prep_time: (editForm.prep_time || '').trim() || null,
        difficulty: editForm.difficulty.trim() || null,
        ingredients: editForm.ingredients.trim() || null,
        instructions: editForm.instructions.trim() || null,
        notes: editForm.notes.trim() || null,
        tags: editForm.tags || [],
        updated_at: new Date().toISOString()
      }).eq('id', recipe.id).select().single()
    if (error) { setEditError(error.message); setSavingEdit(false); return }
    setRecipe(data)
    setEditing(false)
    setSavingEdit(false)
    onUpdate()
  }

  async function deleteRecipe() {
    if (!(await confirmSheet({ title: 'Remove this recipe?', confirmLabel: 'Remove', destructive: true }))) return
    setDeleting(true)
    // .select() returns the deleted rows, so a delete that quietly removed
    // nothing (no error, but zero rows) counts as a failure too
    const { data, error } = await supabase.from('recipes').delete().eq('id', recipe.id).select('id')
    if (error || !data?.length) {
      setDeleting(false)
      toast("Couldn't remove this recipe. Try again?", { icon: null })
      return
    }
    onBack()
  }

  const statusColors = {
    cooked: { bg: '#EEF4E5', color: '#4A5E42', border: '#7A8C6E', label: 'Cooked' },
    want_to_make: { bg: 'var(--parchment)', color: 'var(--charcoal)', border: 'var(--tan)', label: 'Want to Make' },
    never_again: { bg: '#F4E8E8', color: '#9B4040', border: '#C47070', label: 'Never Again' },
  }

  const status = statusColors[recipe.status] || statusColors.want_to_make

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
    background: 'var(--cream)', fontFamily: 'var(--font-body)',
    fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box'
  }

  const textareaStyle = { ...inputStyle, resize: 'vertical', lineHeight: '1.6' }

  const fieldLabel = {
    display: 'block', fontSize: '12px', fontWeight: '600',
    color: 'var(--charcoal)', marginBottom: '6px', letterSpacing: '0.04em'
  }

// ---- EDIT COOK MODE ----
  if (editingCookId && editCookForm) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '40px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--parchment)', marginTop: 'var(--top-bar-h)' }}>
            <button onClick={() => { setEditingCookId(null); setEditCookForm(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--muted)', padding: 0 }}>Cancel</button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700', color: 'var(--ink)' }}>Edit cook</div>
            <div style={{ width: '48px' }} />
          </div>

          <div style={{ padding: '24px 20px calc(var(--nav-clearance) + 20px) 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Photos */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Photos</div>
              <input ref={editCookPhotoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || [])
                  if (files.length === 0) return
                  setEditCookPhotoFiles(prev => [...prev, ...files])
                  setEditCookPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
                }}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {editCookForm.existingPhotos.map((url, i) => (
                  <div key={`existing-${i}`} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
                    <img loading="lazy" decoding="async" src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button className="nom-hit" aria-label="Remove photo" onClick={() => setEditCookForm(f => ({ ...f, existingPhotos: f.existingPhotos.filter((_, j) => j !== i) }))}
                      style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}><IconX size={10} strokeWidth={2.2} /></button>
                  </div>
                ))}
                {editCookPhotoPreviews.map((src, i) => (
                  <div key={`new-${i}`} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
                    <img loading="lazy" decoding="async" src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button className="nom-hit" aria-label="Remove photo" onClick={() => {
                      setEditCookPhotoFiles(prev => prev.filter((_, j) => j !== i))
                      setEditCookPhotoPreviews(prev => prev.filter((_, j) => j !== i))
                    }} style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}><IconX size={10} strokeWidth={2.2} /></button>
                  </div>
                ))}
                <button aria-label="Add photo" onClick={() => editCookPhotoInputRef.current?.click()} style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-md)', border: '1.5px dashed var(--tan)', background: 'var(--parchment)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>

            {/* Verdict */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>The verdict</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {verdictOptions.map(v => (
                  <button key={v.value} onClick={() => setEditCookForm(f => ({ ...f, verdict: v.value }))} style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: `2px solid ${editCookForm.verdict === v.value ? v.border : 'var(--parchment)'}`, background: editCookForm.verdict === v.value ? v.bg : 'var(--cream)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: editCookForm.verdict === v.value ? v.color : 'var(--ink)' }}>{v.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{v.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nuance scores */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Nuance scores</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {nuanceCategories.map(cat => (
                  <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--charcoal)', flex: 1, minWidth: 0 }}>{cat.label}</span>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setEditCookForm(f => ({ ...f, [cat.key]: n }))} style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid ${editCookForm[cat.key] >= n ? 'var(--clay)' : 'var(--tan)'}`, background: editCookForm[cat.key] >= n ? 'var(--clay)' : 'transparent', color: editCookForm[cat.key] >= n ? 'var(--cream)' : 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>{n}</button>
                      ))}
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: 'var(--clay)', width: '36px', flexShrink: 0, whiteSpace: 'nowrap', textAlign: 'right' }}>{editCookForm[cat.key] > 0 ? `${editCookForm[cat.key]}/5` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>Cook notes</label>
              <textarea value={editCookForm.notes} onChange={e => setEditCookForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="What did you tweak? Would you change anything?" style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            {editCookError && <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252' }}>{editCookError}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={saveEditCook} disabled={editCookSaving} style={{ flex: 1, padding: '13px', background: editCookSaving ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: editCookSaving ? 'not-allowed' : 'pointer' }}>{editCookUploading ? 'Uploading photos...' : editCookSaving ? 'Saving...' : 'Save changes'}</button>
              <button onClick={() => { setEditingCookId(null); setEditCookForm(null) }} style={{ padding: '13px 20px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            </div>

          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ---- EDIT MODE ----
  if (editing) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '40px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--parchment)', marginTop: 'var(--top-bar-h)' }}>
            <button onClick={() => { setEditing(false); setEditError(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--muted)', padding: 0 }}>Cancel</button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700', color: 'var(--ink)' }}>Edit recipe</div>
            <div style={{ width: '48px' }} />
          </div>
          <div style={{ padding: '24px 20px calc(var(--nav-clearance) + 20px) 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={fieldLabel}>Title</label>
              <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            </div>
          <div>
            <label style={fieldLabel}>Image</label>
            <input
              ref={editPhotoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                setEditPhotoUploading(true)
                const ext = file.name.split('.').pop() || 'jpg'
                const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                const { error } = await supabase.storage.from('recipe-images').upload(path, await shrinkImage(file), { upsert: false })
                if (!error) {
                  const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
                  setEditForm(f => ({ ...f, image_url: data.publicUrl }))
                }
                setEditPhotoUploading(false)
                e.target.value = ''
              }}
            />
            {editForm.image_url ? (
              <div style={{ position: 'relative', height: '160px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '8px' }}>
                <img loading="lazy" decoding="async" src={editForm.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                <button className="nom-hit" aria-label="Remove photo" onClick={() => setEditForm(f => ({ ...f, image_url: '' }))} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={11} strokeWidth={2.2} /></button>
                <button className="nom-hit" aria-label="Change photo" onClick={() => editPhotoInputRef.current?.click()} style={{ position: 'absolute', top: '8px', right: '44px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            ) : (
              <button onClick={() => editPhotoInputRef.current?.click()} disabled={editPhotoUploading} style={{ width: '100%', padding: '14px', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--parchment)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="var(--muted)" strokeWidth="1.8"/></svg>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)' }}>{editPhotoUploading ? 'Uploading...' : 'Upload photo'}</span>
              </button>
            )}
            <input value={editForm.image_url} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} placeholder="Or paste a URL: https://..." style={inputStyle} />
          </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Source name</label>
                <input value={editForm.source_name} onChange={e => setEditForm(f => ({ ...f, source_name: e.target.value }))} placeholder="e.g. NYT Cooking" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Source URL</label>
              <input value={editForm.source_url} onChange={e => setEditForm(f => ({ ...f, source_url: e.target.value }))} placeholder="https://..." style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Prep time</label>
                <input value={editForm.prep_time} onChange={e => setEditForm(f => ({ ...f, prep_time: e.target.value }))} placeholder="e.g. 15 min" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Total time</label>
                <input value={editForm.cook_time} onChange={e => setEditForm(f => ({ ...f, cook_time: e.target.value }))} placeholder="e.g. 45 min" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Difficulty</label>
              <input value={editForm.difficulty} onChange={e => setEditForm(f => ({ ...f, difficulty: e.target.value }))} placeholder="e.g. Easy" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Ingredients</label>
              <SectionTextarea value={editForm.ingredients} onChange={v => setEditForm(f => ({ ...f, ingredients: v }))} rows={8} placeholder="One ingredient per line" style={textareaStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Instructions</label>
              <SectionTextarea value={editForm.instructions} onChange={v => setEditForm(f => ({ ...f, instructions: v }))} rows={10} placeholder="One step per line" style={textareaStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {availableTags.map(tag => {
                  const selected = hasTag(editForm.tags, tag)
                  return (
                    <button key={tag} onClick={() => {
                      const current = editForm.tags || []
                      setEditForm(f => ({ ...f, tags: selected ? current.filter(t => tagKey(t) !== tagKey(tag)) : [...current, tag] }))
                    }} style={{ padding: '5px 12px', border: '1.5px solid', borderColor: selected ? 'var(--clay)' : 'var(--tan)', borderRadius: 'var(--radius-pill)', background: selected ? 'var(--clay)' : 'transparent', color: selected ? 'var(--cream)' : 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{tag}</button>
                  )
                })}
              </div>
              <input placeholder="+ Add custom tag" style={{ ...inputStyle, fontSize: '13px' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const typed = e.target.value
                    setEditForm(f => ({ ...f, tags: addTag(f.tags, typed, availableTags) }))
                    e.target.value = ''
                  }
                }} />
              {(editForm.tags || []).filter(t => !hasTag(availableTags, t)).map(tag => (
                <div key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', marginRight: '6px', padding: '4px 10px', background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', fontSize: '12px', color: 'var(--charcoal)' }}>
                  {tag}
                  <button className="nom-hit" aria-label="Remove tag" onClick={() => setEditForm(f => ({ ...f, tags: (f.tags || []).filter(t => t !== tag) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', lineHeight: 1, padding: 0 }}><IconX size={11} strokeWidth={2.2} /></button>
                </div>
              ))}
            </div>
            <div>
              <label style={fieldLabel}>Recipe notes</label>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', marginTop: '-4px' }}>Private notes. Only you can see these.</div>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Tweaks, substitutions, context..." style={textareaStyle} />
            </div>
            {editError && (
              <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252' }}>{editError}</div>
            )}
            <button onClick={saveEdit} disabled={savingEdit} style={{ width: '100%', padding: '14px', background: savingEdit ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: savingEdit ? 'not-allowed' : 'pointer' }}>{savingEdit ? 'Saving...' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ---- NORMAL VIEW ----
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: 'calc(var(--nav-clearance) + 20px)' }}>

      {/* Photo overlay */}
      {overlayPhotos && (
        <div
          onClick={closeOverlay}
          onTouchStart={handleOverlayTouchStart}
          onTouchEnd={handleOverlayTouchEnd}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button className="nom-hit" aria-label="Close photo" onClick={closeOverlay} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={16} strokeWidth={2.2} /></button>
          <img loading="lazy" decoding="async"
            src={overlayPhotos[overlayIndex]}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: '8px' }}
          />
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

      {/* Hidden file inputs */}
      <input ref={thumbnailInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleThumbnailChange} />
      <input ref={cookPhotoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleCookPhotoChange} />

      {/* Hero strip or fallback */}
      {(() => {
        const stockCard = recipe.image_url ? [{ url: recipe.image_url, isStock: true, profile: null, isMe: false }] : []
        const myPhotos = cooks.flatMap(c => (c.photo_urls || []).map(url => ({ url, isStock: false, profile: null, isMe: true })))
        const circlePhotos = circleCooks
          .filter(c => c.photo_urls?.length > 0)
          .map(c => ({ url: c.photo_urls[0], isStock: false, profile: c.profiles, isMe: false }))
        const stripPhotos = [...stockCard, ...myPhotos, ...circlePhotos]
        const hasCookPhotos = myPhotos.length > 0 || circlePhotos.length > 0

        if (!hasCookPhotos) {
          // Fallback: stock hero as today
          return recipe.image_url ? (
            <div style={{ height: '220px', background: 'var(--parchment)', position: 'relative', overflow: 'hidden', marginTop: 'var(--top-bar-h)' }}>
              <img loading="lazy" decoding="async" src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none' }} />
              <button className="nom-hit" aria-label="Change photo" onClick={() => thumbnailInputRef.current?.click()} disabled={thumbnailUploading} style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(28,26,23,0.55)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                {thumbnailUploading
                  ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </button>
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-pill)', padding: '3px 8px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600', color: 'white' }}>Recipe photo</span>
              </div>
              {recipe.status === 'want_to_make' && <div style={{ position: 'absolute', bottom: '16px', right: '10px', background: status.bg, border: `1px solid ${status.border}`, color: status.color, borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: '11px', fontWeight: '600' }}>{status.label}</div>}
            </div>
          ) : (
            <div style={{ padding: 'calc(var(--top-bar-h) + 16px) 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={() => thumbnailInputRef.current?.click()} disabled={thumbnailUploading} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--parchment)', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', color: 'var(--muted)', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"/></svg>
                {thumbnailUploading ? 'Uploading...' : 'Add photo'}
              </button>
            </div>
          )
        }

        // Strip with cook photos
        return (
          <div style={{ marginTop: 'var(--top-bar-h)', position: 'relative' }}>
            <div style={{ overflowX: 'auto', display: 'flex', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingLeft: '16px', paddingBottom: '4px' }}>
              {stripPhotos.map((photo, i) => {
                const allUrls = stripPhotos.map(p => p.url)
                return (
                  <div key={i} onClick={() => openOverlay(allUrls, i)} style={{ position: 'relative', flexShrink: 0, width: '85vw', maxWidth: '400px', height: '240px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginRight: '10px', cursor: 'pointer', background: 'var(--parchment)' }}>
                    <img loading="lazy" decoding="async" src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                    {photo.isStock && (
                      <>
                        <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-pill)', padding: '3px 8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '600', color: 'white' }}>Recipe photo</span>
                        </div>
                        <button className="nom-hit" aria-label="Change photo" onClick={e => { e.stopPropagation(); thumbnailInputRef.current?.click() }} disabled={thumbnailUploading} style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(28,26,23,0.55)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        {recipe.status === 'want_to_make' && <div style={{ position: 'absolute', bottom: '16px', right: '10px', background: status.bg, border: `1px solid ${status.border}`, color: status.color, borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: '11px', fontWeight: '600' }}>{status.label}</div>}
                      </>
                    )}
                    {photo.isMe && (
                      <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-pill)', padding: '4px 10px 4px 4px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1.5px solid white', overflow: 'hidden', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {myProfile?.avatar_url
                            ? <img loading="lazy" decoding="async" src={myProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                            : <span style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: '700', color: 'var(--cream)' }}>{(myProfile?.full_name || myProfile?.username || session.user.email || '?')[0].toUpperCase()}</span>
                          }
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'white' }}>Made by You</span>
                      </div>
                    )}
                    {!photo.isStock && !photo.isMe && photo.profile && (
                      <div onClick={e => { e.stopPropagation(); onSelectUser && onSelectUser(photo.profile.id) }}
                        style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-pill)', padding: '4px 10px 4px 4px', cursor: 'pointer' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1.5px solid white', overflow: 'hidden', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {photo.profile.avatar_url
                            ? <img loading="lazy" decoding="async" src={photo.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                            : <span style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: '700', color: 'var(--cream)' }}>{(photo.profile.full_name || photo.profile.username || '?')[0].toUpperCase()}</span>
                          }
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'white' }}>Made by {photo.profile.full_name || photo.profile.username}</span>
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ flexShrink: 0, width: '6px' }} />
            </div>
          </div>
        )
      })()}

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px' }}>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.15', letterSpacing: '-0.5px', marginBottom: '12px' }}>{recipe.title}</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* One info line: source (opens the original), times, difficulty, tags */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '4px 6px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px', color: 'var(--muted)' }}>
              {recipe.source_url ? (
                <a {...linkProps(recipe.source_url)} style={{ color: 'var(--clay)', fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  {recipe.source_name || 'Original recipe'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
                </a>
              ) : recipe.source_name ? <span>{recipe.source_name}</span> : null}
              <RecipeTimes prep={recipe.prep_time} total={recipe.cook_time} />
              {recipe.difficulty && <span>· {recipe.difficulty}</span>}
              {(recipe.tags || []).map(tag => <span key={tag}>· {tag}</span>)}
            </div>
            <button aria-label="Edit recipe" onClick={openEdit} style={roundIconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
            </button>
            <button aria-label="Share" onClick={() => {
              const url = `/?recipe=${recipe.id}`
              const fullUrl = `https://www.nomrecipeapp.com${url}`
              if (navigator.share) {
                navigator.share({ title: recipe.title, url: fullUrl }).catch(() => {})
              } else {
                navigator.clipboard.writeText(fullUrl).then(() => toast('Link copied'))
              }
            }} style={roundIconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="var(--charcoal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {showCircleModal && (
          <CircleFriendsModal canonicalId={recipe.canonical_id} sourceUrl={recipe.source_url} session={session} onClose={() => setShowCircleModal(false)} onSelectUser={onSelectUser} />
        )}

        <TakeSummary cooks={cooks} circleCooks={circleCooks} friendsWithIt={circleFriendsCount} avatars={circleFriendAvatars}
          onYourTake={() => scrollToRef(yourTakeRef)}
          onCircle={() => circleCooks.length > 0 ? scrollToRef(circleRef) : setShowCircleModal(true)} />

        {!logging && (
          <div style={{ marginBottom: '24px' }}>
            <button ref={logButtonRef} onClick={() => setLogging(true)} style={{ width: '100%', padding: '17px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 6px 18px rgba(196,113,58,0.28)' }}>
              <IconPot size={20} strokeWidth={2} />Log a Cook
            </button>
            {cooks.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '8px' }}>Made it? Give it your verdict.</div>
            )}
          </div>
        )}

        {logging && (
          <div ref={logFormRef} style={{ scrollMarginTop: 'calc(var(--top-bar-h) + 12px)', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '24px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Photos</div>
              {cookPhotoPreviews.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {cookPhotoPreviews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
                      <img loading="lazy" decoding="async" src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button className="nom-hit" aria-label="Remove photo" onClick={() => removeCookPhoto(i)} style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}><IconX size={10} strokeWidth={2.2} /></button>
                    </div>
                  ))}
                  <button aria-label="Add photo" onClick={() => cookPhotoInputRef.current?.click()} style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-md)', border: '1.5px dashed var(--tan)', background: 'var(--parchment)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => cookPhotoInputRef.current?.click()} style={{ width: '100%', padding: '16px', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--parchment)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="var(--muted)" strokeWidth="1.8"/></svg>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)' }}>Add photos</span>
                </button>
              )}
            </div>

            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>The verdict</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {verdictOptions.map(v => (
                <button key={v.value} onClick={() => { tap(); setVerdict(v.value) }} style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: `2px solid ${verdict === v.value ? v.border : 'var(--parchment)'}`, background: verdict === v.value ? v.bg : 'var(--cream)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: verdict === v.value ? v.color : 'var(--ink)' }}>{v.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{v.sub}</div>
                </button>
              ))}
            </div>

            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>Nuance scores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              {nuanceCategories.map(cat => (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--charcoal)', flex: 1, minWidth: 0 }}>{cat.label}</span>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => { tap(); setScores(s => ({...s, [cat.key]: n})) }} style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid ${scores[cat.key] >= n ? 'var(--clay)' : 'var(--tan)'}`, background: scores[cat.key] >= n ? 'var(--clay)' : 'transparent', color: scores[cat.key] >= n ? 'var(--cream)' : 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>{n}</button>
                    ))}
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: 'var(--clay)', width: '36px', flexShrink: 0, whiteSpace: 'nowrap', textAlign: 'right' }}>{scores[cat.key] > 0 ? `${scores[cat.key]}/5` : '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '2px', letterSpacing: '0.04em' }}>Cook notes</label>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>How did this cook go? Friends see this with your cook.</div>
              <textarea value={cookNotes} onChange={e => setCookNotes(e.target.value)} placeholder="What did you tweak? Would you change anything?" rows={3} style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none', resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <ShareToFeedToggle value={shareToFeed} onChange={setShareToFeed} />
            </div>

            {error && <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', marginBottom: '16px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={logCook} disabled={saving} style={{ flex: 1, padding: '13px', background: saving ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{uploadingPhotos ? 'Uploading photos...' : saving ? 'Saving...' : 'Save cook'}</button>
              <button onClick={() => { setLogging(false); setError(null); setCookPhotoFiles([]); setCookPhotoPreviews([]) }} style={{ padding: '13px 20px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {recipe.ingredients && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Ingredients</div>
              <CopyIngredientsButton text={recipe.ingredients} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <IngredientList text={recipe.ingredients} />
            </div>
          </div>
        )}

        {recipe.instructions && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>Instructions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <InstructionList text={recipe.instructions} />
            </div>
          </div>
        )}

        {cooks.length > 0 && (
          <YourTake ref={yourTakeRef} cook={cooks[0]} times={cooks.length} onSeeAll={() => scrollToRef(historyRef)} />
        )}

        {circleCooks.length > 0 && (
          <div ref={circleRef} style={{ scrollMarginTop: 'calc(var(--top-bar-h) + 12px)', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>From your circle</div>
              {(circleCooks.length > 3 || circleFriendsCount > circleCooks.length) && <button className="nom-hit" onClick={() => setShowCircleModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--clay)', padding: 0 }}>See all {Math.max(circleFriendsCount, circleCooks.length)}<IconChevronRight size={12} strokeWidth={2.4} style={{ marginLeft: '3px', marginTop: '-1px' }} /></button>}
            </div>
            <CircleTally circleCooks={circleCooks} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {circleCooks.slice(0, 3).map((c, i) => {
                const v = verdictStyles[c.verdict]
                const name = c.profiles?.full_name || c.profiles?.username || 'Someone'
                return (
                  <div key={c.id} style={{ paddingBottom: i < Math.min(circleCooks.length, 3) - 1 ? '14px' : '0', borderBottom: i < Math.min(circleCooks.length, 3) - 1 ? '1px solid var(--parchment)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{name[0].toUpperCase()}</div>
                        <div style={{ minWidth: 0 }}>
                          <span onClick={() => onSelectUser && onSelectUser(c.user_id)} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--tan)' }}>{name}</span>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{shortDate(c.cooked_at)}{c._times >= 2 ? ` · ${ordinal(c._times)} time` : ''}</div>
                        </div>
                      </div>
                      {v && <div style={{ background: v.bg, border: '1px solid ' + v.border, borderRadius: '100px', padding: '2px 8px', fontSize: '10px', fontWeight: '700', color: v.color }}>{v.label}</div>}
                    </div>
                    {c.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: '1.5', paddingLeft: '36px' }}>"{c.notes}"</div>}
                    <SliderChips cook={c} style={{ paddingLeft: '36px', marginTop: '6px' }} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {recipe.notes && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '2px' }}>Recipe notes</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>Private notes. Only you can see these.</div>
            <div style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.6', fontStyle: 'italic' }}>"{recipe.notes}"</div>
          </div>
        )}

        {/* Cook history */}
        {cooks.length > 0 && (
          <div ref={historyRef} style={{ scrollMarginTop: 'calc(var(--top-bar-h) + 12px)', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>Cook history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cooks.map((cook, i) => {
                const v = verdictOptions.find(v => v.value === cook.verdict)
                const isDeleting = deletingCookId === cook.id
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
                  <div key={cook.id} style={{ paddingBottom: i < cooks.length - 1 ? '12px' : '0', borderBottom: i < cooks.length - 1 ? '1px solid var(--parchment)' : 'none', opacity: isDeleting ? 0.4 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: v?.bg || 'var(--parchment)', border: `1px solid ${v?.border || 'var(--tan)'}`, fontSize: '11px', fontWeight: '600', color: v?.color || 'var(--charcoal)' }}>{v?.label || cook.verdict}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date(cook.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {/* ⋯ menu */}
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setOpenCookMenuId(openCookMenuId === cook.id ? null : cook.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', padding: '0 2px', lineHeight: 1, fontWeight: '700' }}>⋯</button>
                          {openCookMenuId === cook.id && (
                            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-md)', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '120px', overflow: 'hidden' }}>
                              <button
                                onClick={() => startEditCook(cook)}
                                style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '500', color: 'var(--ink)', cursor: 'pointer', borderBottom: '1px solid var(--parchment)' }}
                              >Edit</button>
                              <button
                                onClick={() => deleteCook(cook.id)}
                                style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '500', color: '#B85252', cursor: 'pointer' }}
                              >Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Cook photos */}
                    {cook.photo_urls && cook.photo_urls.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        {cook.photo_urls.map((url, pi) => (
                          <img loading="lazy" decoding="async"
                            key={pi}
                            src={url}
                            alt=""
                            onClick={() => openOverlay(cook.photo_urls, pi)}
                            style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                          />
                        ))}
                      </div>
                    )}
                    {(cook.flavor || cook.effort || cook.would_share || cook.true_to_recipe) && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {[{ key: 'flavor', label: 'Flavor' }, { key: 'effort', label: 'Effort' }, { key: 'would_share', label: 'Share' }, { key: 'true_to_recipe', label: 'True to Recipe' }].map(s => cook[s.key] ? (
                          <span key={s.key} style={{ fontSize: '11px', color: 'var(--muted)' }}>{s.label} <strong style={{ color: 'var(--clay)' }}>{cook[s.key]}/5</strong></span>
                        ) : null)}
                      </div>
                    )}
                    {cook.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: '1.5' }}>"{cook.notes}"</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button onClick={deleteRecipe} disabled={deleting} style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--parchment)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: deleting ? 'not-allowed' : 'pointer', marginTop: '8px' }}>{deleting ? 'Removing...' : 'Remove from Cookbook'}</button>

        <FloatingAction
          anchorRef={logButtonRef}
          show={!logging}
          label="Log a Cook"
          icon={IconPot}
          onClick={() => {
            setLogging(true)
            requestAnimationFrame(() => logFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
          }}
        />

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}