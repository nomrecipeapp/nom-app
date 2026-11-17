import { useState, useEffect } from 'react'
import { COOK_STATS_FIELDS, recipeStats, compareFavorites, fetchGoTos } from './cookStats'
import ModerationSheet, { MoreMenuSheet } from './ModerationSheet'
import { getHiddenContent, hasBlocked, unblockUser } from './moderation'
import { supabase } from './supabase'
import { IconX, IconLock, IconBook, IconBookmark, IconPot } from './icons'
import { confirmSheet, toast, LoadError } from './ui'
import EmptyState from './EmptyState'
import CircleFriendsModal from './CircleFriendsModal'
import { canonicalSpellings, recipeTags, sortTags, hasTag, tagKey } from './tags'
import { StatusSwitch, SortPill } from './CookbookTools'
import { FollowCounts, StatsStrip, ProfileTabs, StatsLists, ActivityList } from './ProfileParts'
import { fetchActivity, recentByRecipe } from './profileData'

const FILTERS = ['All', 'Want to Make', 'Cooked', 'Never Again']
const SORT_OPTIONS = ['Newest', 'Oldest', 'A to Z', 'Favorites', 'Friends Have It']
const SORT_LABELS = { 'Friends Have It': 'Friends have it' }

const statusLabel = { want_to_make: 'Want to Make', cooked: 'Cooked', never_again: 'Never Again' }
const statusStyle = {
  cooked: { background: '#EEF4E5', color: '#4A5E42', border: '1px solid #7A8C6E' },
  want_to_make: { background: 'var(--parchment)', color: 'var(--charcoal)', border: '1px solid var(--tan)' },
  never_again: { background: '#F4E8E8', color: '#9B4040', border: '1px solid #C47070' }
}

