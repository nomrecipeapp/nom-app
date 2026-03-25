import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import CircleFriendsModal from './CircleFriendsModal'

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

const PRESET_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Appetizer', 'Dessert', 'Baking', 'Cocktail']

export default function RecipeDetail({ recipe: initialRecipe, session, onBack, onUpdate, onSelectUser }) {
  const [recipe, setRecipe] = useState(initialRecipe)
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [verdict, setVerdict] = useState(null)
  const [scores, setScores] = useState({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 })
  const [cookNotes, setCookNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [error, setError] = useState(null)
  const [editError, setEditError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [cooks, setCooks] = useState([])
  const [loadingCooks, setLoadingCooks] = useState(true)
  const [circleCooks, setCircleCooks] = useState([])
  const [circleFriendsCount, setCircleFriendsCount] = useState(0)
  const [circleFriendAvatars, setCircleFriendAvatars] = useState([])
  const [showCircleModal, setShowCircleModal] = useState(false)
  const [availableTags, setAvailableTags] = useState(PRESET_TAGS)

  // Cook photo state
  const [cookPhotoFiles, setCookPhotoFiles] = useState([])
  const [cookPhotoPreviews, setCookPhotoPreviews] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const cookPhotoInputRef = useRef(null)

  // Recipe thumbnail edit state
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const thumbnailInputRef = useRef(null)

  // Photo overlay state
  const [overlayPhotos, setOverlayPhotos] = useState(null)
  const [overlayIndex, setOverlayIndex] = useState(0)
  const touchStartX = useRef(null)

  // Cook history menu state
  const [openCookMenuId, setOpenCookMenuId] = useState(null)
  const [deletingCookId, setDeletingCookId] = useState(null)

  useEffect(() => {
    fetchUserTags()
  }, [])

  async function fetchUserTags() {
    const { data } = await supabase.from('recipes').select('tags').eq('user_id', session.user.id)
    if (!data) return
    const customTags = [...new Set(data.flatMap(r => r.tags || []).filter(t => !PRESET_TAGS.includes(t)))]
    if (customTags.length > 0) setAvailableTags([...PRESET_TAGS, ...customTags])
  }

  const [editForm, setEditForm] = useState({
    title: recipe.title || '',
    source_name: recipe.source_name || '',
    source_url: recipe.source_url || '',
    image_url: recipe.image_url || '',
    cook_time: recipe.cook_time || '',
    difficulty: recipe.difficulty || '',
    ingredients: recipe.ingredients || '',
    instructions: recipe.instructions || '',
    notes: recipe.notes || '',
    tags: recipe.tags || [],
  })

  useEffect(() => {
    fetchCooks()
    if (recipe.source_url) fetchCircleCooks()
    if (recipe.source_url) fetchCircleFriends()
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
      .eq('source_url', recipe.source_url).in('user_id', followingIds)
    if (!matchingRecipes || matchingRecipes.length === 0) return
    const recipeIds = matchingRecipes.map(r => r.id)
    const { data: cooksData } = await supabase
      .from('cooks').select('*')
      .in('recipe_id', recipeIds).order('cooked_at', { ascending: false })
    if (!cooksData || cooksData.length === 0) return
    const userIds = [...new Set(cooksData.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username').in('id', userIds)
    const cooksWithProfiles = cooksData.map(c => ({
      ...c, profiles: profiles?.find(p => p.id === c.user_id) || null
    }))
    const seen = new Set()
    const deduped = cooksWithProfiles.filter(c => {
      if (seen.has(c.user_id)) return false
      seen.add(c.user_id); return true
    })
    setCircleCooks(deduped)
    const allFriendIds = [...new Set(matchingRecipes.map(r => r.user_id))]
    const { data: teaserProfiles } = await supabase
      .from('profiles').select('id, full_name, username').in('id', allFriendIds.slice(0, 3))
    setCircleFriendsCount(allFriendIds.length)
    setCircleFriendAvatars(teaserProfiles || [])
  }

  async function fetchCircleFriends() {
    if (!recipe.source_url) return
    const { data: following } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!following || following.length === 0) return
    const followingIds = following.map(f => f.following_id)
    const { data: matchingRecipes } = await supabase
      .from('recipes').select('id, user_id')
      .eq('source_url', recipe.source_url).in('user_id', followingIds)
    if (!matchingRecipes || matchingRecipes.length === 0) return
    const userIds = [...new Set(matchingRecipes.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username').in('id', userIds.slice(0, 3))
    setCircleFriendsCount(userIds.length)
    setCircleFriendAvatars(profiles || [])
  }

  // ---- PHOTO UPLOAD HELPERS ----

  async function uploadFileToStorage(file, bucket) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
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
    await supabase.from('cooks').delete().eq('id', cookId)
    await fetchCooks()
    onUpdate()
    setDeletingCookId(null)
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
    })

    if (cookError) { setError(cookError.message); setSaving(false); return }

    await supabase.from('recipes')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', recipe.id)

    setLogging(false)
    setVerdict(null)
    setScores({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 })
    setCookNotes('')
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
    if (!confirm('Remove this recipe from your Cookbook?')) return
    setDeleting(true)
    await supabase.from('recipes').delete().eq('id', recipe.id)
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

  // ---- EDIT MODE ----
  if (editing) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '40px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--parchment)', marginTop: '54px' }}>
            <button onClick={() => { setEditing(false); setEditError(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--muted)', padding: 0 }}>Cancel</button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700', color: 'var(--ink)' }}>Edit Recipe</div>
            <div style={{ width: '48px' }} />
          </div>
          <div style={{ padding: '24px 20px 120px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={fieldLabel}>Title</label>
              <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Image URL</label>
              {editForm.image_url && (
                <div style={{ marginBottom: '10px', position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '160px' }}>
                  <img src={editForm.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                  <button onClick={() => setEditForm(f => ({ ...f, image_url: '' }))} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              )}
              <input value={editForm.image_url} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." style={inputStyle} />
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
                <label style={fieldLabel}>Cook time</label>
                <input value={editForm.cook_time} onChange={e => setEditForm(f => ({ ...f, cook_time: e.target.value }))} placeholder="e.g. 30 mins" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Difficulty</label>
                <input value={editForm.difficulty} onChange={e => setEditForm(f => ({ ...f, difficulty: e.target.value }))} placeholder="e.g. Easy" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Ingredients</label>
              <textarea value={editForm.ingredients} onChange={e => setEditForm(f => ({ ...f, ingredients: e.target.value }))} rows={8} placeholder="One ingredient per line" style={textareaStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Instructions</label>
              <textarea value={editForm.instructions} onChange={e => setEditForm(f => ({ ...f, instructions: e.target.value }))} rows={10} placeholder="One step per line" style={textareaStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {availableTags.map(tag => {
                  const selected = (editForm.tags || []).includes(tag)
                  return (
                    <button key={tag} onClick={() => {
                      const current = editForm.tags || []
                      setEditForm(f => ({ ...f, tags: selected ? current.filter(t => t !== tag) : [...current, tag] }))
                    }} style={{ padding: '5px 12px', border: '1.5px solid', borderColor: selected ? 'var(--clay)' : 'var(--tan)', borderRadius: 'var(--radius-pill)', background: selected ? 'var(--clay)' : 'transparent', color: selected ? 'var(--cream)' : 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{tag}</button>
                  )
                })}
              </div>
              <input placeholder="+ Add custom tag" style={{ ...inputStyle, fontSize: '13px' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const newTag = e.target.value.trim()
                    if (!(editForm.tags || []).includes(newTag)) setEditForm(f => ({ ...f, tags: [...(f.tags || []), newTag] }))
                    e.target.value = ''
                  }
                }} />
              {(editForm.tags || []).filter(t => !availableTags.includes(t)).map(tag => (
                <div key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', marginRight: '6px', padding: '4px 10px', background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', fontSize: '12px', color: 'var(--charcoal)' }}>
                  {tag}
                  <button onClick={() => setEditForm(f => ({ ...f, tags: (f.tags || []).filter(t => t !== tag) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
            <div>
              <label style={fieldLabel}>Notes</label>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any personal notes about this recipe" style={textareaStyle} />
            </div>
            {editError && (
              <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252' }}>{editError}</div>
            )}
            <button onClick={saveEdit} disabled={savingEdit} style={{ width: '100%', padding: '14px', background: savingEdit ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: savingEdit ? 'not-allowed' : 'pointer' }}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ---- NORMAL VIEW ----
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '120px' }}>

      {/* Photo overlay */}
      {overlayPhotos && (
        <div
          onClick={closeOverlay}
          onTouchStart={handleOverlayTouchStart}
          onTouchEnd={handleOverlayTouchEnd}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={closeOverlay} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          <img
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

      {/* Hero image */}
      {recipe.image_url ? (
        <div style={{ height: '220px', background: 'var(--parchment)', position: 'relative', overflow: 'hidden', marginTop: '54px' }}>
          <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <button onClick={() => thumbnailInputRef.current?.click()} disabled={thumbnailUploading} style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(28,26,23,0.55)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            {thumbnailUploading
              ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: status.bg, border: `1px solid ${status.border}`, color: status.color, borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: '11px', fontWeight: '600' }}>{status.label}</div>
        </div>
      ) : (
        <div style={{ paddingTop: '70px', padding: '70px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => thumbnailInputRef.current?.click()} disabled={thumbnailUploading} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--parchment)', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', color: 'var(--muted)', cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"/></svg>
            {thumbnailUploading ? 'Uploading...' : 'Add photo'}
          </button>
          <button onClick={() => { setEditForm({ title: recipe.title || '', source_name: recipe.source_name || '', source_url: recipe.source_url || '', image_url: recipe.image_url || '', cook_time: recipe.cook_time || '', difficulty: recipe.difficulty || '', ingredients: recipe.ingredients || '', instructions: recipe.instructions || '', notes: recipe.notes || '', tags: recipe.tags || [] }); setEditing(true) }} style={{ background: 'var(--parchment)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', cursor: 'pointer' }}>Edit</button>
        </div>
      )}

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px' }}>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.15', letterSpacing: '-0.5px', marginBottom: '10px' }}>{recipe.title}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {recipe.source_name && <span style={{ background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '11px', fontWeight: '500', color: 'var(--charcoal)' }}>{recipe.source_name}</span>}
            {recipe.cook_time && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{recipe.cook_time}</span>}
            {recipe.difficulty && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>· {recipe.difficulty}</span>}
          </div>
        </div>

        {showCircleModal && (
          <CircleFriendsModal sourceUrl={recipe.source_url} session={session} onClose={() => setShowCircleModal(false)} onSelectUser={onSelectUser} />
        )}

        {circleFriendsCount > 0 && (
          <div onClick={() => setShowCircleModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--parchment)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '12px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex' }}>
                {circleFriendAvatars.map((p, i) => (
                  <div key={p.id} style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: '700', color: 'var(--cream)', marginLeft: i === 0 ? '0' : '-6px', border: '2px solid var(--parchment)', flexShrink: 0 }}>{(p.full_name || p.username || '?')[0].toUpperCase()}</div>
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
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '16px 20px', textDecoration: 'none', marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--clay)' }}>View original recipe →</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.source_name}</span>
          </a>
        )}

        {recipe.image_url && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button onClick={() => { setEditForm({ title: recipe.title || '', source_name: recipe.source_name || '', source_url: recipe.source_url || '', image_url: recipe.image_url || '', cook_time: recipe.cook_time || '', difficulty: recipe.difficulty || '', ingredients: recipe.ingredients || '', instructions: recipe.instructions || '', notes: recipe.notes || '', tags: recipe.tags || [] }); setEditing(true) }} style={{ background: 'var(--parchment)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', cursor: 'pointer' }}>Edit</button>
          </div>
        )}

        {!logging && (
          <button onClick={() => setLogging(true)} style={{ width: '100%', padding: '14px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '24px' }}>Log a Cook</button>
        )}

        {logging && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '24px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Photos</div>
              {cookPhotoPreviews.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {cookPhotoPreviews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeCookPhoto(i)} style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => cookPhotoInputRef.current?.click()} style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-md)', border: '1.5px dashed var(--tan)', background: 'var(--parchment)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>The Verdict</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {verdictOptions.map(v => (
                <button key={v.value} onClick={() => setVerdict(v.value)} style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: `2px solid ${verdict === v.value ? v.border : 'var(--parchment)'}`, background: verdict === v.value ? v.bg : 'var(--cream)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: verdict === v.value ? v.color : 'var(--ink)' }}>{v.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{v.sub}</div>
                </button>
              ))}
            </div>

            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>Nuance Scores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              {nuanceCategories.map(cat => (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--charcoal)', width: '130px', flexShrink: 0 }}>{cat.label}</span>
                  <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setScores(s => ({...s, [cat.key]: n}))} style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid ${scores[cat.key] >= n ? 'var(--clay)' : 'var(--tan)'}`, background: scores[cat.key] >= n ? 'var(--clay)' : 'transparent', color: scores[cat.key] >= n ? 'var(--cream)' : 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>{n}</button>
                    ))}
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: 'var(--clay)', width: '28px', textAlign: 'right' }}>{scores[cat.key] > 0 ? `${scores[cat.key]}/5` : '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px', letterSpacing: '0.04em' }}>Notes</label>
              <textarea value={cookNotes} onChange={e => setCookNotes(e.target.value)} placeholder="What did you tweak? Would you change anything?" rows={3} style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none', resize: 'vertical' }} />
            </div>

            {error && <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', marginBottom: '16px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={logCook} disabled={saving} style={{ flex: 1, padding: '13px', background: saving ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{uploadingPhotos ? 'Uploading photos...' : saving ? 'Saving...' : 'Save Cook'}</button>
              <button onClick={() => { setLogging(false); setError(null); setCookPhotoFiles([]); setCookPhotoPreviews([]) }} style={{ padding: '13px 20px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
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

        {circleCooks.length > 0 && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>From Your Circle</div>
              {circleCooks.length > 3 && <button onClick={() => setShowCircleModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--clay)', padding: 0 }}>See all {circleCooks.length} →</button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {circleCooks.slice(0, 3).map((c, i) => {
                const v = verdictStyles[c.verdict]
                const name = c.profiles?.full_name || c.profiles?.username || 'Someone'
                return (
                  <div key={c.id} style={{ paddingBottom: i < Math.min(circleCooks.length, 3) - 1 ? '14px' : '0', borderBottom: i < Math.min(circleCooks.length, 3) - 1 ? '1px solid var(--parchment)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{name[0].toUpperCase()}</div>
                        <span onClick={() => onSelectUser && onSelectUser(c.user_id)} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--tan)' }}>{name}</span>
                      </div>
                      {v && <div style={{ background: v.bg, border: '1px solid ' + v.border, borderRadius: '100px', padding: '2px 8px', fontSize: '10px', fontWeight: '700', color: v.color }}>{v.label}</div>}
                    </div>
                    {c.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: '1.5', paddingLeft: '36px' }}>"{c.notes}"</div>}
                    {c.flavor && <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '36px', marginTop: '4px' }}>Flavor <strong style={{ color: 'var(--clay)' }}>{c.flavor}/5</strong></div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {recipe.notes && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>Notes</div>
            <div style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.6', fontStyle: 'italic' }}>"{recipe.notes}"</div>
          </div>
        )}

        {/* Cook history */}
        {cooks.length > 0 && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>Cook History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cooks.map((cook, i) => {
                const v = verdictOptions.find(v => v.value === cook.verdict)
                const isDeleting = deletingCookId === cook.id
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
                                onClick={() => deleteCook(cook.id)}
                                style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '500', color: '#B85252', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#FDE8E8'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
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
                          <img
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

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}