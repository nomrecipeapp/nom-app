import { useState, useEffect } from 'react'
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

export default function RecipeDetail({ recipe, session, onBack, onUpdate }) {
  const [logging, setLogging] = useState(false)
  const [verdict, setVerdict] = useState(null)
  const [scores, setScores] = useState({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 })
  const [cookNotes, setCookNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [cooks, setCooks] = useState([])
  const [loadingCooks, setLoadingCooks] = useState(true)

  async function logCook() {
    if (!verdict) { setError('Please select a verdict.'); return }
    setSaving(true)
    setError(null)

    const newStatus = verdict === 'would_make_again' ? 'cooked'
      : verdict === 'never_again' ? 'never_again'
      : 'cooked'

    // Save the cook log
    const { error: cookError } = await supabase
      .from('cooks')
      .insert({
        user_id: session.user.id,
        recipe_id: recipe.id,
        verdict,
        flavor: scores.flavor || null,
        effort: scores.effort || null,
        would_share: scores.would_share || null,
        true_to_recipe: scores.true_to_recipe || null,
        notes: cookNotes || null
      })

    if (cookError) { setError(cookError.message); setSaving(false); return }

    // Update recipe status
    const { error: recipeError } = await supabase
      .from('recipes')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', recipe.id)

    if (recipeError) setError(recipeError.message)
    else {
      setLogging(false)
      setVerdict(null)
      setScores({ flavor: 0, effort: 0, would_share: 0, true_to_recipe: 0 })
      setCookNotes('')
      await fetchCooks()
      onUpdate()
    }
    setSaving(false)
  }

  async function deleteRecipe() {
    if (!confirm('Remove this recipe from your Cookbook?')) return
    setDeleting(true)
    await supabase.from('recipes').delete().eq('id', recipe.id)
    onBack()
  }

  useEffect(() => {
    fetchCooks()
  }, [recipe.id])

  async function fetchCooks() {
    setLoadingCooks(true)
    const { data } = await supabase
      .from('cooks')
      .select('*')
      .eq('recipe_id', recipe.id)
      .order('cooked_at', { ascending: false })
    if (data) setCooks(data)
    setLoadingCooks(false)
  }

  const statusColors = {
    cooked: { bg: '#EEF4E5', color: '#4A5E42', border: '#7A8C6E', label: 'Cooked' },
    want_to_make: { bg: 'var(--parchment)', color: 'var(--charcoal)', border: 'var(--tan)', label: 'Want to Make' },
    never_again: { bg: '#F4E8E8', color: '#9B4040', border: '#C47070', label: 'Never Again' },
  }

  const status = statusColors[recipe.status] || statusColors.want_to_make

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      paddingBottom: '40px'
    }}>

      {/* Hero image or color block */}
      <div style={{
        height: '220px',
        background: recipe.image_url
          ? 'var(--parchment)'
          : 'linear-gradient(135deg, var(--clay) 0%, var(--ember) 60%, var(--tan) 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {recipe.image_url && (
          <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}

        {/* Back button */}
        <button onClick={onBack} style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(28,26,23,0.5)',
          border: 'none',
          color: 'white',
          fontSize: '18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>←</button>

        {/* Status badge */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          background: status.bg,
          border: `1px solid ${status.border}`,
          color: status.color,
          borderRadius: 'var(--radius-pill)',
          padding: '5px 12px',
          fontSize: '11px',
          fontWeight: '600'
        }}>{status.label}</div>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px' }}>

        {/* Title & meta */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--ink)',
            lineHeight: '1.15',
            letterSpacing: '-0.5px',
            marginBottom: '10px'
          }}>{recipe.title}</div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {recipe.source_name && (
              <span style={{
                background: 'var(--parchment)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '500',
                color: 'var(--charcoal)'
              }}>{recipe.source_name}</span>
            )}
            {recipe.cook_time && (
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{recipe.cook_time}</span>
            )}
            {recipe.difficulty && (
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>· {recipe.difficulty}</span>
            )}
          </div>
        </div>

        {/* Source link — first, for transparency */}
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex',
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '16px 20px',
            textDecoration: 'none',
            marginBottom: '16px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--clay)' }}>View original recipe →</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.source_name}</span>
          </a>
        )}

        {/* Log a Cook button */}
        {!logging && (
          <button onClick={() => setLogging(true)} style={{
            width: '100%',
            padding: '14px',
            background: 'var(--clay)',
            color: 'var(--cream)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '24px'
          }}>Log a Cook</button>
        )}

        {/* Log a Cook form */}
        {logging && (
          <div style={{
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '16px'
            }}>The Verdict</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {verdictOptions.map(v => (
                <button
                  key={v.value}
                  onClick={() => setVerdict(v.value)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${verdict === v.value ? v.border : 'var(--parchment)'}`,
                    background: verdict === v.value ? v.bg : 'var(--cream)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '15px',
                    fontWeight: '500',
                    color: verdict === v.value ? v.color : 'var(--ink)'
                  }}>{v.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{v.sub}</div>
                </button>
              ))}
            </div>

            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '16px'
            }}>Nuance Scores</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              {nuanceCategories.map(cat => (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    color: 'var(--charcoal)',
                    width: '130px',
                    flexShrink: 0
                  }}>{cat.label}</span>
                  <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        onClick={() => setScores(s => ({...s, [cat.key]: n}))}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: `2px solid ${scores[cat.key] >= n ? 'var(--clay)' : 'var(--tan)'}`,
                          background: scores[cat.key] >= n ? 'var(--clay)' : 'transparent',
                          color: scores[cat.key] >= n ? 'var(--cream)' : 'var(--muted)',
                          fontFamily: 'var(--font-display)',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >{n}</button>
                    ))}
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '15px',
                    fontWeight: '700',
                    color: 'var(--clay)',
                    width: '28px',
                    textAlign: 'right'
                  }}>{scores[cat.key] > 0 ? `${scores[cat.key]}/5` : '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--charcoal)',
                marginBottom: '6px',
                letterSpacing: '0.04em'
              }}>Notes</label>
              <textarea
                value={cookNotes}
                onChange={e => setCookNotes(e.target.value)}
                placeholder="What did you tweak? Would you change anything?"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1.5px solid var(--tan)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--cream)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--ink)',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

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

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={logCook} disabled={saving} style={{
                flex: 1,
                padding: '13px',
                background: saving ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}>{saving ? 'Saving...' : 'Save Cook'}</button>
              <button onClick={() => { setLogging(false); setError(null) }} style={{
                padding: '13px 20px',
                background: 'transparent',
                color: 'var(--muted)',
                border: '1.5px solid var(--tan)',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Ingredients */}
        {recipe.ingredients && (
          <div style={{
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px'
            }}>Ingredients</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recipe.ingredients.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--clay)', flexShrink: 0, marginTop: '6px'
                  }} />
                  <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.5' }}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions && (
          <div style={{
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px'
            }}>Instructions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {recipe.instructions.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: 'var(--clay)', color: 'var(--cream)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: '700', flexShrink: 0, marginTop: '1px'
                  }}>{i + 1}</div>
                  <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.6', flex: 1 }}>
                    {line.replace(/^\d+\.\s*/, '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {recipe.notes && (
          <div style={{
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '10px'
            }}>Notes</div>
            <div style={{
              fontSize: '14px',
              color: 'var(--charcoal)',
              lineHeight: '1.6',
              fontStyle: 'italic'
            }}>"{recipe.notes}"</div>
          </div>
        )}

        {/* Cook history */}
        {cooks.length > 0 && (
          <div style={{
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '16px'
            }}>Cook History</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cooks.map((cook, i) => {
                const v = verdictOptions.find(v => v.value === cook.verdict)
                return (
                  <div key={cook.id} style={{
                    paddingBottom: i < cooks.length - 1 ? '12px' : '0',
                    borderBottom: i < cooks.length - 1 ? '1px solid var(--parchment)' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{
                        display: 'inline-flex',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        background: v?.bg || 'var(--parchment)',
                        border: `1px solid ${v?.border || 'var(--tan)'}`,
                        fontSize: '11px',
                        fontWeight: '600',
                        color: v?.color || 'var(--charcoal)'
                      }}>{v?.label || cook.verdict}</div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {new Date(cook.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    {(cook.flavor || cook.effort || cook.would_share || cook.true_to_recipe) && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {[
                          { key: 'flavor', label: 'Flavor' },
                          { key: 'effort', label: 'Effort' },
                          { key: 'would_share', label: 'Share' },
                          { key: 'true_to_recipe', label: 'True to Recipe' }
                        ].map(s => cook[s.key] ? (
                          <span key={s.key} style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {s.label} <strong style={{ color: 'var(--clay)' }}>{cook[s.key]}/5</strong>
                          </span>
                        ) : null)}
                      </div>
                    )}

                    {cook.notes && (
                      <div style={{
                        fontSize: '13px',
                        color: 'var(--charcoal)',
                        fontStyle: 'italic',
                        lineHeight: '1.5'
                      }}>"{cook.notes}"</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        {/* Delete */}
        <button onClick={deleteRecipe} disabled={deleting} style={{
          width: '100%',
          padding: '12px',
          background: 'transparent',
          color: 'var(--muted)',
          border: '1.5px solid var(--parchment)',
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: '600',
          cursor: deleting ? 'not-allowed' : 'pointer',
          marginTop: '8px'
        }}>{deleting ? 'Removing...' : 'Remove from Cookbook'}</button>

      </div>
    </div>
  )
}