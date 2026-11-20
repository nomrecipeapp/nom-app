import PeopleYouMightKnow from './PeopleYouMightKnow'
import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { PROFILE_FIELDS } from './profileData'
import { getHiddenContent } from './moderation'
import { IconX, IconChevronDown } from './icons'
import { LoadError, confirmSheet, toast } from './ui'
import EmptyState from './EmptyState'

const RECENT_SEARCHES_KEY = 'nom_recent_searches'

// How many rows each section shows before "See all", and how many it can load in total
const PREVIEW = 5
const MAX_ROWS = 50

const STATUS_PILLS = {
  cooked: { bg: '#EEF4E5', color: '#4A5E42', label: 'Cooked' },
  want_to_make: { bg: 'var(--parchment)', color: 'var(--charcoal)', label: 'Want to Make' },
  never_again: { bg: '#F4E8E8', color: '#9B4040', label: 'Never Again' },
}

const EMPTY_RESULTS = { people: [], myRecipes: [], myTotal: 0, friendRecipes: [], friendTotal: 0 }

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
  } catch { return [] }
}

function saveRecentSearch(term) {
  if (!term.trim()) return
  try {
    const existing = getRecentSearches().filter(s => s !== term)
    const updated = [term, ...existing].slice(0, 5)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch { /* storage unavailable */ }
}

function removeRecentSearch(term) {
  try {
    const updated = getRecentSearches().filter(s => s !== term)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch { /* storage unavailable */ }
}

// Name matches first (names that start with the search before ones that just contain it),
// then recipes that only use it as an ingredient
function rankRecipes(byName, byIngredient, q) {
  const lower = q.toLowerCase()
  const starts = (r) => (r.title || '').toLowerCase().startsWith(lower)
  const named = [...byName].sort((a, b) => (starts(b) - starts(a)) || (new Date(b.created_at) - new Date(a.created_at)))
  const ids = new Set(named.map(r => r.id))
  const used = byIngredient.filter(r => !ids.has(r.id)).map(r => ({ ...r, _byIngredient: true }))
  return [...named, ...used]
}

// Name matches and ingredient matches are looked up separately, so a recipe whose name
// matches is never pushed out by a pile of recipes that only use the ingredient.
async function findRecipes(scope, safe) {
  const pattern = `%${safe}%`
  const base = () => scope(supabase.from('recipes').select('*', { count: 'exact' }))
  const [byName, byIngredient] = await Promise.all([
    base().ilike('title', pattern).order('created_at', { ascending: false }).limit(MAX_ROWS),
    base().ilike('ingredients', pattern).not('title', 'ilike', pattern).order('created_at', { ascending: false }).limit(MAX_ROWS),
  ])
  if (byName.error || byIngredient.error) return { error: true }
  return {
    rows: rankRecipes(byName.data || [], byIngredient.data || [], safe),
    total: (byName.count || 0) + (byIngredient.count || 0),
  }
}

const sectionLabel = { fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }
const listCard = { background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }

function Section({ title, count, children, expanded, canExpand, onToggle }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={sectionLabel}>{title}<span style={{ fontWeight: '600', marginLeft: '6px', letterSpacing: 0 }}>{count}</span></div>
      </div>
      <div style={listCard}>{children}</div>
      {canExpand && (
        <button onClick={onToggle} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%',
          marginTop: '8px', minHeight: '44px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', color: 'var(--clay)'
        }}>
          {expanded ? 'Show less' : `See all ${count}`}
          <IconChevronDown size={13} strokeWidth={2.4} style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </button>
      )}
    </div>
  )
}

function Thumb({ recipe }) {
  return (
    <div style={{
      width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
      overflow: 'hidden', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--clay), var(--ember))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative'
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
      {recipe.image_url && <img loading="lazy" decoding="async" src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={e => e.target.style.display = 'none'} />}
    </div>
  )
}

function RecipeRow({ recipe, sub, query, onClick, last }) {
  const st = STATUS_PILLS[recipe.status] || STATUS_PILLS.want_to_make
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 14px', cursor: 'pointer',
      borderBottom: last ? 'none' : '1px solid var(--parchment)'
    }}>
      <Thumb recipe={recipe} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
        {sub && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
        {recipe._byIngredient && <div style={{ fontSize: '11px', color: 'var(--clay)', fontWeight: '600', marginTop: '2px' }}>Uses {query.trim()}</div>}
      </div>
      <div style={{ background: st.bg, color: st.color, borderRadius: 'var(--radius-pill)', padding: '3px 8px', fontSize: '10px', fontWeight: '600', flexShrink: 0 }}>{st.label}</div>
    </div>
  )
}

