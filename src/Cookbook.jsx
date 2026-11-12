import { useState, useEffect, useRef } from 'react'
import { COOK_STATS_FIELDS, recipeStats, compareFavorites } from './cookStats'
import { supabase } from './supabase'
import CircleFriendsModal from './CircleFriendsModal'
import { IconX, IconBook, IconBookmark, IconPot, IconPlus, IconCheck, IconSliders, IconChevronDown } from './icons'
import EmptyState from './EmptyState'
import { canonicalSpellings, recipeTags, sortTags, tagKey, hasTag, tagChoices, addTag, PRESET_TAGS } from './tags'
import { AlphabetRail, TagSheet, FilterSheet } from './CookbookTools'
import BottomBar, { BAR_SHADOW } from './BottomBar'
import { letterOf } from './letters'
import { confirmSheet, toast, LoadError } from './ui'
import { tap } from './haptics'

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

const SORT_OPTIONS = ['Newest', 'Oldest', 'A to Z', 'Favorites', 'Friends Have It']
const SORT_LABELS = { 'Friends Have It': 'Friends have it' }
const STATUS_LABELS = { 'Want to Make': 'Want to make', 'Never Again': 'Never again' }

export default function Cookbook({ session, onAddRecipe, onSelectRecipe, defaultFilter, onSelectUser, savedScrollY, onScrollChange, visible }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
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
  const [filterSheet, setFilterSheet] = useState(false)
  const pressTimer = useRef(null)
  const pressStart = useRef(null)
  const longPressed = useRef(false)
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

  // Once the filter chips scroll up under the search bar, show what's filtered in the sticky header
  const filtersRef = useRef(null)
  const [filtersHidden, setFiltersHidden] = useState(false)
  useEffect(() => {
    const container = document.getElementById('cookbook-scroll-container')
    if (!container) return
    function check() {
      const f = filtersRef.current, h = headerRef.current
      if (!f || !h) return
      setFiltersHidden(f.getBoundingClientRect().bottom < h.getBoundingClientRect().bottom)
    }
    check()
    container.addEventListener('scroll', check, { passive: true })
    return () => container.removeEventListener('scroll', check)
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
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    // Never show "no recipes yet" just because the connection dropped
    if (error) {
      if (recipes.length > 0) toast("Couldn't refresh your Cookbook. Check your connection.", { icon: null })
      else setLoadError(true)
      setLoading(false)
      return
    }
    setLoadError(false)
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
      .select(COOK_STATS_FIELDS)
      .in('recipe_id', recipeIds)
    if (!cooks || cooks.length === 0) return
    const avgMap = recipeStats(cooks)
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
  // recipes use it. The preset tags always show (no count until used), so new
  // members can see what tags are for.
  const tagSpellings = canonicalSpellings(recipes.flatMap(r => r.tags || []))
  const tagCounts = {}
  for (const r of recipes) {
    for (const t of recipeTags(r.tags, tagSpellings)) tagCounts[t] = (tagCounts[t] || 0) + 1
  }
  const usedKeys = new Set(Object.keys(tagCounts).map(tagKey))
  const allTags = sortTags([...Object.keys(tagCounts), ...PRESET_TAGS.filter(p => !usedKeys.has(tagKey(p)))])
  // The swipe row: tags you've turned on come first
  const rowTags = [...tagFilters, ...allTags.filter(t => !tagFilters.includes(t))]

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
      if (SORT_OPTIONS[sortIndex] === 'Favorites') return compareFavorites(cookScoresMap[a.id], cookScoresMap[b.id]) || (new Date(b.created_at) - new Date(a.created_at))
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

  // Press and hold a recipe to start selecting, with that recipe already picked
  function pressDown(e, id) {
    longPressed.current = false
    if (selecting || e.touches.length !== 1) return
    pressStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      setSelecting(true)
      setSelected(new Set([id]))
    }, 450)
  }
  function pressMove(e) {
    const p = pressStart.current
    if (!p) return
    const t = e.touches[0]
    if (Math.abs(t.clientX - p.x) > 10 || Math.abs(t.clientY - p.y) > 10) pressUp()
  }
  function pressUp() { clearTimeout(pressTimer.current); pressStart.current = null }
  useEffect(() => () => clearTimeout(pressTimer.current), [])
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingTop: 'var(--top-bar-h)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Sticky search */}
        <div ref={headerRef} style={{
          position: 'sticky', top: 'var(--top-bar-h)', zIndex: 100,
          background: 'var(--cream)', paddingTop: '12px',
          borderBottom: '1px solid var(--parchment)',
          paddingBottom: '12px', paddingLeft: '20px', paddingRight: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            flex: 1, minWidth: 0,
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
              aria-label="Search your Cookbook"
              placeholder="Search recipes or ingredients"
              style={{ flex: 1, border: 'none', background: 'none', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
            />
            {search && (
              <button className="nom-hit" aria-label="Clear search" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', padding: 0, lineHeight: 1 }}><IconX size={13} strokeWidth={2.2} /></button>
            )}
          </div>

          </div>

          {/* What's filtered, once the chips have scrolled out of sight */}
          {filtersHidden && (filter !== 'All' || tagFilters.length > 0) && (
            // Hangs just under the search bar (absolute) so the list doesn't jump when it appears
            <div className="nom-hscroll" style={{ position: 'absolute', top: '100%', left: 0, right: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', background: 'var(--cream)', borderBottom: '1px solid var(--parchment)', overflowX: 'auto', scrollbarWidth: 'none' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>Showing</span>
              {filter !== 'All' && (
                <button onClick={() => setFilter('All')} aria-label={`Remove ${STATUS_LABELS[filter] || filter} filter`} style={{ ...chipStyle(true), padding: '5px 10px' }}>{STATUS_LABELS[filter] || filter}<IconX size={11} strokeWidth={2.4} /></button>
              )}
              {tagFilters.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)} aria-label={`Remove ${tag} filter`} style={{ ...chipStyle(true), padding: '5px 10px' }}>{tag}<IconX size={11} strokeWidth={2.4} /></button>
              ))}
            </div>
          )}
        </div>

        {/* Status switch + one swipe row of tags */}
        <div style={{ padding: '12px 20px 0' }}>

          {/* Status: a sliding switch. The orange thumb glides to the picked status,
              and you can drag your finger across to slide it, like iPhone switches. */}
          {(() => {
            const idx = Math.max(0, FILTERS.indexOf(filter))
            const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
            const pickAt = (e) => {
              const box = e.currentTarget.getBoundingClientRect()
              const x = e.touches[0].clientX - box.left
              const i = Math.min(FILTERS.length - 1, Math.max(0, Math.floor((x / box.width) * FILTERS.length)))
              if (FILTERS[i] !== filter) { tap(); setFilter(FILTERS[i]) }
            }
            return (
              <div role="group" aria-label="Status" onTouchMove={pickAt} style={{
                position: 'relative', display: 'flex', background: 'var(--warm-white)', border: '1.5px solid var(--tan)',
                borderRadius: 'var(--radius-pill)', padding: '3px', marginBottom: '12px', touchAction: 'pan-y',
              }}>
                <div aria-hidden="true" style={{
                  position: 'absolute', top: '3px', bottom: '3px',
                  left: `calc(3px + ${idx} * (100% - 6px) / ${FILTERS.length})`,
                  width: `calc((100% - 6px) / ${FILTERS.length})`,
                  background: 'var(--clay)', borderRadius: 'var(--radius-pill)',
                  boxShadow: '0 1px 3px rgba(28,26,23,0.15)',
                  transition: reduce ? 'none' : 'left 0.28s cubic-bezier(0.3, 0.9, 0.3, 1)',
                }} />
                {FILTERS.map(f => {
                  const on = filter === f
                  return (
                    <button key={f} onClick={() => { if (!on) tap(); setFilter(f) }} aria-pressed={on} style={{
                      position: 'relative', zIndex: 1, flex: 1, minWidth: 0, minHeight: '36px', padding: '0 4px',
                      border: 'none', background: 'transparent', color: on ? 'var(--cream)' : 'var(--charcoal)',
                      fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', cursor: 'pointer',
                      transition: reduce ? 'none' : 'color 0.2s ease',
                    }}>{STATUS_LABELS[f] || f}</button>
                  )
                })}
              </div>
            )
          })()}

          {/* Filters first (every tag lives in its sheet), then the tags themselves */}
          <div className="nom-hscroll" style={{
            display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto',
            margin: '0 -20px', padding: '0 20px 2px',
            WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none'
          }}>
            <button onClick={() => setFilterSheet(true)} aria-label={tagFilters.length ? `Filters, ${tagFilters.length} on` : 'Filters'} style={{
              flexShrink: 0, minHeight: '32px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 12px',
              borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--charcoal)', background: 'var(--warm-white)', color: 'var(--ink)',
              fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', cursor: 'pointer'
            }}>
              <IconSliders size={14} strokeWidth={2} />
              Filters
              {tagFilters.length > 0 && (
                <span aria-hidden="true" style={{ minWidth: '16px', height: '16px', borderRadius: '8px', background: 'var(--clay)', color: 'var(--cream)', fontSize: '10px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{tagFilters.length}</span>
              )}
            </button>
            <div aria-hidden="true" style={{ flexShrink: 0, width: '1px', height: '20px', background: 'var(--tan)' }} />
            {rowTags.map(tag => {
              const active = tagFilters.includes(tag)
              return (
                <button key={tag} onClick={() => toggleTag(tag)} aria-pressed={active} style={{ ...tagChipStyle(active), minHeight: '32px' }}>
                  {tag}
                  {tagCounts[tag] > 0 && <span style={{ fontSize: '11px', fontWeight: '500', color: active ? 'var(--cream)' : 'var(--muted)', opacity: active ? 0.85 : 1 }}>{tagCounts[tag]}</span>}
                </button>
              )
            })}
          </div>
          {/* Marks the bottom of the filters, for the "Showing" strip in the sticky header */}
          <div ref={filtersRef} />

        </div>

        {/* Scrollable list */}
        <div ref={listRef} style={{
          padding: '16px 20px',
          paddingRight: showRail ? '34px' : '20px',
          paddingBottom: 'var(--nav-clearance)',
        }}>

          {/* Recipe count, then Select and Sort: the things that act on the list sit right above it */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px', minHeight: '36px' }}>
            <div style={{ fontSize: '12px', color: selecting ? 'var(--ink)' : 'var(--muted)', fontWeight: selecting ? '600' : '400' }}>
              {selecting
                ? 'Tap recipes to select'
                : `${filtered.length} ${filtered.length === 1 ? 'recipe' : 'recipes'}`}
            </div>
            {!selecting && recipes.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={startSelecting} style={{
                  minHeight: '32px', padding: '0 14px', background: 'var(--parchment)', color: 'var(--charcoal)', border: 'none',
                  borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap'
                }}>Select</button>
                {/* Looks like a pill; the real (invisible) select on top opens the iPhone picker */}
                <div style={{
                  position: 'relative', minHeight: '32px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 12px',
                  background: 'var(--warm-white)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
                  fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', whiteSpace: 'nowrap'
                }}>
                  {SORT_LABELS[SORT_OPTIONS[sortIndex]] || SORT_OPTIONS[sortIndex]}
                  <IconChevronDown size={12} strokeWidth={2.4} />
                  <select
                    aria-label="Sort recipes"
                    value={SORT_OPTIONS[sortIndex]}
                    onChange={e => setSortIndex(SORT_OPTIONS.indexOf(e.target.value))}
                    style={{
                      // On top of the pill and a little taller than it, so the tap area is 44px
                      position: 'absolute', left: 0, right: 0, top: '-6px', bottom: '-6px', zIndex: 1,
                      width: '100%', opacity: 0, cursor: 'pointer', fontSize: '16px',
                      WebkitAppearance: 'none', appearance: 'none', border: 'none', background: 'transparent',
                    }}>
                    {SORT_OPTIONS.map(o => <option key={o} value={o}>{SORT_LABELS[o] || o}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {circleModal && (
            <CircleFriendsModal sourceUrl={circleModal} session={session}
              onClose={() => setCircleModal(null)} onSelectUser={onSelectUser} />
          )}

          {loading ? null : loadError ? (
            <LoadError title="Couldn't load your Cookbook" onRetry={() => { setLoadError(false); fetchRecipes() }} />
          ) : filtered.length === 0 ? (
            <EmptyState {...emptyMessage()} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(recipe => {
                const isSelected = selected.has(recipe.id)
                const foundInside = q && !matchesName(recipe) && String(recipe.ingredients ?? '').toLowerCase().includes(q)
                return (
                <div key={recipe.id}
                  data-letter={showRail && firstOfLetter[letterOf(recipe.title)] === recipe.id ? letterOf(recipe.title) : undefined}
                  onTouchStart={e => pressDown(e, recipe.id)}
                  onTouchMove={pressMove}
                  onTouchEnd={pressUp}
                  onTouchCancel={pressUp}
                  onContextMenu={e => e.preventDefault()}
                  onClick={() => {
                    // The tap that ends a press and hold shouldn't also open or unselect the recipe
                    if (longPressed.current) { longPressed.current = false; return }
                    selecting ? toggleSelected(recipe.id) : onSelectRecipe(recipe)
                  }}
                  style={{
                  WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
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
                        <img loading="lazy" decoding="async"
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
                        {cookScoresMap[recipe.id]?.times > 0 && <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--charcoal)' }}>· Made {cookScoresMap[recipe.id].times}x</span>}
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

      {/* Select mode: count, Select all, Done and the actions all stay pinned above the bottom nav */}
      <BottomBar visible={selecting} space={selecting ? 116 : 0}>
        <div style={{
          background: 'var(--warm-white)', border: '1px solid var(--parchment)',
          borderRadius: 'var(--radius-lg)', padding: '10px 8px 8px', boxShadow: BAR_SHADOW,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 10px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>
              {n === 0 ? 'None selected' : `${n} selected`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button className="nom-hit" onClick={toggleSelectAll} tabIndex={selecting ? 0 : -1} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--clay)' }}>
                {allShownSelected ? 'Select none' : 'Select all'}
              </button>
              <button onClick={stopSelecting} tabIndex={selecting ? 0 : -1} style={{ background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '5px 14px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600' }}>
                Done
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'Add tag', onClick: () => setTagSheet('add'), color: 'var(--cream)', bg: 'var(--clay)' },
              { label: 'Remove tag', onClick: () => setTagSheet('remove'), color: 'var(--charcoal)', bg: 'var(--parchment)' },
              { label: 'Delete', onClick: deleteSelected, color: '#9B4040', bg: '#F4E8E8' },
            ].map(a => {
              const off = n === 0 || working
              return (
                <button key={a.label} onClick={a.onClick} disabled={off} tabIndex={selecting ? 0 : -1} style={{
                  flex: 1, padding: '11px 6px', border: 'none', borderRadius: 'var(--radius-pill)',
                  background: off ? 'var(--parchment)' : a.bg, color: off ? 'var(--tan)' : a.color,
                  fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '700',
                  cursor: off ? 'default' : 'pointer', whiteSpace: 'nowrap',
                }}>{a.label}</button>
              )
            })}
          </div>
        </div>
      </BottomBar>

      {filterSheet && (
        <FilterSheet
          tags={allTags}
          counts={tagCounts}
          active={tagFilters}
          onToggle={toggleTag}
          onClear={() => setTagFilters([])}
          resultCount={filtered.length}
          onClose={() => setFilterSheet(false)}
        />
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