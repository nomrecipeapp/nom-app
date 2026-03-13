import { useState, useEffect } from 'react'
import { supabase } from './supabase'

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

export default function SocialRecipeDetail({ cook, session, onBack, onSelectUser }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [circleCooks, setCircleCooks] = useState([])
  const [duplicate, setDuplicate] = useState(null)

  const recipe = cook.recipes
  const profile = cook.profiles
  const v = verdictStyles[cook.verdict]

  useEffect(() => {
    if (recipe?.source_url) fetchCircleCooks()
  }, [cook.id])

  async function fetchCircleCooks() {
    // Get people I follow
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id)
      .eq('status', 'approved')

    if (!following || following.length === 0) return

    const followingIds = following.map(f => f.following_id)

    // Find their recipes with the same source_url
    const { data: matchingRecipes } = await supabase
      .from('recipes')
      .select('id, user_id')
      .eq('source_url', recipe.source_url)
      .in('user_id', followingIds)

    if (!matchingRecipes || matchingRecipes.length === 0) return

    const recipeIds = matchingRecipes.map(r => r.id)

    // Get their cooks
    const { data: cooks } = await supabase
      .from('cooks')
      .select('*, recipes(title), profiles(full_name, username)')
      .in('recipe_id', recipeIds)
      .order('cooked_at', { ascending: false })

    // Deduplicate — most recent cook per user, exclude the cook we're already viewing
    const seen = new Set()
    const deduped = (cooks || []).filter(c => {
      if (c.user_id === cook.user_id) return false
      if (seen.has(c.user_id)) return false
      seen.add(c.user_id)
      return true
    })

    setCircleCooks(deduped)
  }

  async function saveRecipe() {
    if (saved || saving) return
    setSaving(true)

    // Check for duplicate
    const { data: existing } = await supabase
      .from('recipes')
      .select('id, title')
      .eq('user_id', session.user.id)
      .eq('source_url', recipe.source_url)
      .maybeSingle()

    if (existing) {
      setDuplicate(existing)
      setSaving(false)
      return
    }

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

  if (!recipe) return null

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>

      {/* Hero image */}
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

        {/* Title + meta */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.2', marginBottom: '10px' }}>{recipe.title}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {recipe.source_name && (
              <div style={{ background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', fontSize: '11px', fontWeight: '500', color: 'var(--charcoal)' }}>{recipe.source_name}</div>
            )}
            {recipe.cook_time && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.cook_time}</div>}
            {recipe.difficulty && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>· {recipe.difficulty}</div>}
          </div>
        </div>

        {/* Source link */}
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

        {/* Cooked by */}
        <div onClick={() => onSelectUser && onSelectUser(cook.user_id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700',
            color: 'var(--cream)', flexShrink: 0
          }}>{(profile?.full_name || profile?.username || '?')[0].toUpperCase()}</div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '1px' }}>Cooked by</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{profile?.full_name || profile?.username || 'Unknown'} →</div>
          </div>
        </div>

        {/* Verdict badge */}
        {v && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: v.bg, border: '1px solid ' + v.border, borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: '12px', fontWeight: '600', color: v.color }}>{v.label}</div>
          </div>
        )}

        {/* Notes */}
        {cook.notes && (
          <div style={{ background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Notes</div>
            <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.6', fontStyle: 'italic' }}>"{cook.notes}"</div>
          </div>
        )}

        {/* Nuance scores */}
        {(cook.flavor || cook.effort || cook.would_share || cook.true_to_recipe) && (
          <div style={{ background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Scores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cook.flavor && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Flavor</div><div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.flavor}/5</div></div>}
              {cook.effort && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Effort vs. Reward</div><div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.effort}/5</div></div>}
              {cook.would_share && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Would Share</div><div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.would_share}/5</div></div>}
              {cook.true_to_recipe && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>True to Recipe</div><div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.true_to_recipe}/5</div></div>}
            </div>
          </div>
        )}

        {/* From Your Circle */}
        {circleCooks.length > 0 && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>From Your Circle</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {circleCooks.map((c, i) => {
                const vs = verdictStylesShort[c.verdict]
                const name = c.profiles?.full_name || c.profiles?.username || 'Someone'
                return (
                  <div key={c.id} style={{ paddingBottom: i < circleCooks.length - 1 ? '14px' : '0', borderBottom: i < circleCooks.length - 1 ? '1px solid var(--parchment)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: '11px',
                          fontWeight: '700', color: 'var(--cream)', flexShrink: 0
                        }}>{name[0].toUpperCase()}</div>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{name}</span>
                      </div>
                      {vs && (
                        <div style={{ background: vs.bg, border: '1px solid ' + vs.border, borderRadius: '100px', padding: '2px 8px', fontSize: '10px', fontWeight: '700', color: vs.color }}>{vs.label}</div>
                      )}
                    </div>
                    {c.notes && (
                      <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: '1.5', paddingLeft: '36px' }}>"{c.notes}"</div>
                    )}
                    {c.flavor && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '36px', marginTop: '4px' }}>
                        Flavor <strong style={{ color: 'var(--clay)' }}>{c.flavor}/5</strong>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Duplicate warning */}
        {duplicate && (
          <div style={{
            background: '#FEF3E2', border: '1px solid #F5C47A',
            borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '12px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9A6B1A', marginBottom: '8px' }}>
              Already in your Cookbook: "{duplicate.title}"
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
               <button onClick={addAnyway} style={{
                flex: 1, padding: '8px', background: 'transparent',
                border: '1px solid #F5C47A', borderRadius: 'var(--radius-pill)',
                fontSize: '12px', fontWeight: '600', color: '#9A6B1A', cursor: 'pointer'
              }}>Add Anyway</button>
            </div>
          </div>
        )}

        {/* Save to Cookbook */}
        {!duplicate && (
          <button onClick={saveRecipe} disabled={saved || saving} style={{
            width: '100%', padding: '15px',
            background: saved ? 'var(--sage)' : 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
            cursor: saved ? 'default' : 'pointer', transition: 'background 0.2s'
          }}>
            {saved ? '✓ Saved to Cookbook' : saving ? 'Saving...' : '+ Save to My Cookbook'}
          </button>
        )}

      </div>
    </div>
  )
}