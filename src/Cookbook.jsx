import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import CircleFriendsModal from './CircleFriendsModal'

const FILTERS = ['All', 'Want to Make', 'Cooked', 'Never Again']
const PRESET_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Appetizer', 'Dessert', 'Baking', 'Cocktail']
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

export default function Cookbook({ session, onAddRecipe, onSelectRecipe, defaultFilter, onSelectUser }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(defaultFilter || 'All')
  const [tagFilter, setTagFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const [circleFriendsMap, setCircleFriendsMap] = useState({})
  const [circleModal, setCircleModal] = useState(null)

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
    if (data) {
      setRecipes(data)
      fetchCircleFriendsForRecipes(data)
    }
    setLoading(false)
  }

  async function fetchCircleFriendsForRecipes(recipeList) {
    const { data: following } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!following || following.length === 0) return
    const followingIds = following.map(f => f.following_id)

    const sourceUrls = recipeList.filter(r => r.source_url).map(r => r.source_url)
    if (sourceUrls.length === 0) return

    const { data: matchingRecipes } = await supabase
      .from('recipes').select('id, user_id, source_url')
      .in('source_url', sourceUrls).in('user_id', followingIds)

    if (!matchingRecipes || matchingRecipes.length === 0) return

    const allUserIds = [...new Set(matchingRecipes.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username').in('id', allUserIds)

    const map = {}
    for (const r of recipeList) {
      if (!r.source_url) continue
      const matches = matchingRecipes.filter(m => m.source_url === r.source_url)
      if (matches.length === 0) continue
      const userIds = [...new Set(matches.map(m => m.user_id))]
      const avatars = userIds.slice(0, 3).map(id => profiles?.find(p => p.id === id)).filter(Boolean)
      map[r.id] = { count: userIds.length, avatars }
    }
    setCircleFriendsMap(map)
  }

const allTags = [...new Set([
    ...PRESET_TAGS,
    ...recipes.flatMap(r => r.tags || [])
  ])]

  const filtered = recipes
    .filter(r => {
      if (filter === 'Want to Make') return r.status === 'want_to_make'
      if (filter === 'Cooked') return r.status === 'cooked'
      if (filter === 'Never Again') return r.status === 'never_again'
      return true
    })
    .filter(r => {
      if (!tagFilter) return true
      return (r.tags || []).includes(tagFilter)
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
      return 0
    })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '24px', paddingTop: '70px', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

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

        {/* Tag filters */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} style={{
              padding: '5px 12px', borderRadius: 'var(--radius-pill)',
              border: tagFilter === tag ? 'none' : '1.5px solid var(--tan)',
              background: tagFilter === tag ? 'var(--ink)' : 'transparent',
              color: tagFilter === tag ? 'var(--cream)' : 'var(--muted)',
              fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600',
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0
            }}>{tag}</button>
          ))}
        </div>

        {/* Recipe count */}
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
          {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
        </div>

        {/* Recipe list */}
        {circleModal && (
          <CircleFriendsModal
            sourceUrl={circleModal}
            session={session}
            onClose={() => setCircleModal(null)}
            onSelectUser={onSelectUser}
          />
        )}

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
                cursor: 'pointer', transition: 'box-shadow 0.15s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                    {(recipe.tags || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
                        {(recipe.tags || []).map(tag => (
                          <span key={tag} style={{
                            padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                            background: 'var(--parchment)', fontSize: '10px',
                            fontWeight: '600', color: 'var(--charcoal)'
                          }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{
                    ...verdictStyle[recipe.status],
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    fontSize: '11px', fontWeight: '600', flexShrink: 0
                  }}>{statusLabel[recipe.status]}</div>
                </div>
                {circleFriendsMap[recipe.id] && (
                  <div onClick={e => { e.stopPropagation(); setCircleModal(recipe.source_url) }} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    marginTop: '10px', paddingTop: '10px',
                    borderTop: '1px solid var(--parchment)'
                  }}>
                    <div style={{ display: 'flex' }}>
                      {circleFriendsMap[recipe.id].avatars.map((p, i) => (
                        <div key={p.id} style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: '8px', fontWeight: '700', color: 'var(--cream)',
                          marginLeft: i === 0 ? '0' : '-5px', border: '1.5px solid var(--warm-white)', flexShrink: 0
                        }}>{(p.full_name || p.username || '?')[0].toUpperCase()}</div>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      <span style={{ fontWeight: '600', color: 'var(--clay)' }}>{circleFriendsMap[recipe.id].count} {circleFriendsMap[recipe.id].count === 1 ? 'friend' : 'friends'}</span> also {circleFriendsMap[recipe.id].count === 1 ? 'has' : 'have'} this
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}