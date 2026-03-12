import { useState } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

export default function SocialRecipeDetail({ cook, session, onBack, onSelectUser }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const recipe = cook.recipes
  const profile = cook.profiles
  const v = verdictStyles[cook.verdict]

  async function saveRecipe() {
    if (saved || saving) return
    setSaving(true)
    await supabase.from('recipes').insert({
      user_id: session.user.id,
      title: recipe.title,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      image_url: recipe.image_url,
      cook_time: recipe.cook_time,
      difficulty: recipe.difficulty,
      status: 'want_to_make'
    })
    setSaving(false)
    setSaved(true)
  }

  if (!recipe) return null

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>

      {/* Hero image — only if exists */}
      {recipe.image_url ? (
        <div style={{ position: 'relative' }}>
          <img
            src={recipe.image_url}
            alt=""
            style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }}
          />
          {/* Back button over image */}
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
        /* Back button — no image */
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
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--ink)',
            lineHeight: '1.2',
            marginBottom: '10px'
          }}>{recipe.title}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {recipe.source_name && (
              <div style={{
                background: 'var(--parchment)',
                borderRadius: 'var(--radius-pill)',
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: '500',
                color: 'var(--charcoal)'
              }}>{recipe.source_name}</div>
            )}
            {recipe.cook_time && (
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.cook_time}</div>
            )}
            {recipe.difficulty && (
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>· {recipe.difficulty}</div>
            )}
          </div>
        </div>

        {/* Source link — first, before social content */}
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--parchment)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '16px',
            textDecoration: 'none'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--clay)' }}>View original recipe →</div>
            {recipe.source_name && (
              <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{recipe.source_name}</div>
            )}
          </a>
        )}

        <div style={{ height: '1px', background: 'var(--parchment)', marginBottom: '16px' }} />

        {/* Cooked by — tappable */}
        <div
          onClick={() => onSelectUser && onSelectUser(cook.user_id)}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: '14px', fontWeight: '700',
            color: 'var(--cream)', flexShrink: 0
          }}>
            {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '1px' }}>Cooked by</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>
              {profile?.full_name || profile?.username || 'Unknown'} →
            </div>
          </div>
        </div>

        {/* Verdict badge */}
        {v && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: v.bg, border: '1px solid ' + v.border,
              borderRadius: 'var(--radius-pill)',
              padding: '6px 14px', fontSize: '12px', fontWeight: '600', color: v.color
            }}>{v.label}</div>
          </div>
        )}

        {/* Notes */}
        {cook.notes && (
          <div style={{
            background: 'var(--warm-white)',
            border: '1px solid var(--parchment)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Notes</div>
            <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.6', fontStyle: 'italic' }}>"{cook.notes}"</div>
          </div>
        )}

        {/* Nuance scores */}
        {(cook.flavor || cook.effort || cook.would_share || cook.true_to_recipe) && (
          <div style={{
            background: 'var(--warm-white)',
            border: '1px solid var(--parchment)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Scores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cook.flavor && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Flavor</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.flavor}/5</div>
                </div>
              )}
              {cook.effort && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Effort vs. Reward</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.effort}/5</div>
                </div>
              )}
              {cook.would_share && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>Would Share</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.would_share}/5</div>
                </div>
              )}
              {cook.true_to_recipe && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--charcoal)' }}>True to Recipe</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{cook.true_to_recipe}/5</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save to Cookbook — only CTA */}
        <button onClick={saveRecipe} disabled={saved || saving} style={{
          width: '100%',
          padding: '15px',
          background: saved ? 'var(--sage)' : 'var(--clay)',
          color: 'var(--cream)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          fontWeight: '600',
          cursor: saved ? 'default' : 'pointer',
          transition: 'background 0.2s'
        }}>
          {saved ? '✓ Saved to Cookbook' : saving ? 'Saving...' : '+ Save to My Cookbook'}
        </button>

      </div>
    </div>
  )
}