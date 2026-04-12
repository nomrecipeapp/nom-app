import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const RECENT_SEARCHES_KEY = 'nom_recent_searches'

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
  const [followStates, setFollowStates] = useState({})
  const [recentSearches, setRecentSearches] = useState(getRecentSearches())
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [loadingViewed, setLoadingViewed] = useState(true)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  useEffect(() => {
    fetchRecentlyViewed()
    fetchSuggestions()
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

  async function fetchSuggestions() {
    setLoadingSuggestions(true)
    // Get people I already follow or have requested
    const { data: myFollows } = await supabase
      .from('follows').select('following_id, status')
      .eq('follower_id', session.user.id)
    const alreadyFollowing = new Set((myFollows || []).map(f => f.following_id))
    alreadyFollowing.add(session.user.id)

    // Get my followers
    const { data: myFollowers } = await supabase
      .from('follows').select('follower_id')
      .eq('following_id', session.user.id).eq('status', 'approved')
    if (!myFollowers || myFollowers.length === 0) { setLoadingSuggestions(false); return }

    // Get who my followers follow
    const followerIds = myFollowers.map(f => f.follower_id)
    const { data: friendsOfFriends } = await supabase
      .from('follows').select('following_id')
      .in('follower_id', followerIds).eq('status', 'approved')
    if (!friendsOfFriends || friendsOfFriends.length === 0) { setLoadingSuggestions(false); return }

    // Deduplicate and filter out already following
    const candidateIds = [...new Set(friendsOfFriends.map(f => f.following_id))]
      .filter(id => !alreadyFollowing.has(id))
      .slice(0, 8)

    if (candidateIds.length === 0) { setLoadingSuggestions(false); return }

    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url')
      .in('id', candidateIds)
    setSuggestions(profiles || [])
    setLoadingSuggestions(false)
  }

async function fetchRecentlyViewed() {
    setLoadingViewed(true)
    const { data } = await supabase
      .from('recipe_views')
      .select('recipe_id, viewed_at, recipes(id, title, image_url, source_name, user_id)')
      .eq('user_id', session.user.id)
      .order('viewed_at', { ascending: false })
      .limit(50)

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

    const { data: myRecipeRows = [] } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', session.user.id)
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: people = [] } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq('id', session.user.id)
      .limit(5)

    let recipes = []
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id)
      .eq('status', 'approved')

    if (follows && follows.length > 0) {
      const friendIds = follows.map(f => f.following_id)
      const { data: recipeRows } = await supabase
        .from('recipes')
        .select('*')
        .in('user_id', friendIds)
        .ilike('title', `%${q}%`)
        .limit(5)

      if (recipeRows && recipeRows.length > 0) {
        const uids = [...new Set(recipeRows.map(r => r.user_id))]
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', uids)
        recipes = recipeRows.map(r => ({
          ...r,
          profiles: profs?.find(p => p.id === r.user_id) || null
        }))
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
    saveRecentSearch(query)
    setRecentSearches(getRecentSearches())
    setShowDropdown(false)
    setQuery('')
    onSelectUser(userId)
  }

  function handleSelectRecipe(recipe) {
    saveRecentSearch(query)
    setRecentSearches(getRecentSearches())
    setShowDropdown(false)
    setQuery('')
    onSelectSave && onSelectSave(recipe)
  }

  function handleRecentSearch(term) {
    setQuery(term)
  }

  function handleRemoveRecent(e, term) {
    e.stopPropagation()
    removeRecentSearch(term)
    setRecentSearches(getRecentSearches())
  }

  async function sendFollowRequest(userId) {
    await supabase.from('follows').insert({
      follower_id: session.user.id, following_id: userId, status: 'pending'
    })
    await supabase.from('notifications').insert({
      recipient_id: userId, actor_id: session.user.id, type: 'follow_request'
    })
    setFollowStates(s => ({ ...s, [userId]: 'pending' }))
  }

  async function unfollow(userId) {
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
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px 100px' }}>
      <div style={{ height: '70px' }} />

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
            placeholder="Search people or recipes..."
            style={{
              flex: 1, border: 'none', background: 'none',
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--ink)', outline: 'none'
            }}
          />
          {query.length > 0 && (
            <button onClick={() => { setQuery(''); setShowDropdown(false) }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: '18px', padding: 0, lineHeight: 1
            }}>×</button>
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
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--warm-white)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
                              <img src={profile.avatar_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
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
                          <button onClick={e => { e.stopPropagation(); sendFollowRequest(profile.id) }} style={{ padding: '5px 10px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Follow</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {dropdownResults.myRecipes.length > 0 && (
                  <div>
                    <div style={{ padding: '10px 16px 6px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>In Your Cookbook</div>
                    {dropdownResults.myRecipes.map(recipe => {
                      const statusStyles = {
                        cooked: { bg: '#EEF4E5', color: '#4A5E42', label: 'Cooked' },
                        want_to_make: { bg: 'var(--parchment)', color: 'var(--charcoal)', label: 'Want to Make' },
                        never_again: { bg: '#F4E8E8', color: '#9B4040', label: 'Never Again' },
                      }
                      const s = statusStyles[recipe.status] || statusStyles.want_to_make
                      return (
                        <div key={recipe.id} onClick={() => { setShowDropdown(false); setQuery(''); onSelectRecipe && onSelectRecipe(recipe) }} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 16px', cursor: 'pointer',
                          borderBottom: '1px solid var(--parchment)'
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--warm-white)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative'
                          }}>
                            {recipe.image_url && <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={e => e.target.style.display = 'none'} />}
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)', position: 'relative' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
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
                    <div style={{ padding: '10px 16px 6px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Recipes</div>
                    {dropdownResults.recipes.map(recipe => (
                      <div key={recipe.id} onClick={() => handleSelectRecipe(recipe)} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 16px', cursor: 'pointer',
                        borderBottom: '1px solid var(--parchment)'
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--warm-white)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative'
                        }}>
                          {recipe.image_url
                            ? <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                            : null
                          }
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)', position: 'absolute' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {recipe.profiles?.full_name || recipe.profiles?.username || 'someone'}'s cookbook
                          </div>
                        </div>
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
      {!query && suggestions.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ padding: '0 20px 10px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>People You Might Know</div>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
              {suggestions.map(person => (
                <div key={person.id} onClick={() => onSelectUser(person.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0, width: '80px', cursor: 'pointer' }}>
                  {person.avatar_url
                    ? <img src={person.avatar_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    : <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--cream)' }}>{(person.full_name || person.username || '?')[0].toUpperCase()}</div>
                  }
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ink)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{person.full_name || person.username}</div>
                  <button onClick={e => {
                    e.stopPropagation()
                    supabase.from('follows').insert({ follower_id: session.user.id, following_id: person.id, status: 'pending' })
                    supabase.from('notifications').insert({ recipient_id: person.id, actor_id: session.user.id, type: 'follow_request' })
                    setSuggestions(prev => prev.filter(p => p.id !== person.id))
                  }} style={{ padding: '5px 10px', background: 'transparent', border: '1.5px solid var(--clay)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: '600', color: 'var(--clay)', cursor: 'pointer' }}>Follow</button>
                </div>
              ))}
            </div>
        </div>
      )}

      {/* Empty state — recent searches + recently viewed */}
      {!showDropdown && query.length < 2 && (
        <>
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Recent Searches</div>
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
                    <button onClick={e => handleRemoveRecent(e, term)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--muted)', fontSize: '14px', padding: 0, lineHeight: 1, marginLeft: '2px'
                    }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recently Viewed */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>Recently Viewed</div>
            {loadingViewed ? (
              <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
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
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--parchment)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--warm-white)'}
                    >
                      <div style={{
                        width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                        overflow: 'hidden', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative'
                      }}>
                        {recipe.image_url && (
                          <img
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