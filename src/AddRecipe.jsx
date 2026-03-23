import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

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

const PRESET_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Appetizer', 'Dessert', 'Baking', 'Cocktail']

const loadingMessages = [
  'Reading your recipe...',
  'Identifying ingredients...',
  'Parsing the steps...',
  'Almost there...',
]

export default function AddRecipe({ session, onSave, onCancel }) {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(loadingMessages[0])
  const [error, setError] = useState(null)
  const [recipe, setRecipe] = useState(null)
  const [duplicate, setDuplicate] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const photoInputRef = useRef(null)

  // Verdict state
  const [verdict, setVerdict] = useState(null)
  const [manualLogCook, setManualLogCook] = useState(false)
  const [availableTags, setAvailableTags] = useState(PRESET_TAGS)
  const [scores, setScores] = useState({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 })
  const [cookNotes, setCookNotes] = useState('')

  // Manual form fields
  const [title, setTitle] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchUserTags()
  }, [])

  async function fetchUserTags() {
    const { data } = await supabase.from('recipes').select('tags').eq('user_id', session.user.id)
    if (!data) return
    const customTags = [...new Set(data.flatMap(r => r.tags || []).filter(t => !PRESET_TAGS.includes(t)))]
    if (customTags.length > 0) setAvailableTags([...PRESET_TAGS, ...customTags])
  }

  async function importFromUrl() {
    if (!url) return
    setLoading(true)
    setError(null)
    setDuplicate(null)

    const { data: existing } = await supabase
      .from('recipes').select('id, title')
      .eq('user_id', session.user.id).eq('source_url', url).single()

    if (existing) { setDuplicate(existing); setLoading(false); return }

    try {
      const apiKey = import.meta.env.VITE_SPOONACULAR_KEY
      const res = await fetch(`https://api.spoonacular.com/recipes/extract?url=${encodeURIComponent(url)}&apiKey=${apiKey}`)
      const data = await res.json()

      if (data.code === 402) {
        setError('Daily import limit reached. Try again tomorrow or add manually.')
        setLoading(false)
        return
      }

      const ingredients = data.extendedIngredients
        ? data.extendedIngredients.map(i => i.original).join('\n')
        : ''
      const instructions = data.analyzedInstructions?.[0]?.steps
        ? data.analyzedInstructions[0].steps.map((s, i) => `${i + 1}. ${s.step}`).join('\n')
        : data.instructions || ''
      const cookTime = data.readyInMinutes ? `${data.readyInMinutes} min` : ''

      setRecipe({
        title: data.title || '',
        source_url: url,
        source_name: data.sourceName || new URL(url).hostname.replace('www.', ''),
        image_url: data.image || null,
        cook_time: cookTime,
        difficulty: '',
        ingredients,
        instructions,
        notes: '',
        tags: [],
        logCookNow: false
      })
    } catch (e) {
      setError('Could not fetch recipe. Try adding it manually.')
    }
    setLoading(false)
  }

  async function importFromPhoto(file) {
    if (!file) return
    setLoading(true)
    setError(null)

    // Show cycling loading messages
    let msgIndex = 0
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % loadingMessages.length
      setLoadingMsg(loadingMessages[msgIndex])
    }, 2000)

    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const mediaType = file.type || 'image/jpeg'

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 }
              },
              {
                type: 'text',
                text: 'Extract the recipe from this image. Return JSON only, no markdown, no explanation. Use these exact fields: {"title": "", "ingredients": "one per line", "instructions": "numbered steps, one per line", "cook_time": "", "difficulty": "Easy or Medium or Hard or empty", "source_name": ""}. If a field is not visible, use empty string.'
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      console.log('Claude response text:', text)
      console.log('Cleaned:', clean)
      const parsed = JSON.parse(clean)

      setRecipe({
        title: parsed.title || '',
        source_url: null,
        source_name: parsed.source_name || '',
        image_url: photoPreview || null,
        cook_time: parsed.cook_time || '',
        difficulty: parsed.difficulty || '',
        ingredients: parsed.ingredients || '',
        instructions: parsed.instructions || '',
        notes: '',
        tags: [],
        logCookNow: false
      })
    } catch (e) {
      console.error('Photo import error:', e)
      setError('Could not read the recipe from this image. Try a clearer photo or add manually.')
    }

    clearInterval(msgInterval)
    setLoadingMsg(loadingMessages[0])
    setLoading(false)
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPhotoPreview(objectUrl)
    importFromPhoto(file)
  }

  async function saveRecipe(recipeData) {
    if (recipeData.logCookNow && !verdict) {
      setError('Please select a verdict before saving.')
      return
    }
    setLoading(true)
    const { logCookNow, ...cleanRecipe } = recipeData
    const { data: saved, error: saveError } = await supabase
      .from('recipes')
      .insert({
        user_id: session.user.id,
        ...cleanRecipe,
        tags: cleanRecipe.tags || [],
        status: logCookNow ? (verdict === 'never_again' ? 'never_again' : 'cooked') : 'want_to_make'
      })
      .select().single()

    if (saveError) { setError(saveError.message); setLoading(false); return }

    if (logCookNow && saved) {
      await supabase.from('cooks').insert({
        user_id: session.user.id,
        recipe_id: saved.id,
        verdict,
        flavor: scores.flavor || null,
        effort: scores.effort || null,
        would_share: scores.would_share || null,
        true_to_recipe: scores.true_to_recipe || null,
        notes: cookNotes || null
      })
      onSave(saved, true)
    } else {
      onSave()
    }
    setLoading(false)
  }

  function handleManualSave() {
    if (!title) { setError('Title is required.'); return }
    saveRecipe({
      title,
      source_url: null,
      source_name: sourceName,
      image_url: null,
      cook_time: cookTime,
      difficulty,
      ingredients,
      instructions,
      notes,
      logCookNow: manualLogCook
    })
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
    background: 'var(--cream)', fontFamily: 'var(--font-body)',
    fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: '600',
    color: 'var(--charcoal)', marginBottom: '6px', letterSpacing: '0.04em'
  }

  const verdictAndScoresUI = (logCookFlag) => logCookFlag && (
    <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>The Verdict</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {verdictOptions.map(v => (
            <button key={v.value} onClick={() => setVerdict(v.value)} style={{
              padding: '12px 16px', borderRadius: 'var(--radius-md)',
              border: `2px solid ${verdict === v.value ? v.border : 'var(--parchment)'}`,
              background: verdict === v.value ? v.bg : 'var(--cream)',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '500', color: verdict === v.value ? v.color : 'var(--ink)' }}>{v.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{v.sub}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Nuance Scores</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {nuanceCategories.map(cat => (
            <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--charcoal)', width: '120px', flexShrink: 0 }}>{cat.label}</span>
              <div style={{ display: 'flex', gap: '5px', flex: 1 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setScores(s => ({...s, [cat.key]: n}))} style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    border: `2px solid ${scores[cat.key] >= n ? 'var(--clay)' : 'var(--tan)'}`,
                    background: scores[cat.key] >= n ? 'var(--clay)' : 'transparent',
                    color: scores[cat.key] >= n ? 'var(--cream)' : 'var(--muted)',
                    fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '600',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}>{n}</button>
                ))}
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '700', color: 'var(--clay)', width: '28px', textAlign: 'right' }}>
                {scores[cat.key] > 0 ? `${scores[cat.key]}/5` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>Cook Notes</label>
        <textarea value={cookNotes} onChange={e => setCookNotes(e.target.value)}
          placeholder="What did you tweak? Would you change anything?" rows={3}
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    </div>
  )

  const reviewScreen = (
    <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '20px' }}>Review & Save</div>

      {recipe?.image_url && (
        <div style={{ height: '160px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '16px', background: 'var(--parchment)' }}>
          <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={recipe?.title || ''} onChange={e => setRecipe({...recipe, title: e.target.value})} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Source</label>
          <input value={recipe?.source_name || ''} onChange={e => setRecipe({...recipe, source_name: e.target.value})} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Cook time</label>
            <input value={recipe?.cook_time || ''} onChange={e => setRecipe({...recipe, cook_time: e.target.value})} placeholder="e.g. 30 min" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Difficulty</label>
            <select value={recipe?.difficulty || ''} onChange={e => setRecipe({...recipe, difficulty: e.target.value})} style={inputStyle}>
              <option value="">Select</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Image URL (optional)</label>
          <input value={recipe?.image_url || ''} onChange={e => setRecipe({...recipe, image_url: e.target.value})} placeholder="https://..." style={inputStyle} />
        </div>

        {/* Tags */}
        <div>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {availableTags.map(tag => {
              const selected = (recipe?.tags || []).includes(tag)
              return (
                <button key={tag} onClick={() => {
                  const current = recipe?.tags || []
                  setRecipe({ ...recipe, tags: selected ? current.filter(t => t !== tag) : [...current, tag] })
                }} style={{
                  padding: '5px 12px', border: '1.5px solid',
                  borderColor: selected ? 'var(--clay)' : 'var(--tan)',
                  borderRadius: 'var(--radius-pill)',
                  background: selected ? 'var(--clay)' : 'transparent',
                  color: selected ? 'var(--cream)' : 'var(--muted)',
                  fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}>{tag}</button>
              )
            })}
          </div>
          <input placeholder="+ Add custom tag" style={{ ...inputStyle, fontSize: '13px' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                const newTag = e.target.value.trim()
                if (!(recipe?.tags || []).includes(newTag)) setRecipe({ ...recipe, tags: [...(recipe?.tags || []), newTag] })
                e.target.value = ''
              }
            }}
          />
          {(recipe?.tags || []).filter(t => !availableTags.includes(t)).map(tag => (
            <div key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', marginRight: '6px', padding: '4px 10px', background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', fontSize: '12px', color: 'var(--charcoal)' }}>
              {tag}
              <button onClick={() => setRecipe({ ...recipe, tags: (recipe?.tags || []).filter(t => t !== tag) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
        </div>

        <div>
          <label style={labelStyle}>
            Ingredients
            {recipe?.ingredients ? <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--forest)', fontWeight: '700', letterSpacing: '0.06em' }}>✓ IMPORTED</span> : <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--muted)', fontWeight: '500' }}>not found — add manually</span>}
          </label>
          <textarea value={recipe?.ingredients || ''} onChange={e => setRecipe({...recipe, ingredients: e.target.value})} placeholder="One ingredient per line..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>
            Instructions
            {recipe?.instructions ? <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--forest)', fontWeight: '700', letterSpacing: '0.06em' }}>✓ IMPORTED</span> : <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--muted)', fontWeight: '500' }}>not found — add manually</span>}
          </label>
          <textarea value={recipe?.instructions || ''} onChange={e => setRecipe({...recipe, instructions: e.target.value})} placeholder="Steps..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={recipe?.notes || ''} onChange={e => setRecipe({...recipe, notes: e.target.value})} placeholder="Anything you want to remember..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {/* Log a Cook toggle */}
        <div style={{ background: 'var(--parchment)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>Already made this?</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Log a cook right away</div>
          </div>
          <button onClick={() => { setRecipe({ ...recipe, logCookNow: !recipe?.logCookNow }); setVerdict(null); setScores({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 }); setCookNotes('') }} style={{
            width: '44px', height: '26px', borderRadius: '13px', border: 'none',
            background: recipe?.logCookNow ? 'var(--clay)' : 'var(--tan)',
            cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
          }}>
            <div style={{ position: 'absolute', top: '3px', left: recipe?.logCookNow ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
          </button>
        </div>

        {verdictAndScoresUI(recipe?.logCookNow)}
      </div>

      {error && <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', margin: '16px 0' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={() => { setRecipe(null); setPhotoPreview(null) }} style={{
          padding: '13px 20px', background: 'transparent', color: 'var(--muted)',
          border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
        }}>← Back</button>
        <button onClick={() => saveRecipe(recipe)} disabled={loading} style={{
          flex: 1, padding: '13px',
          background: loading ? 'var(--tan)' : 'var(--clay)',
          color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}>{loading ? 'Saving...' : recipe?.logCookNow ? 'Save & Log Cook' : 'Save to My Cookbook'}</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '24px', paddingBottom: '60px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '500', color: 'var(--ink)' }}>Add Recipe</div>
          <button onClick={onCancel} style={{
            padding: '8px 16px', background: 'transparent', color: 'var(--muted)',
            border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
          }}>Cancel</button>
        </div>

        {!recipe && (
          <div style={{ display: 'flex', background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', padding: '4px', marginBottom: '28px' }}>
            {['url', 'photo', 'manual'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null); setDuplicate(null); setPhotoPreview(null) }} style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 'var(--radius-pill)',
                background: mode === m ? 'var(--clay)' : 'transparent',
                color: mode === m ? 'var(--cream)' : 'var(--muted)',
                fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>
                {m === 'url' ? 'From URL' : m === 'photo' ? 'From Photo' : 'Manual'}
              </button>
            ))}
          </div>
        )}

        {/* URL Import */}
        {mode === 'url' && !recipe && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '28px' }}>
            <label style={labelStyle}>Recipe URL</label>
            <input type="url" value={url} onChange={e => { setUrl(e.target.value); setDuplicate(null) }}
              placeholder="https://www.seriouseats.com/..." style={{ ...inputStyle, marginBottom: '16px' }} />

            {duplicate && (
              <div style={{ background: '#FBF0E6', border: '1px solid #E8A87C', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--clay)', marginBottom: '4px' }}>Already in your Cookbook</div>
                <div style={{ fontSize: '12px', color: 'var(--charcoal)', marginBottom: '10px' }}>"{duplicate.title}" is already saved.</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={onCancel} style={{ flex: 1, padding: '8px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Go to Cookbook</button>
                  <button onClick={() => { setDuplicate(null); importFromUrl() }} style={{ flex: 1, padding: '8px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Add Anyway</button>
                </div>
              </div>
            )}

            {error && <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', marginBottom: '16px' }}>{error}</div>}

            {!duplicate && (
              <button onClick={importFromUrl} disabled={loading || !url} style={{
                width: '100%', padding: '13px',
                background: loading || !url ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
                cursor: loading || !url ? 'not-allowed' : 'pointer'
              }}>{loading ? 'Fetching recipe...' : 'Import Recipe'}</button>
            )}
          </div>
        )}

        {/* Photo Import */}
        {mode === 'photo' && !recipe && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '28px' }}>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />

            {!loading && !photoPreview && (
              <div
                onClick={() => photoInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--tan)', borderRadius: 'var(--radius-lg)',
                  padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.15s'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📷</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: 'var(--ink)', marginBottom: '6px' }}>
                  Upload a photo of your recipe
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  Works with screenshots, cookbook pages, or handwritten cards
                </div>
                <div style={{ marginTop: '20px', padding: '12px 24px', background: 'var(--clay)', color: 'var(--cream)', borderRadius: 'var(--radius-pill)', display: 'inline-block', fontSize: '13px', fontWeight: '600' }}>
                  Choose Photo
                </div>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                {photoPreview && (
                  <div style={{ height: '140px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '24px', opacity: 0.6 }}>
                    <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ width: '36px', height: '36px', border: '3px solid var(--parchment)', borderTop: '3px solid var(--clay)', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: 'var(--ink)', marginBottom: '4px' }}>{loadingMsg}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>This takes about 10–15 seconds</div>
              </div>
            )}

            {error && <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', marginTop: '16px' }}>{error}</div>}
          </div>
        )}

        {/* Review screen — shared by all import modes */}
        {recipe && reviewScreen}

        {/* Manual entry */}
        {mode === 'manual' && !recipe && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '28px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Recipe name" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Source</label>
                <input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="e.g. Grandma's recipe, NYT Cooking" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Image URL (optional)</label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Cook time</label>
                  <input value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="e.g. 30 min" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Difficulty</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={inputStyle}>
                    <option value="">Select</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Ingredients</label>
                <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder="One ingredient per line..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Instructions</label>
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Steps..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything you want to remember..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ marginTop: '14px', background: 'var(--parchment)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>Already made this?</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Log a cook right away</div>
              </div>
              <button onClick={() => { setManualLogCook(v => !v); setVerdict(null); setScores({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 }); setCookNotes('') }} style={{
                width: '44px', height: '26px', borderRadius: '13px', border: 'none',
                background: manualLogCook ? 'var(--clay)' : 'var(--tan)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
              }}>
                <div style={{ position: 'absolute', top: '3px', left: manualLogCook ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
              </button>
            </div>

            {verdictAndScoresUI(manualLogCook)}

            {error && <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', margin: '16px 0' }}>{error}</div>}

            <button onClick={handleManualSave} disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? 'var(--tan)' : 'var(--clay)',
              color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px'
            }}>{loading ? 'Saving...' : 'Save to My Cookbook'}</button>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}