import { useState, useEffect, useRef } from 'react'
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

const SORT_OPTIONS = ['Newest', 'Oldest', 'A→Z', 'Cook Score', 'Friends Have It']

export default function Cookbook({ session, onAddRecipe, onSelectRecipe, defaultFilter, onSelectUser, savedScrollY, onScrollChange }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(defaultFilter || 'All')
  const [tagFilters, setTagFilters] = useState([])
  const [search, setSearch] = useState('')
  const [sortIndex, setSortIndex] = useState(0)
  const [circleFriendsMap, setCircleFriendsMap] = useState({})
  const [cookScoresMap, setCookScoresMap] = useState({})
  const [circleModal, setCircleModal] = useState(null)
  const headerRef = useRef(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  useEffect(() => {
    fetchRecipes()
  }, [session])

  // Measure header height for sticky offset
  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight)
    }
  }, [loading, tagFilters.length])

  // Restore scroll position
  useEffect(() => {
    if (!loading && savedScrollY) {
      const container = document.getElementById('cookbook-scroll-container')
      if (container) container.scrollTop = savedScrollY
    }
  }, [loading])

  // Save scroll position on scroll
  useEffect(() => {
    const container = document.getElementById('cookbook-scroll-container')
    if (!container) return
    function handleScroll() {
      onScrollChange && onScrollChange(container.scrollTop)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [onScrollChange])

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
      fetchCookScores(data)
    }
    setLoading(false)
  }

  async function fetchCookScores(recipeList) {
    const recipeIds = recipeList.map(r => r.id)
    if (recipeIds.length === 0) return
    const { data: cooks } = await supabase
      .from('cooks')
      .select('recipe_id, flavor, effort, would_share, true_to_recipe')
      .in('recipe_id', recipeIds)
    if (!cooks || cooks.length === 0) return
    const map = {}
    for (const cook of cooks) {
      const scores = [cook.flavor, cook.effort, cook.would_share, cook.true_to_recipe].filter(Boolean)
      if (scores.length === 0) continue
      if (!map[cook.recipe_id]) map[cook.recipe_id] = []
      map[cook.recipe_id].push(...scores)
    }
    const avgMap = {}
    for (const [recipeId, scores] of Object.entries(map)) {
      avgMap[recipeId] = scores.reduce((a, b) => a + b, 0) / scores.length
    }
    setCookScoresMap(avgMap)
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

  const statusCounts = {
    All: recipes.length,
    'Want to Make': recipes.filter(r => r.status === 'want_to_make').length,
    Cooked: recipes.filter(r => r.status === 'cooked').length,
    'Never Again': recipes.filter(r => r.status === 'never_again').length,
  }

  const toggleTag = (tag) => {
    setTagFilters(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const filtered = recipes
    .filter(r => {
      if (filter === 'Want to Make') return r.status === 'want_to_make'
      if (filter === 'Cooked') return r.status === 'cooked'
      if (filter === 'Never Again') return r.status === 'never_again'
      return true
    })
    .filter(r => {
      if (tagFilters.length === 0) return true
      return tagFilters.some(tag => (r.tags || []).includes(tag))
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
      if (SORT_OPTIONS[sortIndex] === 'A→Z') return a.title.localeCompare(b.title)
      if (SORT_OPTIONS[sortIndex] === 'Oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (SORT_OPTIONS[sortIndex] === 'Cook Score') return (cookScoresMap[b.id] || 0) - (cookScoresMap[a.id] || 0)
      if (SORT_OPTIONS[sortIndex] === 'Friends Have It') return (circleFriendsMap[b.id]?.count || 0) - (circleFriendsMap[a.id]?.count || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const hasActiveFilters = tagFilters.length > 0

  const emptyMessage = () => {
    if (search) return { title: `No results for "${search}"`, sub: 'Try a different search.', cta: false }
    if (tagFilters.length > 0) return { title: 'No recipes match those tags', sub: 'Try removing a tag filter.', cta: false }
    if (filter === 'Want to Make') return { title: 'No recipes saved yet', sub: 'Save recipes you want to try.', cta: false }
    if (filter === 'Cooked') return { title: 'No cooks logged yet', sub: 'Log a cook from any recipe in your Cookbook.', cta: false }
    if (filter === 'Never Again') return { title: 'No recipes here', sub: 'Hopefully it stays that way.', cta: false }
    return { title: 'Your Cookbook is empty', sub: 'Add your first recipe to get started.', cta: true }
  }

  const chipStyle = (active) => ({
    padding: '6px 14px', borderRadius: 'var(--radius-pill)',
    border: active ? 'none' : '1.5px solid var(--tan)',
    background: active ? 'var(--clay)' : 'transparent',
    color: active ? 'var(--cream)' : 'var(--muted)',
    fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
    display: 'inline-flex', alignItems: 'center', gap: '5px'
  })

  const tagChipStyle = (active) => ({
    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
    border: `1.5px solid ${active ? 'var(--clay)' : 'var(--tan)'}`,
    background: active ? '#F0E0D0' : 'transparent',
    color: active ? '#8A3A10' : 'var(--muted)',
    fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0
  })

  const badgeStyle = (active) => ({
    background: active ? 'rgba(255,255,255,0.25)' : '#E8DFD0',
    color: active ? 'rgba(255,255,255,0.9)' : 'var(--muted)',
    borderRadius: '100px', padding: '1px 6px',
    fontSize: '10px', fontWeight: '700'
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingTop: '54px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Sticky search only */}
        <div ref={headerRef} style={{
          position: 'sticky', top: '54px', zIndex: 100,
          background: 'var(--cream)', paddingTop: '12px',
          borderBottom: '1px solid var(--parchment)',
          paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'var(--warm-white)', borderRadius: 'var(--radius-md)',
            padding: '10px 14px', border: '1.5px solid var(--tan)'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
              <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes..."
              style={{ flex: 1, border: 'none', background: 'none', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>
        </div>

        {/* Scrollable filters + list */}
        <div style={{ padding: '16px 24px 0' }}>

          {/* Status label */}
          <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Status</div>

          {/* Status chips */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '12px' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={chipStyle(filter === f)}>
                {f}
                <span style={badgeStyle(filter === f)}>{statusCounts[f]}</span>
              </button>
            ))}
          </div>

          <div style={{ height: '1px', background: 'var(--parchment)', marginBottom: '12px' }} />

          {/* Tags + Sort row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Tags <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: '10px', color: '#B0A090' }}>(select multiple)</span>
            </div>
            <select
              value={SORT_OPTIONS[sortIndex]}
              onChange={e => setSortIndex(SORT_OPTIONS.indexOf(e.target.value))}
              style={{
                padding: '5px 10px', borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--tan)', background: 'var(--warm-white)',
                color: 'var(--muted)', fontFamily: 'var(--font-body)',
                fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                outline: 'none', flexShrink: 0
              }}>
              {SORT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Tag chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {allTags.map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)} style={tagChipStyle(tagFilters.includes(tag))}>
                {tag}
              </button>
            ))}
          </div>

          {/* Active filters bar */}
          {hasActiveFilters && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M6 12h12M9 18h6" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: '12px', color: 'var(--clay)', fontWeight: '600' }}>
                {tagFilters.length} {tagFilters.length === 1 ? 'tag' : 'tags'} active
              </span>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>·</span>
              <button onClick={() => setTagFilters([])} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--clay)', fontSize: '12px', fontWeight: '600',
                textDecoration: 'underline', padding: 0
              }}>Clear</button>
            </div>
          )}
        </div>

        {/* Scrollable list */}
        <div style={{ padding: '16px 24px 100px' }}>

          {/* Recipe count */}
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
            {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
          </div>

          {circleModal && (
            <CircleFriendsModal sourceUrl={circleModal} session={session}
              onClose={() => setCircleModal(null)} onSelectUser={onSelectUser} />
          )}

          {loading ? null : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--parchment)'
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '500', color: 'var(--ink)', marginBottom: '8px' }}>
                {emptyMessage().title}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
                {emptyMessage().sub}
              </div>
              {emptyMessage().cta && (
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
                        <img
                          src={recipe.image_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => e.target.parentElement.style.display = 'none'}
                        />
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
                              background: tagFilters.includes(tag) ? '#F0E0D0' : 'var(--parchment)',
                              border: tagFilters.includes(tag) ? '1px solid #C4713A' : 'none',
                              fontSize: '10px', fontWeight: '600',
                              color: tagFilters.includes(tag) ? '#8A3A10' : 'var(--charcoal)'
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
                      marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--parchment)'
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="9" cy="7" r="4" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--clay)' }}>
                          {circleFriendsMap[recipe.id].count} {circleFriendsMap[recipe.id].count === 1 ? 'friend' : 'friends'}
                        </span> made this too
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}