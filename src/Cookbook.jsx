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
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')

  useEffect(() => {
    fetchRecipes()
  }, [session])

  async function fetchRecipes() {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setRecipes(data)
    setLoading(false)
  }

  const filtered = recipes
    .filter(r => {
      if (filter === 'Want to Make') return r.status === 'want_to_make'
      if (filter === 'Cooked') return r.status === 'cooked'
      if (filter === 'Never Again') return r.status === 'never_again'
      return true
    })
    .filter(r => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        r.title?.toLowerCase().includes(q) ||
        r.source_name?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sort === 'alpha') return a.title.localeCompare(b.title)
      return 0 // default: already sorted by created_at from DB
    })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '24px', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--parchment)'
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--clay)', letterSpacing: '-1px' }}>Nom</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>My Cookbook</div>
          </div>
          <button onClick={onAddRecipe} style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--clay)', color: 'var(--cream)', border: 'none',
            fontSize: '22px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: '300'
          }}>+</button>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--warm-white)', borderRadius: 'var(--radius-md)',
          padding: '10px 14px', marginBottom: '16px',
          border: '1.5px solid var(--tan)'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
            <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes..."
            style={{
              flex: 1, border: 'none', background: 'none',
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--ink)', outline: 'none'
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: '16px', padding: 0, lineHeight: 1
            }}>×</button>
          )}
        </div>

        {/* Filters + Sort row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '7px 16px', borderRadius: 'var(--radius-pill)',
                border: filter === f ? 'none' : '1.5px solid var(--tan)',
                background: filter === f ? 'var(--clay)' : 'transparent',
                color: filter === f ? 'var(--cream)' : 'var(--muted)',
                fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s'
              }}>{f}</button>
            ))}
          </div>

          {/* Sort toggle */}
          <button onClick={() => setSort(s => s === 'date' ? 'alpha' : 'date')} style={{
            flexShrink: 0, marginLeft: '10px', padding: '7px 12px',
            borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--tan)',
            background: 'transparent', color: 'var(--muted)',
            fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M6 12h12M9 18h6" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {sort === 'date' ? 'Date' : 'A–Z'}
          </button>
        </div>

        {/* Recipe count */}
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
          {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
        </div>

        {/* Recipe list */}
        {loading ? null : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)'
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '500', color: 'var(--ink)', marginBottom: '8px' }}>
              {search ? `No results for "${search}"` : filter === 'All' ? 'Your Cookbook is empty' : `No ${filter} recipes yet`}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
              {search ? 'Try a different search.' : filter === 'All' ? 'Add your first recipe to get started.' : 'Save some recipes first.'}
            </div>
            {filter === 'All' && !search && (
              <button onClick={onAddRecipe} style={{
                padding: '12px 24px', background: 'var(--clay)', color: 'var(--cream)',
                border: 'none', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}>+ Add your first recipe</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(recipe => (
              <div key={recipe.id} onClick={() => onSelectRecipe(recipe)} style={{
                background: 'var(--warm-white)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--parchment)', padding: '16px 18px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '14px', transition: 'box-shadow 0.15s'
              }}>
                {recipe.image_url && (
                  <div style={{
                    width: '52px', height: '52px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--parchment)', flexShrink: 0, overflow: 'hidden'
                  }}>
                    <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '500',
                    color: 'var(--ink)', marginBottom: '4px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>{recipe.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {recipe.source_name && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.source_name}</span>}
                    {recipe.cook_time && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>· {recipe.cook_time}</span>}
                  </div>
                </div>
                <div style={{
                  ...verdictStyle[recipe.status],
                  padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                  fontSize: '11px', fontWeight: '600', flexShrink: 0
                }}>{statusLabel[recipe.status]}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}