// A friend's Cookbook: the same search, status switch, tags, sort and recipe cards as yours, read-only
function FriendCookbook({ recipes, firstName, filter, onFilter, cookStats, circleMap, onSelect, onCircle }) {
  const [search, setSearch] = useState('')
  const [tagFilters, setTagFilters] = useState([])
  const [sort, setSort] = useState('Newest')

  const tagSpellings = canonicalSpellings(recipes.flatMap(r => r.tags || []))
  const tagCounts = {}
  for (const r of recipes) for (const t of recipeTags(r.tags, tagSpellings)) tagCounts[t] = (tagCounts[t] || 0) + 1
  const allTags = sortTags(Object.keys(tagCounts))
  const rowTags = [...tagFilters, ...allTags.filter(t => !tagFilters.includes(t))]
  const toggleTag = (tag) => setTagFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  // Search looks at the name first, then tags, ingredients and notes
  const q = search.trim().toLowerCase()
  const matchesName = (r) => String(r.title ?? '').toLowerCase().includes(q) || String(r.source_name ?? '').toLowerCase().includes(q)
  const matchesInside = (r) =>
    (r.tags || []).some(t => String(t).toLowerCase().includes(q)) ||
    String(r.ingredients ?? '').toLowerCase().includes(q) ||
    String(r.notes ?? '').toLowerCase().includes(q)

  const sorted = recipes
    .filter(r => filter === 'All' || r.status === { 'Want to Make': 'want_to_make', Cooked: 'cooked', 'Never Again': 'never_again' }[filter])
    .filter(r => tagFilters.length === 0 || tagFilters.some(tag => hasTag(r.tags, tag)))
    .filter(r => !q || matchesName(r) || matchesInside(r))
    .sort((a, b) => {
      if (sort === 'A to Z') return a.title.localeCompare(b.title)
      if (sort === 'Oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sort === 'Favorites') return compareFavorites(cookStats[a.id], cookStats[b.id]) || (new Date(b.created_at) - new Date(a.created_at))
      if (sort === 'Friends Have It') return (circleMap[b.id] || 0) - (circleMap[a.id] || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })
  const filtered = q ? [...sorted.filter(matchesName), ...sorted.filter(r => !matchesName(r))] : sorted

  function emptyMessage() {
    if (search) return { title: `No results for "${search}"`, body: 'Try a different search.' }
    if (tagFilters.length > 0) return { title: 'No recipes match those tags', body: 'Try removing a tag filter.' }
    if (filter === 'Want to Make') return { icon: IconBookmark, title: 'Nothing saved to try', body: `Recipes ${firstName} saves but hasn't cooked yet show up here.` }
    if (filter === 'Cooked') return { icon: IconPot, title: 'Nothing cooked yet', body: `Recipes ${firstName} logs a cook for show up here.` }
    if (filter === 'Never Again') return { title: 'No Never Agains', body: 'Hopefully it stays that way.' }
    return { icon: IconBook, title: 'No recipes yet', body: `${firstName}'s Cookbook is empty for now.` }
  }

  const tagChipStyle = (active) => ({
    padding: '5px 11px', borderRadius: 'var(--radius-pill)', minHeight: '32px',
    border: `1.5px solid ${active ? 'var(--clay)' : 'var(--tan)'}`,
    background: active ? 'var(--clay)' : 'transparent',
    color: active ? 'var(--cream)' : 'var(--charcoal)',
    fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', gap: '5px'
  })

  return (
    <div style={{ padding: '0 20px' }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'var(--warm-white)', borderRadius: 'var(--radius-md)',
        padding: '10px 14px', marginBottom: '12px', border: '1.5px solid var(--tan)'
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
          <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          aria-label={`Search ${firstName}'s Cookbook`}
          placeholder="Search recipes or ingredients"
          style={{ flex: 1, border: 'none', background: 'none', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none' }} />
        {search && (
          <button className="nom-hit" aria-label="Clear search" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', padding: 0, lineHeight: 1 }}><IconX size={13} strokeWidth={2.2} /></button>
        )}
      </div>

      <StatusSwitch options={FILTERS} value={filter} onChange={onFilter} />

      {allTags.length > 0 && (
        <div className="nom-hscroll" style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', margin: '0 -20px', padding: '0 20px 2px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {rowTags.map(tag => {
            const active = tagFilters.includes(tag)
            return (
              <button key={tag} onClick={() => toggleTag(tag)} aria-pressed={active} style={tagChipStyle(active)}>
                {tag}
                <span style={{ fontSize: '11px', fontWeight: '500', color: active ? 'var(--cream)' : 'var(--muted)', opacity: active ? 0.85 : 1 }}>{tagCounts[tag]}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Recipe count and sort, right above the list */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', margin: '16px 0 12px', minHeight: '36px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}</div>
        {recipes.length > 0 && <SortPill options={SORT_OPTIONS} labels={SORT_LABELS} value={sort} onChange={setSort} />}
      </div>

      {filtered.length === 0 ? (
        <EmptyState {...emptyMessage()} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(recipe => {
            const foundInside = q && !matchesName(recipe) && String(recipe.ingredients ?? '').toLowerCase().includes(q)
            const times = cookStats[recipe.id]?.times || 0
            return (
              <div key={recipe.id} onClick={() => onSelect(recipe)} style={{
                background: 'var(--warm-white)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--parchment)', padding: '16px 18px', cursor: 'pointer'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {recipe.image_url && (
                    <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-sm)', background: 'var(--parchment)', flexShrink: 0, overflow: 'hidden' }}>
                      <img loading="lazy" decoding="async" src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => e.target.parentElement.style.display = 'none'} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '500', color: 'var(--ink)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recipe.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {recipe.source_name && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.source_name}</span>}
                      {recipe.cook_time && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>· {recipe.cook_time}</span>}
                      {times > 0 && <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--charcoal)' }}>· Made {times}x</span>}
                    </div>
                    {foundInside && <div style={{ fontSize: '11px', color: 'var(--clay)', fontWeight: '600', marginTop: '3px' }}>Uses {search.trim()}</div>}
                    {(recipe.tags || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
                        {recipeTags(recipe.tags, tagSpellings).map(tag => {
                          const active = tagFilters.some(t => tagKey(t) === tagKey(tag))
                          return (
                            <span key={tag} style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: active ? 'var(--clay)' : 'var(--parchment)', fontSize: '10px', fontWeight: '600', color: active ? 'var(--cream)' : 'var(--charcoal)' }}>{tag}</span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ ...statusStyle[recipe.status], padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                    {statusLabel[recipe.status]}
                  </div>
                </div>
                {circleMap[recipe.id] > 0 && (
                  <div onClick={e => { e.stopPropagation(); onCircle(recipe) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--parchment)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="9" cy="7" r="4" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      <span style={{ fontWeight: '600', color: 'var(--clay)' }}>{circleMap[recipe.id]} {circleMap[recipe.id] === 1 ? 'friend' : 'friends'}</span> {circleMap[recipe.id] === 1 ? 'has' : 'have'} this
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FriendProfile({ userId, session, onSelectCook, onSelectSave, onSelectUser, onViewFollowList }) {
  const [profile, setProfile] = useState(null)
  const [cooks, setCooks] = useState([])
  const [allRecipes, setAllRecipes] = useState([])
  const [stats, setStats] = useState({ saved: 0, cooked: 0 })
  const [followStatus, setFollowStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [recentCooks, setRecentCooks] = useState([])
  const [topRated, setTopRated] = useState([])
  const [wantToMake, setWantToMake] = useState([])
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('stats')
  const [cookbookFilter, setCookbookFilter] = useState('All')
  const [followCounts, setFollowCounts] = useState({ following: null, followers: null })
  const [friendActivity, setFriendActivity] = useState([])
  const [friendEngagement, setFriendEngagement] = useState({})
  const [friendActivityLoading, setFriendActivityLoading] = useState(false)
  const [friendCookScoresMap, setFriendCookScoresMap] = useState({})
  const [friendCircleMap, setFriendCircleMap] = useState({})
  const [circleModal, setCircleModal] = useState(null)
  const [blockState, setBlockState] = useState(null) // null | 'blockedByMe' | 'blockedMe'
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [moderation, setModeration] = useState(null)

  useEffect(() => {
    setFollowCounts({ following: null, followers: null })
    setFollowStatus(null)
    setProfile(null)
    setLoading(true)
    setBlockState(null)
    fetchProfile()
    fetchFollowStatus()
    fetchFollowCounts()
    fetchBlockState()
  }, [userId])

  async function fetchBlockState() {
    if (await hasBlocked(session.user.id, userId)) { setBlockState('blockedByMe'); return }
    const hidden = await getHiddenContent(session.user.id)
    setBlockState(hidden.blockedIds.has(userId) ? 'blockedMe' : null)
  }

  function clearFriendContent() {
    setFollowStatus(null)
    setCooks([])
    setRecentCooks([])
    setTopRated([])
    setWantToMake([])
    setAllRecipes([])
    setStats({ saved: 0, cooked: 0 })
    setStatsLoaded(false)
  }

  async function handleUnblock() {
    setProfileMenuOpen(false)
    const err = await unblockUser(session.user.id, userId)
    if (err) { toast("We couldn't unblock them. Please try again.", { icon: null }); return }
    setBlockState(null)
    fetchFollowCounts()
  }

  function handleModerationClose({ blocked }) {
    setModeration(null)
    if (blocked) {
      setBlockState('blockedByMe')
      clearFriendContent()
      fetchFollowCounts()
    }
  }

  async function fetchFollowCounts() {
    const [{ count: followingCount }, { count: followersCount }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'approved'),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'approved'),
    ])
    setFollowCounts({ following: followingCount || 0, followers: followersCount || 0 })
  }

  useEffect(() => {
    if (followStatus === 'approved') loadFriendContent()
  }, [followStatus])

  function loadFriendContent() {
    fetchCooks()
    fetchStats()
    fetchWantToMake()
    fetchAllRecipes()
    fetchFriendActivity()
  }

  async function fetchProfile() {
    setLoadError(false)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    // PGRST116 = no such profile (handled as "not available"); anything else is a load problem
    if (error && error.code !== 'PGRST116') setLoadError(true)
    if (data) setProfile(data)
    setLoading(false)
  }

  function retryProfile() {
    setLoading(true)
    fetchProfile()
    fetchFollowStatus()
    fetchFollowCounts()
    fetchBlockState()
  }

  async function fetchStats() {
    const [{ count: saved }, { count: cooked }] = await Promise.all([
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'cooked'),
    ])
    setStats({ saved: saved || 0, cooked: cooked || 0 })
  }

  async function fetchAllRecipes() {
    const { data } = await supabase.from('recipes').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) {
      setAllRecipes(data)
      fetchFriendCookScores(data)
      fetchFriendCircleCounts(data)
    }
  }

  async function fetchFriendCookScores(recipeList) {
    const recipeIds = recipeList.map(r => r.id)
    if (recipeIds.length === 0) return
    const { data: cooks } = await supabase.from('cooks').select(COOK_STATS_FIELDS).in('recipe_id', recipeIds).eq('user_id', userId)
    if (!cooks || cooks.length === 0) return
    setFriendCookScoresMap(recipeStats(cooks))
  }

  // How many of the people you follow (not counting this cook) also have each recipe
  async function fetchFriendCircleCounts(recipeList) {
    const { data: following } = await supabase.from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    const followingIds = (following || []).map(f => f.following_id).filter(id => id !== userId)
    if (followingIds.length === 0) return
    const canonicalIds = [...new Set(recipeList.filter(r => r.canonical_id).map(r => r.canonical_id))]
    if (canonicalIds.length === 0) return
    const { data: matches } = await supabase.from('recipes').select('user_id, canonical_id')
      .in('canonical_id', canonicalIds).in('user_id', followingIds)
    if (!matches || matches.length === 0) return
    const map = {}
    for (const recipe of recipeList) {
      if (!recipe.canonical_id) continue
      const people = new Set(matches.filter(m => m.canonical_id === recipe.canonical_id).map(m => m.user_id))
      if (people.size > 0) map[recipe.id] = people.size
    }
    setFriendCircleMap(map)
  }

  async function fetchCooks() {
    const { data } = await supabase.from('cooks').select('*, recipes(*)').eq('user_id', userId)
      .order('cooked_at', { ascending: false }).limit(100)
    if (!data) return
    setCooks(data)
    setRecentCooks(recentByRecipe(data))
    // Go-tos: Would Make Again recipes, most-cooked first (counts all cooks, not just the last 100)
    fetchGoTos(supabase, userId).then(list => { setTopRated(list); setStatsLoaded(true) })
  }

  async function fetchWantToMake() {
    const { data } = await supabase.from('recipes').select('*').eq('user_id', userId)
      .eq('status', 'want_to_make').order('created_at', { ascending: false }).limit(5)
    if (data) setWantToMake(data)
  }

  async function fetchFriendActivity() {
    setFriendActivityLoading(true)
    const { items, engagement } = await fetchActivity(supabase, userId, profile)
    setFriendActivity(items)
    setFriendEngagement(engagement)
    setFriendActivityLoading(false)
  }

  async function fetchFollowStatus() {
    const { data } = await supabase.from('follows').select('status')
      .eq('follower_id', session.user.id).eq('following_id', userId).maybeSingle()
    setFollowStatus(data ? data.status : null)
  }

  async function sendFollowRequest() {
    const { data: targetProfile } = await supabase.from('profiles').select('is_private').eq('id', userId).single()
    const isPrivate = targetProfile?.is_private !== false
    const status = isPrivate ? 'pending' : 'approved'
    await supabase.from('follows').insert({ follower_id: session.user.id, following_id: userId, status })
    setFollowStatus(status)
    if (isPrivate) {
      await supabase.from('notifications').insert({ recipient_id: userId, actor_id: session.user.id, type: 'follow_request' })
    }
    fetchFollowCounts()
  }

  async function unfollow() {
    if (!(await confirmSheet({ title: 'Unfollow this cook?', message: "You'll stop seeing their cooks in your Feed. You can request to follow again anytime.", confirmLabel: 'Unfollow' }))) return
    await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', userId)
    clearFriendContent()
    fetchFollowCounts()
  }

  // Cooks loaded here don't carry the profile, so add it before opening one
  function openCook(cook) {
    onSelectCook({ ...cook, profiles: cook.profiles || profile })
  }

  // A recipe they've cooked opens their latest cook; anything else opens the saved recipe
  function handleRecipeTap(recipe) {
    const cook = cooks.find(c => c.recipe_id === recipe.id)
    if (cook) openCook(cook)
    else onSelectSave && onSelectSave(recipe)
  }

  function openCookbook(filter) {
    setCookbookFilter(filter)
    setActiveTab('cookbook')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  if (loadError) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingTop: 'var(--top-bar-h)' }}>
      <LoadError title="Couldn't load this profile" onRetry={retryProfile} />
    </div>
  )

  const name = profile?.full_name || profile?.username || ''
  const first = (profile?.full_name || '').trim().split(' ')[0] || profile?.username || 'this cook'
  const approved = followStatus === 'approved'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: 'var(--nav-clearance)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ height: 'var(--top-bar-h)' }} />

        {/* Avatar + name, same layout as your profile */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 20px 20px' }}>
          {profile?.avatar_url ? (
            <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)', display: 'block' }} onError={e => e.target.style.display = 'none'} />
          ) : (
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }}>
              {(name || '?')[0].toUpperCase()}
            </div>
          )}

          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--ink)', marginBottom: '2px', marginTop: '12px' }}>{name}</div>

          {profile?.username && profile?.full_name && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>@{profile.username}</div>
          )}

          {!blockState && (
            <div style={{ marginBottom: '16px' }}>
              <FollowCounts following={followCounts.following} followers={followCounts.followers}
                onFollowing={() => onViewFollowList && onViewFollowList(userId, 'following')}
                onFollowers={() => onViewFollowList && onViewFollowList(userId, 'followers')} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {blockState === 'blockedByMe' ? (
              <button onClick={handleUnblock} style={{
                padding: '10px 32px', background: 'transparent', color: '#C05050',
                border: '1.5px solid #F0C8C8', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}>Unblock</button>
            ) : blockState === 'blockedMe' ? (
              <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '10px 0' }}>This account isn't available</div>
            ) : approved ? (
              <button onClick={unfollow} style={{
                padding: '10px 32px', background: 'var(--ink)', color: 'var(--cream)',
                border: 'none', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}>Following</button>
            ) : followStatus === 'pending' ? (
              <button disabled style={{
                padding: '10px 32px', background: 'var(--parchment)', color: 'var(--muted)',
                border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'not-allowed'
              }}>Requested</button>
            ) : (
              <button onClick={sendFollowRequest} style={{
                padding: '10px 32px', background: 'transparent', color: 'var(--clay)',
                border: '2px solid var(--clay)', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}>{profile?.is_private === false ? 'Follow' : 'Request to follow'}</button>
            )}
            {userId !== session.user.id && (
              <button onClick={() => setProfileMenuOpen(true)} aria-label="More options" style={{
                width: '40px', height: '40px', borderRadius: '50%', background: 'var(--parchment)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--charcoal)"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
              </button>
            )}
          </div>

          {profileMenuOpen && (
            <MoreMenuSheet onClose={() => setProfileMenuOpen(false)} actions={[
              { label: 'Report profile', onTap: () => { setProfileMenuOpen(false); setModeration({ mode: 'report', target: { type: 'profile', id: userId, userId, name } }) } },
              blockState === 'blockedByMe'
                ? { label: `Unblock ${name}`.trim(), onTap: handleUnblock }
                : { label: `Block ${name}`.trim(), danger: true, onTap: () => { setProfileMenuOpen(false); setModeration({ mode: 'block', target: { type: 'profile', id: userId, userId, name } }) } },
            ]} />
          )}

          {moderation && (
            <ModerationSheet mode={moderation.mode} target={moderation.target} session={session} onClose={handleModerationClose} />
          )}
        </div>

        {/* Not following yet: a clear lock card (hidden for blocked accounts, which say so above) */}
        {!approved && !blockState && profile && (() => {
          const isPublic = profile.is_private === false
          const title = isPublic ? `Follow ${first} to see their Cookbook` : `${first}'s Cookbook is private`
          const body = followStatus === 'pending'
            ? `Request sent. You'll see their cooks and verdicts once ${first} approves.`
            : isPublic
              ? 'Their cooks, verdicts and saved recipes show up here once you follow.'
              : `Request to follow to see their cooks, verdicts and saved recipes. ${first} approves every request.`
          return (
            <div style={{ margin: '4px 20px 24px' }}>
              <EmptyState icon={IconLock} title={title} body={body} />
            </div>
          )
        })()}

        {approved && <>
          <StatsStrip saved={stats.saved} cooked={stats.cooked} onSaved={() => openCookbook('All')} onCooked={() => openCookbook('Cooked')} />

          <ProfileTabs
            tabs={[{ id: 'stats', label: 'Stats' }, { id: 'cookbook', label: 'Cookbook' }, { id: 'activity', label: 'Activity' }]}
            active={activeTab} onChange={setActiveTab} />

          {activeTab === 'stats' && (
            <>
              {statsLoaded && recentCooks.length === 0 && topRated.length === 0 && (
                <div style={{ padding: '0 20px', marginBottom: '24px' }}>
                  <EmptyState icon={IconPot} title={`${first} hasn't logged a cook yet`}
                    body="Their verdicts and go-tos show up here once they do."
                    primary={wantToMake.length === 0 && allRecipes.length > 0 ? { label: 'See their Cookbook', icon: IconBook, onClick: () => openCookbook('All') } : null} />
                </div>
              )}
              <StatsLists
                recentCooks={recentCooks} topRated={topRated} wantToMake={wantToMake}
                onSelectRecent={openCook}
                onSelectGoTo={openCook}
                onSelectWant={recipe => handleRecipeTap(recipe)}
                onSeeAllWant={() => openCookbook('Want to Make')}
              />
            </>
          )}

          {activeTab === 'cookbook' && (
            <FriendCookbook
              recipes={allRecipes} firstName={first}
              filter={cookbookFilter} onFilter={setCookbookFilter}
              cookStats={friendCookScoresMap} circleMap={friendCircleMap}
              onSelect={handleRecipeTap}
              onCircle={recipe => setCircleModal(recipe)} />
          )}

          {activeTab === 'activity' && (
            <div style={{ padding: '0 20px' }}>
              {friendActivityLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
              ) : friendActivity.length === 0 ? (
                <EmptyState icon={IconPot} title="Nothing here yet" body={`When ${first} saves or cooks something, it shows up here.`} />
              ) : (
                <ActivityList items={friendActivity} engagement={friendEngagement} onSelectCook={openCook} onSelectSave={onSelectSave} />
              )}
            </div>
          )}
        </>}

        {circleModal && (
          <CircleFriendsModal canonicalId={circleModal.canonical_id} sourceUrl={circleModal.source_url} excludeUserId={userId} session={session}
            onClose={() => setCircleModal(null)} onSelectUser={id => { setCircleModal(null); onSelectUser && onSelectUser(id) }} />
        )}

      </div>
    </div>
  )
}
