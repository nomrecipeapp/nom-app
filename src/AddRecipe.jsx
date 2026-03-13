import { useState } from 'react'
import { supabase } from './supabase'

export default function AddRecipe({ session, onSave, onCancel }) {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recipe, setRecipe] = useState(null)
  const [duplicate, setDuplicate] = useState(null)

  // Manual form fields
  const [title, setTitle] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [notes, setNotes] = useState('')

  async function importFromUrl() {
    if (!url) return
    setLoading(true)
    setError(null)
    setDuplicate(null)

    const { data: existing } = await supabase
      .from('recipes')
      .select('id, title')
      .eq('user_id', session.user.id)
      .eq('source_url', url)
      .single()

    if (existing) {
      setDuplicate(existing)
      setLoading(false)
      return
    }

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

  async function saveRecipe(recipeData) {
    setLoading(true)
    const { logCookNow, ...cleanRecipe } = recipeData
    const { data: saved, error } = await supabase
      .from('recipes')
      .insert({
        user_id: session.user.id,
        ...cleanRecipe,
        tags: cleanRecipe.tags || [],
        status: logCookNow ? 'cooked' : 'want_to_make'
      })
      .select()
      .single()

    if (error) { setError(error.message); setLoading(false); return }

    if (logCookNow && saved) {
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
      notes
    })
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid var(--tan)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--cream)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    color: 'var(--ink)',
    outline: 'none',
    boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--charcoal)',
    marginBottom: '6px',
    letterSpacing: '0.04em'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '24px', paddingBottom: '60px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '32px'
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '500', color: 'var(--ink)' }}>Add Recipe</div>
          <button onClick={onCancel} style={{
            padding: '8px 16px', background: 'transparent', color: 'var(--muted)',
            border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
          }}>Cancel</button>
        </div>

        {/* Mode toggle */}
        {!recipe && (
          <div style={{
            display: 'flex', background: 'var(--parchment)',
            borderRadius: 'var(--radius-pill)', padding: '4px', marginBottom: '28px'
          }}>
            {['url', 'manual'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null); setDuplicate(null) }} style={{
                flex: 1, padding: '8px', border: 'none',
                borderRadius: 'var(--radius-pill)',
                background: mode === m ? 'var(--clay)' : 'transparent',
                color: mode === m ? 'var(--cream)' : 'var(--muted)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>
                {m === 'url' ? 'Import from URL' : 'Add Manually'}
              </button>
            ))}
          </div>
        )}

        {/* URL Import */}
        {mode === 'url' && !recipe && (
          <div style={{
            background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)', padding: '28px'
          }}>
            <label style={labelStyle}>Recipe URL</label>
            <input
              type="url" value={url}
              onChange={e => { setUrl(e.target.value); setDuplicate(null) }}
              placeholder="https://www.seriouseats.com/..."
              style={{ ...inputStyle, marginBottom: '16px' }}
            />

            {duplicate && (
              <div style={{
                background: '#FBF0E6', border: '1px solid #E8A87C',
                borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--clay)', marginBottom: '4px' }}>
                  Already in your Cookbook
                </div>
                <div style={{ fontSize: '12px', color: 'var(--charcoal)', marginBottom: '10px' }}>
                  "{duplicate.title}" is already saved. You can still add it again if you want a separate copy.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={onCancel} style={{
                    flex: 1, padding: '8px',
                    background: 'var(--clay)', color: 'var(--cream)',
                    border: 'none', borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-body)', fontSize: '12px',
                    fontWeight: '600', cursor: 'pointer'
                  }}>Go to Cookbook</button>
                  <button onClick={() => { setDuplicate(null); importFromUrl() }} style={{
                    flex: 1, padding: '8px',
                    background: 'transparent', color: 'var(--muted)',
                    border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-body)', fontSize: '12px',
                    fontWeight: '600', cursor: 'pointer'
                  }}>Add Anyway</button>
                </div>
              </div>
            )}

            {error && (
              <div style={{
                background: '#FDE8E8', border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
                fontSize: '13px', color: '#B85252', marginBottom: '16px'
              }}>{error}</div>
            )}

            {!duplicate && (
              <button onClick={importFromUrl} disabled={loading || !url} style={{
                width: '100%', padding: '13px',
                background: loading || !url ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
                cursor: loading || !url ? 'not-allowed' : 'pointer'
              }}>{loading ? 'Fetching recipe...' : 'Import Recipe'}</button>
            )}

            {loading && (
              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                Parsing ingredients & instructions...
              </div>
            )}
          </div>
        )}

        {/* Review imported recipe */}
       {/* Review imported recipe */}
        {recipe && (
          <div style={{
            background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)', padding: '28px'
          }}>
            <div style={{
              fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '20px'
            }}>Review & Save</div>

            {recipe.image_url && (
              <div style={{
                height: '160px', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', marginBottom: '16px', background: 'var(--parchment)'
              }}>
                <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={recipe.title} onChange={e => setRecipe({...recipe, title: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Source</label>
                <input value={recipe.source_name} onChange={e => setRecipe({...recipe, source_name: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Cook time</label>
                  <input value={recipe.cook_time} onChange={e => setRecipe({...recipe, cook_time: e.target.value})} placeholder="e.g. 30 min" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Difficulty</label>
                  <select value={recipe.difficulty} onChange={e => setRecipe({...recipe, difficulty: e.target.value})} style={inputStyle}>
                    <option value="">Select</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Image URL (optional)</label>
                <input value={recipe.image_url || ''} onChange={e => setRecipe({...recipe, image_url: e.target.value})} placeholder="https://..." style={inputStyle} />
              </div>

              {/* Tags */}
              <div>
                <label style={labelStyle}>Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {['Breakfast','Lunch','Dinner','Appetizer','Dessert','Baking','Cocktail'].map(tag => {
                    const selected = (recipe.tags || []).includes(tag)
                    return (
                      <button key={tag} onClick={() => {
                        const current = recipe.tags || []
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
                <input
                  placeholder="+ Add custom tag"
                  style={{ ...inputStyle, fontSize: '13px' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      const newTag = e.target.value.trim()
                      if (!(recipe.tags || []).includes(newTag)) {
                        setRecipe({ ...recipe, tags: [...(recipe.tags || []), newTag] })
                      }
                      e.target.value = ''
                    }
                  }}
                />
                {(recipe.tags || []).filter(t => !['Breakfast','Lunch','Dinner','Appetizer','Dessert','Baking','Cocktail'].includes(t)).map(tag => (
                  <div key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', marginRight: '6px', padding: '4px 10px', background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', fontSize: '12px', color: 'var(--charcoal)' }}>
                    {tag}
                    <button onClick={() => setRecipe({ ...recipe, tags: (recipe.tags || []).filter(t => t !== tag) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>

              <div>
                <label style={labelStyle}>
                  Ingredients
                  {recipe.ingredients ? (
                    <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--forest)', fontWeight: '700', letterSpacing: '0.06em' }}>✓ IMPORTED</span>
                  ) : (
                    <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--muted)', fontWeight: '500' }}>not found — add manually</span>
                  )}
                </label>
                <textarea value={recipe.ingredients || ''} onChange={e => setRecipe({...recipe, ingredients: e.target.value})} placeholder="One ingredient per line..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>
                  Instructions
                  {recipe.instructions ? (
                    <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--forest)', fontWeight: '700', letterSpacing: '0.06em' }}>✓ IMPORTED</span>
                  ) : (
                    <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--muted)', fontWeight: '500' }}>not found — add manually</span>
                  )}
                </label>
                <textarea value={recipe.instructions || ''} onChange={e => setRecipe({...recipe, instructions: e.target.value})} placeholder="Steps..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={recipe.notes} onChange={e => setRecipe({...recipe, notes: e.target.value})} placeholder="Anything you want to remember..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Log a Cook option */}
              <div style={{
                background: 'var(--parchment)', borderRadius: 'var(--radius-md)',
                padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>Already made this?</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Log a cook right away</div>
                </div>
                <button onClick={() => setRecipe({ ...recipe, logCookNow: !recipe.logCookNow })} style={{
                  width: '44px', height: '26px', borderRadius: '13px', border: 'none',
                  background: recipe.logCookNow ? 'var(--clay)' : 'var(--tan)',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
                }}>
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: recipe.logCookNow ? '21px' : '3px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s'
                  }} />
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#FDE8E8', border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
                fontSize: '13px', color: '#B85252', margin: '16px 0'
              }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setRecipe(null)} style={{
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
              }}>{loading ? 'Saving...' : recipe.logCookNow ? 'Save & Log Cook' : 'Save to My Cookbook'}</button>
            </div>
          </div>
        )}

        {/* Manual entry */}
        {mode === 'manual' && !recipe && (
          <div style={{
            background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)', padding: '28px'
          }}>
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

            {error && (
              <div style={{
                background: '#FDE8E8', border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
                fontSize: '13px', color: '#B85252', margin: '16px 0'
              }}>{error}</div>
            )}

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
    </div>
  )
}