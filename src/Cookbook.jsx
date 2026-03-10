import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const FILTERS = ['All', 'Want to Make', 'Cooked', 'Never Again']

const statusLabel = {
  want_to_make: 'Want to Make',
  cooked: 'Cooked',
  never_again: 'Never Again'
}

const verdictStyle = {
  cooked: { background: '#EEF4E5', color: '#4A5E42', border: '1px solid #7A8C6E' },
  want_to_make: { background: 'var(--parchment)', color: 'var(--charcoal)', border: '1px solid var(--tan)' },
  never_again: { background: '#F4E8E8', color: '#9B4040', border: '1px solid #C47070' }
}

export default function Cookbook({ session, onAddRecipe, onSelectRecipe }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    fetchRecipes()
  }, [session])

  async function fetchRecipes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (data) setRecipes(data)
    setLoading(false)
  }

  const filtered = recipes.filter(r => {
    if (filter === 'All') return true
    if (filter === 'Want to Make') return r.status === 'want_to_make'
    if (filter === 'Cooked') return r.status === 'cooked'
    if (filter === 'Never Again') return r.status === 'never_again'
    return true
  })

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
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--parchment)'
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--clay)',
              letterSpacing: '-1px'
            }}>Nom</div>
            <div style={{
              fontSize: '12px',
              color: 'var(--muted)',
              marginTop: '2px'
            }}>My Cookbook</div>
          </div>
          <button
            onClick={onAddRecipe}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--clay)',
              color: 'var(--cream)',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '300'
            }}
          >+</button>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '4px'
        }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius-pill)',
                border: filter === f ? 'none' : '1.5px solid var(--tan)',
                background: filter === f ? 'var(--clay)' : 'transparent',
                color: filter === f ? 'var(--cream)' : 'var(--muted)',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >{f}</button>
          ))}
        </div>

        {/* Recipe count */}
        <div style={{
          fontSize: '12px',
          color: 'var(--muted)',
          marginBottom: '16px'
        }}>
          {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
        </div>

        {/* Recipe list */}
        {loading ? null : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            background: 'var(--warm-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)'
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              fontWeight: '500',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              {filter === 'All' ? 'Your Cookbook is empty' : `No ${filter} recipes yet`}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
              {filter === 'All' ? 'Add your first recipe to get started.' : 'Save some recipes first.'}
            </div>
            {filter === 'All' && (
              <button onClick={onAddRecipe} style={{
                padding: '12px 24px',
                background: 'var(--clay)',
                color: 'var(--cream)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>+ Add your first recipe</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(recipe => (
              <div
                key={recipe.id}
                onClick={() => onSelectRecipe(recipe)}
                style={{
                  background: 'var(--warm-white)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--parchment)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'box-shadow 0.15s'
                }}
              >
                {/* Image or placeholder */}
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: 'var(--radius-sm)',
                  background: recipe.image_url ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
                  flexShrink: 0,
                  overflow: 'hidden'
                }}>
                  {recipe.image_url && (
                    <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'var(--ink)',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>{recipe.title}</div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    {recipe.source_name && (
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.source_name}</span>
                    )}
                    {recipe.cook_time && (
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>· {recipe.cook_time}</span>
                    )}
                  </div>
                </div>

                <div style={{
                  ...verdictStyle[recipe.status],
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '11px',
                  fontWeight: '600',
                  flexShrink: 0
                }}>
                  {statusLabel[recipe.status]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}