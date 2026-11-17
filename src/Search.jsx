import PeopleYouMightKnow from './PeopleYouMightKnow'
import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { getHiddenContent } from './moderation'
import { IconX } from './icons'
import { LoadError, confirmSheet, toast } from './ui'

const RECENT_SEARCHES_KEY = 'nom_recent_searches'

const STATUS_PILLS = {
  cooked: { bg: '#EEF4E5', color: '#4A5E42', label: 'Cooked' },
  want_to_make: { bg: 'var(--parchment)', color: 'var(--charcoal)', label: 'Want to Make' },
  never_again: { bg: '#F4E8E8', color: '#9B4040', label: 'Never Again' },
}

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
  } catch { return [] }
}

function saveRecentSearch(term) {
  if (!term.trim()) return
  const existing = getRecentSearches().filter(s => s !== term)
  const updated = [term, ...existing].slice(0, 5)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
}

function removeRecentSearch(term) {
  const updated = getRecentSearches().filter(s => s !== term)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
}

export default function Search({ session, onSelectUser, onSelectSave, onSelectCook, onSelectRecipe }) {
  const [query, setQuery] = useState('')
  const [dropdownResults, setDropdownResults] = useState({ people: [], myRecipes: [], recipes: [] })
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [followStates, setFollowStates] = useState({})
  const [recentSearches, setRecentSearches] = useState(getRecentSearches())
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [loadingViewed, setLoadingViewed] = useState(true)
  const [viewedError, setViewedError] = useState(false)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    fetchRecentlyViewed()
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setShowDropdown(false)
      setDropdownResults({ people: [], myRecipes: [], recipes: [] })
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(query)
    }, 300)
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
    setLoading(true)

    // Recipes match on the name or the ingredients ("feta" finds recipes that use feta).
    // Name matches come first. Characters that would break the filter are swapped for spaces.
    const safe = q.replace(/[,()*%\\]/g, ' ').trim()
    if (!safe) { setDropdownResults({ people: [], myRecipes: [], recipes: [] }); setShowDropdown(true); setLoading(false); return }
    const nameOrIngredient = `title.ilike.%${safe}%,ingredients.ilike.%${safe}%`
    const nameFirst = (rows) => {
      const lower = safe.toLowerCase()
      const inName = (r) => r.title?.toLowerCase().includes(lower)
      return [...rows.filter(inName), ...rows.filter(r => !inName(r))]
    }

    // These four don't depend on each other, so ask for them all at once
    const [myRes, peopleRes, hidden, followsRes] = await Promise.all([
      supabase.from('recipes').select('*')
        .eq('user_id', session.user.id).or(nameOrIngredient)
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('profiles').select('*')
        .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%`)
        .neq('id', session.user.id).limit(8),
      getHiddenContent(session.user.id),
      supabase.from('follows').select('following_id')
        .eq('follower_id', session.user.id).eq('status', 'approved'),
    ])
    if (myRes.error || peopleRes.error || followsRes.error) {
      setSearchError(true)
      setShowDropdown(true)
      setLoading(false)
      return
    }
    setSearchError(false)
    const myRecipeRows = nameFirst(myRes.data || []).slice(0, 5)
    const people = (peopleRes.data || []).filter(p => !hidden.blockedIds.has(p.id)).slice(0, 5)

    let recipes = []
    const follows = followsRes.data

    if (follows && follows.length > 0) {
      const friendIds = follows.map(f => f.following_id)
      const { data: recipeRows } = await supabase
        .from('recipes')
        .select('*')
        .in('user_id', friendIds)
        .or(nameOrIngredient)
        .limit(20)

      if (recipeRows && recipeRows.length > 0) {
        const uids = [...new Set(recipeRows.map(r => r.user_id))]
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', uids)
        // One row per recipe: if several friends have it, show it once with "+ N more"
        const byRecipe = new Map()
        for (const r of nameFirst(recipeRows)) {
          const key = r.canonical_id || r.id
          const row = byRecipe.get(key)
          if (row) { row._others += 1; continue }
          byRecipe.set(key, { ...r, profiles: profs?.find(p => p.id === r.user_id) || null, _others: 0 })
        }
        recipes = [...byRecipe.values()].slice(0, 5)
      }
    }

    if (people.length > 0) {
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id, status')
        .eq('follower_id', session.user.id)
        .in('following_id', people.map(p => p.id))
      const states = { ...followStates }
      if (followData) followData.forEach(f => { states[f.following_id] = f.status })
      setFollowStates(states)
    }

    setDropdownResults({ people, myRecipes: myRecipeRows, recipes })
    setShowDropdown(true)
    setLoading(false)
  }

  function handleSelectPerson(userId) {
    rememberSearch()
    onSelectUser(userId)
  }

  function rememberSearch() {
    saveRecentSearch(query)
    setRecentSearches(getRecentSearches())
    setShowDropdown(false)
    setQuery('')
  }

  // A friend's recipe they've cooked opens their latest cook (like on their profile); anything else opens the saved recipe
  async function handleSelectRecipe(recipe) {
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

  function handleRecentSearch(term) {
    setQuery(term)
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

  const hasDropdownResults = dropdownResults.people.length > 0 || dropdownResults.myRecipes.length > 0 || dropdownResults.recipes.length > 0

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px var(--nav-clearance)' }}>
      <div style={{ height: 'calc(var(--top-bar-h) + 16px)' }} />

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: '24px' }} ref={searchRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--warm-white)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', padding: '10px 16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
            <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            placeholder="Search people, recipes or ingredients"
            aria-label="Search people, recipes or ingredients"
            style={{
              flex: 1, border: 'none', background: 'none',
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--ink)', outline: 'none'
            }}
          />
          {query.length > 0 && (
            <button className="nom-hit" aria-label="Clear search" onClick={() => { setQuery(''); setShowDropdown(false) }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: '18px', padding: 0, lineHeight: 1
            }}><IconX size={14} strokeWidth={2.2} /></button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'var(--cream)', border: '1px solid var(--parchment)',
            borderRadius: 'var(--radius-lg)', marginTop: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100,
            overflow: 'hidden', maxHeight: '400px', overflowY: 'auto'
          }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Searching...</div>
            ) : searchError ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Couldn't search right now. Check your connection and try again.</div>
            ) : !hasDropdownResults ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>No results for "{query}"</div>
            ) : (
              <>
                {dropdownResults.people.length > 0 && (
                  <div>
                    <div style={{ padding: '10px 16px 6px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>People</div>
                    {dropdownResults.people.map(profile => (
                      <div key={profile.id} onClick={() => handleSelectPerson(profile.id)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', cursor: 'pointer',
                        borderBottom: '1px solid var(--parchment)'
                      }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: '700', color: 'var(--cream)',
                            position: 'relative', overflow: 'hidden'
                          }}>
                            {profile.avatar_url && (
                              <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                            )}
                            {(profile.full_name || profile.username || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{profile.full_name || profile.username}</div>
                            {profile.username && profile.full_name && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{profile.username}</div>}
                          </div>
                        </div>
                        {followStates[profile.id] === 'approved' ? (
                          <button onClick={e => { e.stopPropagation(); unfollow(profile.id) }} style={{ padding: '5px 10px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Following</button>
                        ) : followStates[profile.id] === 'pending' ? (
                          <button disabled style={{ padding: '5px 10px', background: 'var(--parchment)', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', cursor: 'not-allowed' }}>Requested</button>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); sendFollowRequest(profile) }} style={{ padding: '5px 10px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>{profile.is_private === false ? 'Follow' : 'Request'}</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {dropdownResults.myRecipes.length > 0 && (
                  <div>
                    <div style={{ padding: '10px 16px 6px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>In your Cookbook</div>
                    {dropdownResults.myRecipes.map(recipe => {
                      const s = STATUS_PILLS[recipe.status] || STATUS_PILLS.want_to_make
                      return (
                        <div key={recipe.id} onClick={() => handleSelectMyRecipe(recipe)} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 16px', cursor: 'pointer',
                          borderBottom: '1px solid var(--parchment)'
                        }}
                        >
                          <div style={{
                            width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative'
                          }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                            {recipe.image_url && <img loading="lazy" decoding="async" src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={e => e.target.style.display = 'none'} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                            {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.source_name}</div>}
                          </div>
                          <div style={{ background: s.bg, color: s.color, borderRadius: 'var(--radius-pill)', padding: '3px 8px', fontSize: '10px', fontWeight: '600', flexShrink: 0 }}>{s.label}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {dropdownResults.recipes.length > 0 && (
                  <div>
                    <div style={{ padding: '10px 16px 6px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>From friends</div>
                    {dropdownResults.recipes.map(recipe => (
                      <div key={recipe.id} onClick={() => handleSelectRecipe(recipe)} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 16px', cursor: 'pointer',
                        borderBottom: '1px solid var(--parchment)'
                      }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative'
                        }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                          {recipe.image_url && <img loading="lazy" decoding="async" src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={e => e.target.style.display = 'none'} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {recipe.profiles?.full_name || recipe.profiles?.username || 'A friend'}{recipe._others > 0 ? ` + ${recipe._others} more` : ''}
                          </div>
                        </div>
                        {(() => { const st = STATUS_PILLS[recipe.status] || STATUS_PILLS.want_to_make; return <div style={{ background: st.bg, color: st.color, borderRadius: 'var(--radius-pill)', padding: '3px 8px', fontSize: '10px', fontWeight: '600', flexShrink: 0 }}>{st.label}</div> })()}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

  {/* People you might know */}
      {!query && <PeopleYouMightKnow session={session} onSelectUser={onSelectUser} marginBottom="24px" />}

      {/* Empty state — recent searches + recently viewed */}
      {!showDropdown && query.length < 2 && (
        <>
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Recent searches</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {recentSearches.map(term => (
                  <div key={term} onClick={() => handleRecentSearch(term)} style={{
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

          {/* Recently Viewed */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>Recently viewed</div>
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
                    }}
                    >
                      <div style={{
                        width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                        overflow: 'hidden', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative'
                      }}>
                        {recipe.image_url && (
                          <img loading="lazy" decoding="async"
                            src={recipe.image_url}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                            onError={e => e.target.style.display = 'none'}
                          />
                        )}
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--cream)' }}>
                          {(recipe.title || '?')[0].toUpperCase()}
                        </span>
                      </div>
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