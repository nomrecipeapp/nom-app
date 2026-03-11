import { useState } from 'react'
import { supabase } from './supabase'

export default function AddRecipe({ session, onSave, onCancel }) {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recipe, setRecipe] = useState(null)

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

    try {
      const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&meta=false`)
      const data = await response.json()

      if (data.status === 'success') {
        setRecipe({
          title: data.data.title || '',
          source_url: url,
          source_name: data.data.publisher || new URL(url).hostname.replace('www.', ''),
          image_url: data.data.image?.url || null,
          cook_time: '',
          difficulty: '',
          ingredients: '',
          instructions: data.data.description || '',
          notes: ''
        })
      } else {
        setError('Could not fetch recipe. Try adding it manually.')
      }
    } catch (e) {
      setError('Could not fetch recipe. Try adding it manually.')
    }

    setLoading(false)
  }

  async function saveRecipe(recipeData) {
    setLoading(true)
    const { error } = await supabase
      .from('recipes')
      .insert({
        user_id: session.user.id,
        ...recipeData,
        status: 'want_to_make'
      })

    if (error) setError(error.message)
    else onSave()
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
    outline: 'none'
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
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      padding: '24px'
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: '500',
            color: 'var(--ink)'
          }}>Add Recipe</div>
          <button onClick={onCancel} style={{
            padding: '8px 16px',
            background: 'transparent',
            color: 'var(--muted)',
            border: '1.5px solid var(--tan)',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>Cancel</button>
        </div>

        {/* Mode toggle */}
        {!recipe && (
          <div style={{
            display: 'flex',
            background: 'var(--parchment)',
            borderRadius: 'var(--radius-pill)',
            padding: '4px',
            marginBottom: '28px'
          }}>
            {['url', 'manual'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null) }} style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                background: mode === m ? 'var(--clay)' : 'transparent',
                color: mode === m ? 'var(--cream)' : 'var(--muted)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}>
                {m === 'url' ? 'Import from URL' : 'Add Manually'}
              </button>
            ))}
          </div>
        )}

        {/* URL Import */}
        {mode === 'url' && !recipe && (
          <div style={{
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '28px'
          }}>
            <label style={labelStyle}>Recipe URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.seriouseats.com/..."
              style={{ ...inputStyle, marginBottom: '16px' }}
            />
            {error && (
              <div style={{
                background: '#FDE8E8',
                border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#B85252',
                marginBottom: '16px'
              }}>{error}</div>
            )}
            <button
              onClick={importFromUrl}
              disabled={loading || !url}
              style={{
                width: '100%',
                padding: '13px',
                background: loading || !url ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading || !url ? 'not-allowed' : 'pointer'
              }}
            >{loading ? 'Fetching...' : 'Import Recipe'}</button>
          </div>
        )}

        {/* Review imported recipe */}
        {recipe && (
          <div style={{
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '28px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '20px'
            }}>Review & Save</div>

            {recipe.image_url && (
              <div style={{
                height: '160px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                marginBottom: '16px',
                background: 'var(--parchment)'
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
                  <select value={recipe.difficulty} onChange={e => setRecipe({...recipe, difficulty: e.target.value})} style={{ ...inputStyle }}>
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
              <div>
                <label style={labelStyle}>Ingredients (optional)</label>
                <textarea value={recipe.ingredients || ''} onChange={e => setRecipe({...recipe, ingredients: e.target.value})} placeholder="One ingredient per line..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Instructions (optional)</label>
                <textarea value={recipe.instructions || ''} onChange={e => setRecipe({...recipe, instructions: e.target.value})} placeholder="Steps..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={recipe.notes} onChange={e => setRecipe({...recipe, notes: e.target.value})} placeholder="Anything you want to remember..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>

            {error && (
              <div style={{
                background: '#FDE8E8',
                border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#B85252',
                margin: '16px 0'
              }}>{error}</div>
            )}

            <button
              onClick={() => saveRecipe(recipe)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '20px'
              }}
            >{loading ? 'Saving...' : 'Save to My Cookbook'}</button>
          </div>
        )}

        {/* Manual entry */}
        {mode === 'manual' && !recipe && (
          <div style={{
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '28px'
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
                background: '#FDE8E8',
                border: '1px solid #F5C0C0',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#B85252',
                margin: '16px 0'
              }}>{error}</div>
            )}

            <button
              onClick={handleManualSave}
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '8px'
              }}
            >{loading ? 'Saving...' : 'Save to My Cookbook'}</button>
          </div>
        )}

      </div>
    </div>
  )
}