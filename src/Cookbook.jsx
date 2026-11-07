import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import CircleFriendsModal from './CircleFriendsModal'
import { IconX, IconBook, IconBookmark, IconPot, IconPlus, IconCheck } from './icons'
import EmptyState from './EmptyState'
import { canonicalSpellings, recipeTags, sortTags, tagKey, hasTag, tagChoices, addTag } from './tags'
import { AlphabetRail, TagSheet } from './CookbookTools'
import { letterOf } from './letters'
import { confirmSheet, toast } from './ui'

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

const SORT_OPTIONS = ['Newest', 'Oldest', 'A to Z', 'Cook Score', 'Friends Have It']

export default function Cookbook({ session, onAddRecipe, onSelectRecipe, defaultFilter, onSelectUser, savedScrollY, onScrollChange, visible }) {
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
  // Select mode: tick recipes, then add a tag, remove a tag, or delete them
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [tagSheet, setTagSheet] = useState(null) // 'add' | 'remove' | null
  const [working, setWorking] = useState(false)
  const loadedRef = useRef(false)
  const listRef = useRef(null)
  const [railTop, setRailTop] = useState(null)

  // Load once, then quietly reload every time you come back to the Cookbook,
  // so edits (tags, titles, deletes) show up without restarting the app
  useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; fetchRecipes(); return }
    if (visible) fetchRecipes(true)
  }, [session, visible])

  // Leaving the Cookbook ends Select mode
  useEffect(() => {
    if (!visible) { setSelecting(false); setSelected(new Set()); setTagSheet(null) }
  }, [visible])

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

  async function fetchRecipes(quiet = false) {
    if (!quiet) setLoading(true)
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
      .from('profiles').select('id, full_name, username, avatar_url').in('id', allUserIds)
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

  // One spelling per tag (so "dinner" and "Dinner" are one chip), with how many
  // recipes use it. Only tags actually in this cookbook are shown.
  const tagSpellings = canonicalSpellings(recipes.flatMap(r => r.tags || []))
  const tagCounts = {}
  for (const r of recipes) {
    for (const t of recipeTags(r.tags, tagSpellings)) tagCounts[t] = (tagCounts[t] || 0) + 1
  }
  const allTags = sortTags(Object.keys(tagCounts))

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

  // Search looks at the name first, then tags, ingredients and notes ("feta" finds recipes that use feta)
  const q = search.trim().toLowerCase()
  const matchesName = (r) => String(r.title ?? '').toLowerCase().includes(q) || String(r.source_name ?? '').toLowerCase().includes(q)
  const matchesInside = (r) =>
    (r.tags || []).some(t => String(t).toLowerCase().includes(q)) ||
    String(r.ingredients ?? '').toLowerCase().includes(q) ||
    String(r.notes ?? '').toLowerCase().includes(q)

  const sorted = recipes
    .filter(r => {
      if (filter === 'Want to Make') return r.status === 'want_to_make'
      if (filter === 'Cooked') return r.status === 'cooked'
      if (filter === 'Never Again') return r.status === 'never_again'
      return true
    })
    .filter(r => {
      if (tagFilters.length === 0) return true
      return tagFilters.some(tag => hasTag(r.tags, tag))
    })
    .filter(r => !q || matchesName(r) || matchesInside(r))
    .sort((a, b) => {
      if (SORT_OPTIONS[sortIndex] === 'A to Z') return a.title.localeCompare(b.title)
      if (SORT_OPTIONS[sortIndex] === 'Oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (SORT_OPTIONS[sortIndex] === 'Cook Score') return (cookScoresMap[b.id] || 0) - (cookScoresMap[a.id] || 0)
      if (SORT_OPTIONS[sortIndex] === 'Friends Have It') return (circleFriendsMap[b.id]?.count || 0) - (circleFriendsMap[a.id]?.count || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })
  // When searching, name matches come first
  const filtered = q ? [...sorted.filter(matchesName), ...sorted.filter(r => !matchesName(r))] : sorted

  // ── A to Z rail ──
  const isAtoZ = SORT_OPTIONS[sortIndex] === 'A to Z'
  const firstOfLetter = {}
  if (isAtoZ) {
    for (const r of filtered) {
      const l = letterOf(r.title)
      if (!(l in firstOfLetter)) firstOfLetter[l] = r.id
    }
  }
  const showRail = isAtoZ && !selecting && filtered.length >= 8

  // The rail starts where the recipe list starts (never over the filters and tags),
  // then sticks just under the search bar once you scroll past them
  useEffect(() => {
    if (!showRail) return
    const container = document.getElementById('cookbook-scroll-container')
    function place() {
      if (!listRef.current || !headerRef.current) return
      const top = Math.max(headerRef.current.getBoundingClientRect().bottom, listRef.current.getBoundingClientRect().top) + 8
      setRailTop(Math.round(top))
    }
    place()
    container?.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    return () => {
      container?.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  }, [showRail, tagFilters.length, filtered.length, loading, visible])

  function jumpToLetter(letter) {
    const container = document.getElementById('cookbook-scroll-container')
    const el = container?.querySelector(`[data-letter="${letter}"]`)
    if (!container || !el || !headerRef.current) return
    container.scrollTop += el.getBoundingClientRect().top - headerRef.current.getBoundingClientRect().bottom - 10
  }

  // ── Select mode ──
  function startSelecting() { setSelecting(true); setSelected(new Set()) }
  function stopSelecting() { setSelecting(false); setSelected(new Set()); setTagSheet(null) }
  function toggleSelected(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allShownSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))
  function toggleSelectAll() {
    setSelected(allShownSelected ? new Set() : new Set(filtered.map(r => r.id)))
  }
  const selectedRecipes = recipes.filter(r => selected.has(r.id))
  const n = selectedRecipes.length
  const recipesWord = (count) => (count === 1 ? '1 recipe' : `${count} recipes`)

  async function saveTags(changes) {
    const results = await Promise.all(changes.map(({ id, tags }) =>
      supabase.from('recipes').update({ tags, updated_at: new Date().toISOString() }).eq('id', id)
    ))
    const failed = results.filter(r => r.error).length
    const byId = Object.fromEntries(changes.map(c => [c.id, c.tags]))
    setRecipes(prev => prev.map(r => (r.id in byId ? { ...r, tags: byId[r.id] } : r)))
    return failed
  }

  async function addTagToSelected(tag) {
    setTagSheet(null)
    setWorking(true)
    const choices = tagChoices(recipes.flatMap(r => r.tags || []))
    const changes = selectedRecipes
      .filter(r => !hasTag(r.tags, tag))
      .map(r => ({ id: r.id, tags: addTag(r.tags || [], tag, choices) }))
    const failed = changes.length ? await saveTags(changes) : 0
    setWorking(false)
    if (failed) { toast(`Couldn't update ${recipesWord(failed)}. Try again?`, { icon: null }); return }
    toast(`Tagged ${recipesWord(n)} ${tag}`)
    stopSelecting()
  }

  async function removeTagFromSelected(tag) {
    setTagSheet(null)
    setWorking(true)
    const changes = selectedRecipes
      .filter(r => hasTag(r.tags, tag))
      .map(r => ({ id: r.id, tags: (r.tags || []).filter(t => tagKey(t) !== tagKey(tag)) }))
    const failed = changes.length ? await saveTags(changes) : 0
    setWorking(false)
    if (failed) { toast(`Couldn't update ${recipesWord(failed)}. Try again?`, { icon: null }); return }
    toast(`Removed ${tag} from ${recipesWord(changes.length)}`)
    stopSelecting()
  }

  async function deleteSelected() {
    const ok = await confirmSheet({
      title: `Delete ${recipesWord(n)}?`,
      message: "They'll be removed from your Cookbook. This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    setWorking(true)
    const ids = selectedRecipes.map(r => r.id)
    const { error } = await supabase.from('recipes').delete().in('id', ids)
    setWorking(false)
    if (error) { toast("Couldn't delete those. Try again?", { icon: null }); return }
    setRecipes(prev => prev.filter(r => !selected.has(r.id)))
    toast(`Deleted ${recipesWord(ids.length)}`)
    stopSelecting()
  }

  const hasActiveFilters = tagFilters.length > 0

  const emptyMessage = () => {
    if (search) return { title: `No results for "${search}"`, body: 'Try a different search.' }
    if (tagFilters.length > 0) return { title: 'No recipes match those tags', body: 'Try removing a tag filter.' }
    const add = { label: 'Add a recipe', icon: IconPlus, onClick: onAddRecipe }
    if (filter === 'Want to Make') return { icon: IconBookmark, title: 'Save something to try', body: "Recipes you save but haven't cooked yet live here.", primary: add }
    if (filter === 'Cooked') return { icon: IconPot, title: 'Nothing cooked yet', body: "Open a recipe you've made and tap Log a Cook to give it your verdict." }
    if (filter === 'Never Again') return { title: 'No Never Agains', body: 'Hopefully it stays that way.' }
    return {
      icon: IconBook,
      title: 'Your Cookbook starts here',
      body: 'Save a recipe from any website, TikTok or Instagram, or snap a page from a cookbook.',
      primary: add
    }
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
    padding: '5px 11px', borderRadius: 'var(--radius-pill)',
    border: `1.5px solid ${active ? 'var(--clay)' : 'var(--tan)'}`,
    background: active ? 'var(--clay)' : 'transparent',
    color: active ? 'var(--cream)' : 'var(--charcoal)',
    fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', gap: '5px'
  })

  const badgeStyle = (active) => ({
    background: active ? 'rgba(255,255,255,0.25)' : '#E8DFD0',
    color: active ? 'rgba(255,255,255,0.9)' : 'var(--muted)',
    borderRadius: '100px', padding: '1px 6px',
    fontSize: '10px', fontWeight: '700'
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingTop: 'var(--top-bar-h)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Sticky search only */}
        <div ref={headerRef} style={{
          position: 'sticky', top: 'var(--top-bar-h)', zIndex: 100,
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
              placeholder="Search recipes or ingredients..."
              style={{ flex: 1, border: 'none', background: 'none', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', padding: 0, lineHeight: 1 }}><IconX size={13} strokeWidth={2.2} /></button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Tags</div>
              {hasActiveFilters && (
                <button onClick={() => setTagFilters([])} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'var(--clay)', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600'
                }}>Clear {tagFilters.length}</button>
              )}
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

          {/* Tag chips: one row you can swipe sideways */}
          {allTags.length > 0 ? (
            <div className="nom-hscroll" style={{
              display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '8px',
              margin: '0 -24px 8px', padding: '0 24px 2px',
              WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none'
            }}>
              {allTags.map(tag => {
                const active = tagFilters.includes(tag)
                return (
                  <button key={tag} onClick={() => toggleTag(tag)} aria-pressed={active} style={tagChipStyle(active)}>
                    {tag}
                    <span style={{ fontSize: '11px', fontWeight: '500', color: active ? 'var(--cream)' : 'var(--muted)', opacity: active ? 0.85 : 1 }}>{tagCounts[tag]}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Add tags to a recipe to filter by them here.</div>
          )}

        </div>

        {/* Scrollable list */}
        <div ref={listRef} style={{
          padding: '16px 24px',
          paddingRight: showRail ? '34px' : '24px',
          paddingBottom: selecting ? 'calc(var(--nav-clearance) + 84px)' : 'var(--nav-clearance)',
        }}>

          {/* Recipe count + Select */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', minHeight: '22px' }}>
            <div style={{ fontSize: '12px', color: selecting ? 'var(--ink)' : 'var(--muted)', fontWeight: selecting ? '600' : '400' }}>
              {selecting
                ? (n === 0 ? 'Tap recipes to select' : `${n} selected`)
                : `${filtered.length} ${filtered.length === 1 ? 'recipe' : 'recipes'}`}
            </div>
            {filtered.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {selecting && (
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--clay)' }}>
                    {allShownSelected ? 'Select none' : 'Select all'}
                  </button>
                )}
                <button onClick={selecting ? stopSelecting : startSelecting} style={{ background: selecting ? 'var(--clay)' : 'var(--parchment)', color: selecting ? 'var(--cream)' : 'var(--charcoal)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '5px 14px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600' }}>
                  {selecting ? 'Done' : 'Select'}
                </button>
              </div>
            )}
          </div>

          {circleModal && (
            <CircleFriendsModal sourceUrl={circleModal} session={session}
              onClose={() => setCircleModal(null)} onSelectUser={onSelectUser} />
          )}

          {loading ? null : filtered.length === 0 ? (
            <EmptyState {...emptyMessage()} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(recipe => {
                const isSelected = selected.has(recipe.id)
                const foundInside = q && !matchesName(recipe) && String(recipe.ingredients ?? '').toLowerCase().includes(q)
                return (
                <div key={recipe.id}
                  data-letter={showRail && firstOfLetter[letterOf(recipe.title)] === recipe.id ? letterOf(recipe.title) : undefined}
                  onClick={() => (selecting ? toggleSelected(recipe.id) : onSelectRecipe(recipe))}
                  style={{
                  background: isSelected ? '#FBF0E6' : 'var(--warm-white)', borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isSelected ? 'var(--clay)' : 'var(--parchment)'}`, padding: '16px 18px',
                  cursor: 'pointer', transition: 'box-shadow 0.15s, background 0.15s, border-color 0.15s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {selecting && (
                      <div aria-hidden="true" style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                        border: isSelected ? 'none' : '1.5px solid var(--tan)',
                        background: isSelected ? 'var(--clay)' : 'var(--cream)',
                        color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <IconCheck size={14} strokeWidth={2.6} />}
                      </div>
                    )}
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
                      {foundInside && (
                        <div style={{ fontSize: '11px', color: 'var(--clay)', fontWeight: '600', marginTop: '3px' }}>Uses {search.trim()}</div>
                      )}
                      {(recipe.tags || []).length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
                          {recipeTags(recipe.tags, tagSpellings).map(tag => {
                            const active = tagFilters.some(t => tagKey(t) === tagKey(tag))
                            return (
                              <span key={tag} style={{
                                padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                                background: active ? 'var(--clay)' : 'var(--parchment)',
                                fontSize: '10px', fontWeight: '600',
                                color: active ? 'var(--cream)' : 'var(--charcoal)'
                              }}>{tag}</span>
                            )
                          })}
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
                    <div onClick={e => { if (selecting) return; e.stopPropagation(); setCircleModal(recipe.source_url) }} style={{
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
                        </span> {circleFriendsMap[recipe.id].count === 1 ? 'has' : 'have'} this
                      </span>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showRail && (
        <AlphabetRail available={new Set(Object.keys(firstOfLetter))} onJump={jumpToLetter} top={railTop} />
      )}

      {/* Select mode actions, just above the bottom bar */}
      {selecting && (
        <div style={{
          position: 'fixed', left: 0, right: 0, zIndex: 120,
          bottom: 'var(--nav-clearance)', maxWidth: '480px', margin: '0 auto',
          padding: '0 16px 4px',
        }}>
          <div style={{
            display: 'flex', gap: '8px', background: 'var(--warm-white)',
            border: '1px solid var(--parchment)', borderRadius: 'var(--radius-pill)',
            padding: '6px', boxShadow: '0 6px 24px rgba(28,26,23,0.14)',
          }}>
            {[
              { label: 'Add tag', onClick: () => setTagSheet('add'), color: 'var(--cream)', bg: 'var(--clay)' },
              { label: 'Remove tag', onClick: () => setTagSheet('remove'), color: 'var(--charcoal)', bg: 'var(--parchment)' },
              { label: 'Delete', onClick: deleteSelected, color: '#9B4040', bg: '#F4E8E8' },
            ].map(a => {
              const off = n === 0 || working
              return (
                <button key={a.label} onClick={a.onClick} disabled={off} style={{
                  flex: 1, padding: '11px 6px', border: 'none', borderRadius: 'var(--radius-pill)',
                  background: off ? 'var(--parchment)' : a.bg, color: off ? 'var(--tan)' : a.color,
                  fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '700',
                  cursor: off ? 'default' : 'pointer', whiteSpace: 'nowrap',
                }}>{a.label}</button>
              )
            })}
          </div>
        </div>
      )}

      {tagSheet && (
        <TagSheet
          mode={tagSheet}
          count={n}
          options={tagSheet === 'add'
            ? tagChoices(recipes.flatMap(r => r.tags || []))
            : recipeTags(selectedRecipes.flatMap(r => r.tags || []), tagSpellings)}
          onPick={tagSheet === 'add' ? addTagToSelected : removeTagFromSelected}
          onClose={() => setTagSheet(null)}
        />
      )}
    </div>
  )
}