export default function Search({ session, onSelectUser, onSelectSave, onSelectCook, onSelectRecipe }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [searchedFor, setSearchedFor] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [followStates, setFollowStates] = useState({})
  const [recentSearches, setRecentSearches] = useState(getRecentSearches())
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [loadingViewed, setLoadingViewed] = useState(true)
  const [viewedError, setViewedError] = useState(false)
  const debounceRef = useRef(null)
  const latestRef = useRef('')

  const searching = query.trim().length >= 2

  useEffect(() => {
    fetchRecentlyViewed()
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!searching) {
      latestRef.current = ''
      setResults(EMPTY_RESULTS)
      setSearchedFor('')
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => runSearch(query.trim()), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function fetchRecentlyViewed() {
    setLoadingViewed(true)
    setViewedError(false)
    const { data, error } = await supabase
      .from('recipe_views')
      .select('recipe_id, viewed_at, recipes(id, title, image_url, source_name, user_id)')
      .eq('user_id', session.user.id)
      .order('viewed_at', { ascending: false })
      .limit(50)

    if (error) { setViewedError(true); setLoadingViewed(false); return }
    if (data) {
      const seen = new Set()
      const deduped = data
        .filter(v => v.recipes)
        .filter(v => {
          if (seen.has(v.recipe_id)) return false
          seen.add(v.recipe_id)
          return true
        })
        .slice(0, 10)
      setRecentlyViewed(deduped)
    }
    setLoadingViewed(false)
  }

  async function runSearch(q) {
    latestRef.current = q
    // Characters that would break the filter are swapped for spaces
    const safe = q.replace(/[,()*%\\]/g, ' ').trim()
    if (!safe) { setResults(EMPTY_RESULTS); setSearchedFor(q); setLoading(false); return }

    const [mine, peopleRes, hidden, followsRes] = await Promise.all([
      findRecipes(b => b.eq('user_id', session.user.id), safe),
      supabase.from('profiles').select(PROFILE_FIELDS)
        .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%`)
        .neq('id', session.user.id).limit(MAX_ROWS),
      getHiddenContent(session.user.id),
      supabase.from('follows').select('following_id')
        .eq('follower_id', session.user.id).eq('status', 'approved'),
    ])
    if (latestRef.current !== q) return // a newer search has started
    if (mine.error || peopleRes.error || followsRes.error) {
      setSearchError(true)
      setSearchedFor(q)
      setLoading(false)
      return
    }

    const people = (peopleRes.data || []).filter(p => !hidden.blockedIds.has(p.id))

    // Friends' recipes: one row per recipe, so a recipe several friends saved shows once ("Gabby + 2 more")
    let friendRecipes = []
    const friendIds = (followsRes.data || []).map(f => f.following_id)
    if (friendIds.length > 0) {
      const theirs = await findRecipes(b => b.in('user_id', friendIds), safe)
      if (latestRef.current !== q) return
      if (!theirs.error && theirs.rows.length > 0) {
        const uids = [...new Set(theirs.rows.map(r => r.user_id))]
        const { data: profs } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', uids)
        const byRecipe = new Map()
        for (const r of theirs.rows) {
          const key = r.canonical_id || r.id
          const row = byRecipe.get(key)
          if (row) { row._others += 1; continue }
          byRecipe.set(key, { ...r, profiles: profs?.find(p => p.id === r.user_id) || null, _others: 0 })
        }
        friendRecipes = [...byRecipe.values()]
      }
    }

    if (people.length > 0) {
      const { data: followData } = await supabase.from('follows').select('following_id, status')
        .eq('follower_id', session.user.id).in('following_id', people.map(p => p.id))
      if (latestRef.current !== q) return
      setFollowStates(prev => {
        const next = { ...prev }
        if (followData) followData.forEach(f => { next[f.following_id] = f.status })
        return next
      })
    }

    setSearchError(false)
    setExpanded({})
    setResults({
      people,
      myRecipes: mine.rows,
      myTotal: mine.total,
      friendRecipes,
      friendTotal: friendRecipes.length,
    })
    setSearchedFor(q)
    setLoading(false)
  }

  function rememberSearch() {
    saveRecentSearch(query.trim())
    setRecentSearches(getRecentSearches())
  }

  function handleSelectPerson(userId) {
    rememberSearch()
    onSelectUser(userId)
  }

  // A friend's recipe they've cooked opens their latest cook (like on their profile); anything else opens the saved recipe
  async function handleSelectFriendRecipe(recipe) {
    rememberSearch()
    if (recipe.status !== 'want_to_make' && onSelectCook) {
      const { data: cook } = await supabase.from('cooks').select('*, recipes(*)')
        .eq('recipe_id', recipe.id).order('cooked_at', { ascending: false }).limit(1).maybeSingle()
      if (cook?.recipes) { onSelectCook({ ...cook, profiles: recipe.profiles }); return }
    }
    onSelectSave && onSelectSave(recipe)
  }

  function handleSelectMyRecipe(recipe) {
    rememberSearch()
    onSelectRecipe && onSelectRecipe(recipe)
  }

  function handleRemoveRecent(e, term) {
    e.stopPropagation()
    removeRecentSearch(term)
    setRecentSearches(getRecentSearches())
  }

  // Same as their profile: public accounts are followed right away, private ones get a request
  async function sendFollowRequest(profile) {
    const status = profile.is_private === false ? 'approved' : 'pending'
    const { error } = await supabase.from('follows').insert({
      follower_id: session.user.id, following_id: profile.id, status
    })
    if (error) { toast("Couldn't follow right now. Try again?", { icon: null }); return }
    if (status === 'pending') {
      await supabase.from('notifications').insert({
        recipient_id: profile.id, actor_id: session.user.id, type: 'follow_request'
      })
    }
    setFollowStates(s => ({ ...s, [profile.id]: status }))
  }

  async function unfollow(userId) {
    if (!(await confirmSheet({ title: 'Unfollow this cook?', message: "You'll stop seeing their cooks in your Feed. You can request to follow again anytime.", confirmLabel: 'Unfollow' }))) return
    await supabase.from('follows').delete()
      .eq('follower_id', session.user.id).eq('following_id', userId)
    setFollowStates(s => ({ ...s, [userId]: null }))
  }

  async function handleSelectViewed(view) {
    const recipe = view.recipes
    if (!recipe) return
    const { data: fullRecipe } = await supabase
      .from('recipes').select('*').eq('id', recipe.id).single()
    if (!fullRecipe) return
    if (fullRecipe.user_id === session.user.id) {
      onSelectRecipe && onSelectRecipe(fullRecipe)
    } else {
      onSelectSave && onSelectSave(fullRecipe)
    }
  }

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }))
  const shown = (key, rows) => (expanded[key] ? rows : rows.slice(0, PREVIEW))
  const { people, myRecipes, myTotal, friendRecipes, friendTotal } = results
  const hasResults = people.length > 0 || myRecipes.length > 0 || friendRecipes.length > 0
  const firstLoad = loading && searchedFor === ''

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px var(--nav-clearance)' }}>
      <div style={{ height: 'calc(var(--top-bar-h) + 16px)' }} />

      {/* Search bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--warm-white)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', padding: '10px 16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
            <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); rememberSearch() } }}
            enterKeyHint="search"
            placeholder="Search people, recipes or ingredients"
            aria-label="Search people, recipes or ingredients"
            style={{
              flex: 1, border: 'none', background: 'none',
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--ink)', outline: 'none'
            }}
          />
          {query.length > 0 && (
            <button className="nom-hit" aria-label="Clear search" onClick={() => setQuery('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: '18px', padding: 0, lineHeight: 1
            }}><IconX size={14} strokeWidth={2.2} /></button>
          )}
        </div>
      </div>

      {/* Results fill the page while you search */}
      {searching && (
        <div aria-live="polite" style={{ opacity: loading && !firstLoad ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          {firstLoad ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Searching...</div>
          ) : searchError ? (
            <LoadError compact title="Couldn't search right now" onRetry={() => { setLoading(true); runSearch(query.trim()) }} />
          ) : !hasResults && !loading ? (
            <EmptyState title={`No results for "${searchedFor}"`} body="Try a different spelling, a single ingredient, or a friend's name." />
          ) : (
            <>
              {people.length > 0 && (
                <Section title="People" count={people.length} expanded={expanded.people} canExpand={people.length > PREVIEW} onToggle={() => toggle('people')}>
                  {shown('people', people).map((profile, i, arr) => (
                    <div key={profile.id} onClick={() => handleSelectPerson(profile.id)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                      padding: '12px 14px', cursor: 'pointer',
                      borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--parchment)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)',
                          position: 'relative', overflow: 'hidden'
                        }}>
                          {(profile.full_name || profile.username || '?')[0].toUpperCase()}
                          {profile.avatar_url && (
                            <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name || profile.username}</div>
                          {profile.username && profile.full_name && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{profile.username}</div>}
                        </div>
                      </div>
                      {followStates[profile.id] === 'approved' ? (
                        <button onClick={e => { e.stopPropagation(); unfollow(profile.id) }} style={{ flexShrink: 0, minHeight: '32px', padding: '0 12px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Following</button>
                      ) : followStates[profile.id] === 'pending' ? (
                        <button disabled style={{ flexShrink: 0, minHeight: '32px', padding: '0 12px', background: 'var(--parchment)', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'not-allowed' }}>Requested</button>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); sendFollowRequest(profile) }} style={{ flexShrink: 0, minHeight: '32px', padding: '0 12px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{profile.is_private === false ? 'Follow' : 'Request'}</button>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {myRecipes.length > 0 && (
                <Section title="Your Cookbook" count={myTotal} expanded={expanded.mine} canExpand={myRecipes.length > PREVIEW} onToggle={() => toggle('mine')}>
                  {shown('mine', myRecipes).map((recipe, i, arr) => (
                    <RecipeRow key={recipe.id} recipe={recipe} query={searchedFor} last={i === arr.length - 1}
                      sub={recipe.source_name} onClick={() => handleSelectMyRecipe(recipe)} />
                  ))}
                </Section>
              )}

              {friendRecipes.length > 0 && (
                <Section title="From friends" count={friendTotal} expanded={expanded.friends} canExpand={friendRecipes.length > PREVIEW} onToggle={() => toggle('friends')}>
                  {shown('friends', friendRecipes).map((recipe, i, arr) => (
                    <RecipeRow key={recipe.id} recipe={recipe} query={searchedFor} last={i === arr.length - 1}
                      sub={`${recipe.profiles?.full_name || recipe.profiles?.username || 'A friend'}${recipe._others > 0 ? ` + ${recipe._others} more` : ''}`}
                      onClick={() => handleSelectFriendRecipe(recipe)} />
                  ))}
                </Section>
              )}

              {myTotal > MAX_ROWS * 2 && (
                <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginBottom: '24px' }}>Lots of matches. Try a more specific search to narrow it down.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Not searching: people you might know, recent searches, recently viewed */}
      {!searching && (
        <>
          <PeopleYouMightKnow session={session} onSelectUser={onSelectUser} marginBottom="24px" />

          {recentSearches.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ ...sectionLabel, marginBottom: '12px' }}>Recent searches</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {recentSearches.map(term => (
                  <div key={term} onClick={() => setQuery(term)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'var(--warm-white)', border: '1px solid var(--parchment)',
                    borderRadius: 'var(--radius-pill)', padding: '6px 12px',
                    cursor: 'pointer', fontSize: '13px', color: 'var(--charcoal)'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="2"/>
                      <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    {term}
                    <button className="nom-hit" aria-label="Remove from recent searches" onClick={e => handleRemoveRecent(e, term)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--muted)', fontSize: '14px', padding: 0, lineHeight: 1, marginLeft: '2px'
                    }}><IconX size={11} strokeWidth={2.2} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ ...sectionLabel, marginBottom: '16px' }}>Recently viewed</div>
            {loadingViewed ? (
              <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
            ) : viewedError ? (
              <LoadError compact title="Couldn't load recently viewed" onRetry={fetchRecentlyViewed} />
            ) : recentlyViewed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '500', color: 'var(--ink)', marginBottom: '6px' }}>Nothing here yet</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Recipes you view will appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentlyViewed.map(view => {
                  const recipe = view.recipes
                  return (
                    <div key={view.recipe_id} onClick={() => handleSelectViewed(view)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      background: 'var(--warm-white)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--parchment)', padding: '12px 14px',
                      cursor: 'pointer'
                    }}>
                      <Thumb recipe={recipe} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '600', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                        {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{recipe.source_name}</div>}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
