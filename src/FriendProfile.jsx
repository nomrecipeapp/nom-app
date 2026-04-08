import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never' },
}

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

const FILTERS = ['All', 'Want to Make', 'Cooked', 'Never Again']

function RecipeInitial({ title }) {
  const letter = (title || '?')[0].toUpperCase()
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
      background: 'linear-gradient(135deg, var(--clay), var(--ember))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontFamily: 'var(--font-display)',
      fontSize: '14px', fontWeight: '700', color: 'var(--cream)'
    }}>{letter}</div>
  )
}

function RecipeThumbnailSmall({ recipe }) {
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
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
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)' }}>
        {(recipe.title || '?')[0].toUpperCase()}
      </span>
    </div>
  )
}

// Read-only recipe detail for uncooked recipes
function FriendRecipeDetail({ recipe, session, onBack }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duplicate, setDuplicate] = useState(null)

  async function saveRecipe() {
    if (saved || saving) return
    setSaving(true)
    const { data: existing } = await supabase
      .from('recipes')
      .select('id, title')
      .eq('user_id', session.user.id)
      .eq('source_url', recipe.source_url)
      .maybeSingle()

    if (existing) {
      setDuplicate(existing)
      setSaving(false)
      return
    }

    await supabase.from('recipes').insert({
      user_id: session.user.id,
      title: recipe.title,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      image_url: recipe.image_url,
      cook_time: recipe.cook_time,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      notes: recipe.notes,
      status: 'want_to_make'
    })
    setSaving(false)
    setSaved(true)
  }

  async function addAnyway() {
    setDuplicate(null)
    setSaving(true)
    await supabase.from('recipes').insert({
      user_id: session.user.id,
      title: recipe.title,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      image_url: recipe.image_url,
      cook_time: recipe.cook_time,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      notes: recipe.notes,
      status: 'want_to_make'
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>
      {recipe.image_url ? (
        <div style={{ position: 'relative' }}>
          <img src={recipe.image_url} alt="" style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
          <button onClick={onBack} style={{
            position: 'absolute', top: '16px', left: '16px',
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      ) : (
        <div style={{ padding: '16px 16px 0' }}>
          <button onClick={onBack} style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--parchment)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.2', marginBottom: '10px' }}>{recipe.title}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {recipe.source_name && <div style={{ background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', fontSize: '11px', fontWeight: '500', color: 'var(--charcoal)' }}>{recipe.source_name}</div>}
            {recipe.cook_time && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.cook_time}</div>}
            {recipe.difficulty && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>· {recipe.difficulty}</div>}
          </div>
        </div>

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--parchment)', borderRadius: 'var(--radius-md)',
            padding: '10px 14px', marginBottom: '16px', textDecoration: 'none'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--clay)' }}>View original recipe →</div>
            {recipe.source_name && <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{recipe.source_name}</div>}
          </a>
        )}

        {recipe.ingredients && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>Ingredients</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recipe.ingredients.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--clay)', flexShrink: 0, marginTop: '6px' }} />
                  <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.5' }}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recipe.instructions && (
          <div style={{ background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>Instructions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {recipe.instructions.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--clay)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
                  <span style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.6', flex: 1 }}>{line.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {duplicate && (
          <div style={{ background: '#FEF3E2', border: '1px solid #F5C47A', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9A6B1A', marginBottom: '8px' }}>Already in your Cookbook: "{duplicate.title}"</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addAnyway} style={{
                flex: 1, padding: '8px', background: 'transparent',
                border: '1px solid #F5C47A', borderRadius: 'var(--radius-pill)',
                fontSize: '12px', fontWeight: '600', color: '#9A6B1A', cursor: 'pointer'
              }}>Add Anyway</button>
            </div>
          </div>
        )}

        {!duplicate && (
          <button onClick={saveRecipe} disabled={saved || saving} style={{
            width: '100%', padding: '15px',
            background: saved ? 'var(--sage)' : 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
            cursor: saved ? 'default' : 'pointer', transition: 'background 0.2s'
          }}>
            {saved ? '✓ Saved to Cookbook' : saving ? 'Saving...' : '+ Save to My Cookbook'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function FriendProfile({ userId, session, onBack, onSelectCook, onSelectSave, onViewFollowList }) {
  const [profile, setProfile] = useState(null)
  const [cooks, setCooks] = useState([])
  const [allRecipes, setAllRecipes] = useState([])
  const [stats, setStats] = useState({ saved: 0, cooked: 0 })
  const [followStatus, setFollowStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentCooks, setRecentCooks] = useState([])
  const [topRated, setTopRated] = useState([])
  const [wantToMake, setWantToMake] = useState([])
  const [activeTab, setActiveTab] = useState('stats')
  const [cookbookFilter, setCookbookFilter] = useState('All')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [cookbookSort, setCookbookSort] = useState('newest')
  const [cookbookSearch, setCookbookSearch] = useState('')
  const [followCounts, setFollowCounts] = useState({ following: 0, followers: 0 })
  const [friendActivity, setFriendActivity] = useState([])
  const [friendEngagement, setFriendEngagement] = useState({})
  const [friendActivityLoading, setFriendActivityLoading] = useState(false)
  const [friendCookScoresMap, setFriendCookScoresMap] = useState({})
  const [friendCircleMap, setFriendCircleMap] = useState({})

  useEffect(() => {
    setFollowCounts({ following: 0, followers: 0 })
    setFollowStatus(null)
    setProfile(null)
    setLoading(true)
    fetchProfile()
    fetchFollowStatus()
    fetchFollowCounts()
  }, [userId])

  async function fetchFollowCounts() {
    const { count: followingCount } = await supabase
      .from('follows').select('*', { count: 'exact', head: true })
      .eq('follower_id', userId).eq('status', 'approved')
    const { count: followersCount } = await supabase
      .from('follows').select('*', { count: 'exact', head: true })
      .eq('following_id', userId).eq('status', 'approved')
    setFollowCounts({ following: followingCount || 0, followers: followersCount || 0 })
  }

  useEffect(() => {
    if (followStatus === 'approved') {
      fetchCooks()
      fetchStats()
      fetchWantToMake()
      fetchAllRecipes()
      fetchFriendActivity()
    }
  }, [followStatus])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
    setLoading(false)
  }

  async function fetchStats() {
    const { count: saved } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: cooked } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'cooked')

    setStats({ saved: saved || 0, cooked: cooked || 0 })
  }

  async function fetchAllRecipes() {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) {
      setAllRecipes(data)
      fetchFriendCookScores(data)
      fetchFriendCircleCounts(data)
    }
  }

  async function fetchFriendCookScores(recipeList) {
    const recipeIds = recipeList.map(r => r.id)
    if (recipeIds.length === 0) return
    const { data: cooks } = await supabase
      .from('cooks').select('recipe_id, flavor, effort, would_share, true_to_recipe')
      .in('recipe_id', recipeIds).eq('user_id', userId)
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
    setFriendCookScoresMap(avgMap)
  }

  async function fetchFriendCircleCounts(recipeList) {
    const { data: following } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!following || following.length === 0) return
    const followingIds = following.map(f => f.following_id)
    const canonicalIds = recipeList.filter(r => r.canonical_id).map(r => r.canonical_id)
    if (canonicalIds.length === 0) return
    const { data: matches } = await supabase
      .from('recipes').select('user_id, canonical_id')
      .in('canonical_id', canonicalIds).in('user_id', followingIds)
    if (!matches || matches.length === 0) return
    const map = {}
    for (const recipe of recipeList) {
      if (!recipe.canonical_id) continue
      const count = matches.filter(m => m.canonical_id === recipe.canonical_id).length
      if (count > 0) map[recipe.id] = count
    }
    setFriendCircleMap(map)
  }

  async function fetchCooks() {
    const { data } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .eq('user_id', userId)
      .order('cooked_at', { ascending: false })
      .limit(100)

    if (!data) return
    setCooks(data)

    const seenRecent = new Set()
    const recent = data.filter(c => {
      if (!c.recipes) return false
      if (seenRecent.has(c.recipe_id)) return false
      seenRecent.add(c.recipe_id)
      return true
    }).slice(0, 5)
    setRecentCooks(recent)

    const recipeMap = {}
    data.forEach(cook => {
      if (!cook.recipes) return
      const id = cook.recipe_id
      if (!recipeMap[id]) recipeMap[id] = { cook, scores: [], recipe: cook.recipes }
      const scores = [cook.flavor, cook.effort, cook.would_share, cook.true_to_recipe].filter(Boolean)
      if (scores.length > 0) recipeMap[id].scores.push(...scores)
    })

    const ranked = Object.values(recipeMap)
      .map(entry => ({
        ...entry.cook, recipes: entry.recipe,
        avgScore: entry.scores.length > 0 ? entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length : 0
      }))
      .filter(e => e.avgScore > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)

    setTopRated(ranked)
  }

  async function fetchWantToMake() {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'want_to_make')
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setWantToMake(data)
  }

  async function fetchFriendActivity() {
    setFriendActivityLoading(true)
    const { data: cooks } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .eq('user_id', userId)
      .order('cooked_at', { ascending: false })
      .limit(30)

    const saves = await supabase.from('recipes').select('*').eq('user_id', userId)
      .eq('status', 'want_to_make').order('created_at', { ascending: false }).limit(30)

    const cookItems = (cooks || []).filter(c => c.recipes).map(c => ({ ...c, profiles: profile, _type: 'cook', _date: c.cooked_at }))
    const saveItems = (saves.data || []).map(r => ({ ...r, _type: 'save', _date: r.created_at }))
    const merged = [...cookItems, ...saveItems].sort((a, b) => new Date(b._date) - new Date(a._date))
    setFriendActivity(merged)

    const cookIds = (cooks || []).map(c => c.id)
    const saveIds = (saves.data || []).map(r => r.id)

    const queries = []
    if (cookIds.length > 0) {
      queries.push(supabase.from('likes').select('target_id').eq('target_type', 'cook').in('target_id', cookIds))
      queries.push(supabase.from('comments').select('target_id').eq('target_type', 'cook').in('target_id', cookIds))
    } else {
      queries.push(Promise.resolve({ data: [] }))
      queries.push(Promise.resolve({ data: [] }))
    }
    if (saveIds.length > 0) {
      queries.push(supabase.from('likes').select('target_id').eq('target_type', 'save').in('target_id', saveIds))
      queries.push(supabase.from('comments').select('target_id').eq('target_type', 'save').in('target_id', saveIds))
    } else {
      queries.push(Promise.resolve({ data: [] }))
      queries.push(Promise.resolve({ data: [] }))
    }

    const [{ data: cookLikes }, { data: cookComments }, { data: saveLikes }, { data: saveComments }] = await Promise.all(queries)

    const eng = {}
    cookIds.forEach(id => {
      eng[`cook-${id}`] = {
        likes: cookLikes?.filter(l => l.target_id === id).length || 0,
        comments: cookComments?.filter(c => c.target_id === id).length || 0,
      }
    })
    saveIds.forEach(id => {
      eng[`save-${id}`] = {
        likes: saveLikes?.filter(l => l.target_id === id).length || 0,
        comments: saveComments?.filter(c => c.target_id === id).length || 0,
      }
    })
    setFriendEngagement(eng)
    setFriendActivityLoading(false)
  }

  async function fetchFollowStatus() {
    const { data } = await supabase
      .from('follows')
      .select('status')
      .eq('follower_id', session.user.id)
      .eq('following_id', userId)
      .single()
    if (data) setFollowStatus(data.status)
    else setFollowStatus(null)
  }

  async function sendFollowRequest() {
  await supabase.from('follows').insert({
    follower_id: session.user.id,
    following_id: userId,
    status: 'pending'
  })
  setFollowStatus('pending')
  // Notify the person being requested
  await supabase.from('notifications').insert({
    recipient_id: userId,
    actor_id: session.user.id,
    type: 'follow_request',
  })
}
  async function unfollow() {
    if (!confirm('Unfollow this cook?')) return
    await supabase.from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', userId)
    setFollowStatus(null)
    setCooks([])
    setRecentCooks([])
    setTopRated([])
    setAllRecipes([])
    setStats({ saved: 0, cooked: 0 })
  }

  function handleRecipeTap(recipe) {
    const cook = cooks.find(c => c.recipe_id === recipe.id)
    if (cook) {
      onSelectCook(cook)
    } else {
      onSelectSave && onSelectSave(recipe)
    }
  }

  const filteredRecipes = allRecipes
    .filter(r => {
      if (cookbookFilter === 'Want to Make') return r.status === 'want_to_make'
      if (cookbookFilter === 'Cooked') return r.status === 'cooked'
      if (cookbookFilter === 'Never Again') return r.status === 'never_again'
      return true
    })
    .filter(r => {
      if (!cookbookSearch.trim()) return true
      const q = cookbookSearch.toLowerCase()
      return r.title?.toLowerCase().includes(q) || r.source_name?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (cookbookSort === 'alpha') return a.title.localeCompare(b.title)
      if (cookbookSort === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (cookbookSort === 'score') return (friendCookScoresMap[b.id] || 0) - (friendCookScoresMap[a.id] || 0)
      if (cookbookSort === 'friends') return (friendCircleMap[b.id] || 0) - (friendCircleMap[a.id] || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const sectionLabel = {
    fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px'
  }

  const listRow = {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  // Show read-only recipe detail
  if (selectedRecipe) return (
    <FriendRecipeDetail
      recipe={selectedRecipe}
      session={session}
      onBack={() => setSelectedRecipe(null)}
    />
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ height: '54px' }} />

        {/* Avatar + name + follow */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 20px' }}>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)', display: 'block' }} onError={e => e.target.style.display = 'none'} />
            ) : (
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)' }}>
                {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--ink)', marginBottom: '2px' }}>
            {profile?.full_name || profile?.username}
          </div>

          {profile?.username && profile?.full_name && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>@{profile.username}</div>
          )}

          <div style={{ marginBottom: '20px' }}>
            {followStatus === 'approved' ? (
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
              }}>Request to Follow</button>
            )}
          </div>

          {followStatus === 'approved' && (
            <div style={{ display: 'flex', width: '100%', borderTop: '1px solid var(--parchment)', borderBottom: '1px solid var(--parchment)' }}>
              <button onClick={() => { setActiveTab('cookbook'); setCookbookFilter('All') }} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', borderRight: '1px solid var(--parchment)', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{stats.saved}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Saved</div>
              </button>
              <button onClick={() => { setActiveTab('cookbook'); setCookbookFilter('Cooked') }} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', borderRight: '1px solid var(--parchment)', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{stats.cooked}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Cooked</div>
              </button>
              <button onClick={() => onViewFollowList && onViewFollowList(userId, 'following')} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', borderRight: '1px solid var(--parchment)', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{followCounts.following}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Following</div>
              </button>
              <button onClick={() => onViewFollowList && onViewFollowList(userId, 'followers')} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>{followCounts.followers}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Followers</div>
              </button>
            </div>
          )}
        </div>

        {/* Not following state */}
        {followStatus !== 'approved' && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--muted)' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '8px' }}>Private Cookbook</div>
            <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
              Follow {profile?.full_name || 'this cook'} to see what they're making.
            </div>
          </div>
        )}

        {/* Tabs */}
        {followStatus === 'approved' && (
          <div style={{
            display: 'flex', margin: '0 20px 20px',
            border: '1px solid var(--parchment)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden'
          }}>
            {['stats', 'cookbook', 'activity'].map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '10px',
                background: activeTab === tab ? 'var(--clay)' : 'var(--warm-white)',
                color: activeTab === tab ? 'var(--cream)' : 'var(--muted)',
                border: 'none',
                borderRight: i < 2 ? '1px solid var(--parchment)' : 'none',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>
                {tab === 'stats' ? 'Stats' : tab === 'cookbook' ? 'Cookbook' : 'Activity'}
              </button>
            ))}
          </div>
        )}

        {/* Stats Tab */}
        {followStatus === 'approved' && activeTab === 'stats' && (
          <>
            {/* Recently Cooked */}
            {recentCooks.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ padding: '0 20px', marginBottom: '12px' }}>
                  <div style={sectionLabel}>Recently Cooked</div>
                </div>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
                  {recentCooks.map(cook => {
                    const v = verdictStyles[cook.verdict]
                    const recipe = cook.recipes
                    if (!recipe) return null
                    return (
                      <div key={cook.id} onClick={() => onSelectCook(cook)} style={{ flexShrink: 0, width: '88px', cursor: 'pointer' }}>
                        <div style={{
                          width: '88px', height: '88px', borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                          marginBottom: '6px', position: 'relative', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {recipe.image_url && (
                            <img
                              src={recipe.image_url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                              onError={e => e.target.style.display = 'none'}
                            />
                          )}
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                          {v && (
                            <div style={{
                              position: 'absolute', bottom: '4px', left: '4px',
                              background: v.bg, border: '1px solid ' + v.border,
                              borderRadius: '100px', padding: '2px 6px',
                              fontSize: '8px', fontWeight: '700', color: v.color
                            }}>{v.label}</div>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--charcoal)', fontWeight: '500', lineHeight: '1.3', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{recipe.title}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {recentCooks.length > 0 && <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />}

            {/* Top Rated */}
            {topRated.length > 0 && (
              <div style={{ padding: '0 20px', marginBottom: '24px' }}>
                <div style={sectionLabel}>Top Rated</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {topRated.map(cook => {
                    const recipe = cook.recipes
                    if (!recipe) return null
                    return (
                      <div key={cook.id} onClick={() => onSelectCook(cook)} style={{ ...listRow, cursor: 'pointer' }}>
                        <RecipeThumbnailSmall recipe={recipe} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                          {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{recipe.source_name}</div>}
                        </div>
                        <div style={{ background: 'var(--ink)', borderRadius: '100px', padding: '3px 8px', fontSize: '10px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{cook.avgScore.toFixed(1)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {topRated.length > 0 && <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />}

            {/* Want to Make */}
            {wantToMake.length > 0 && (
              <div style={{ padding: '0 20px', marginBottom: '24px' }}>
                <div style={sectionLabel}>Want to Make</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {wantToMake.map(recipe => (
                    <div key={recipe.id} onClick={() => handleRecipeTap(recipe)} style={{ ...listRow, cursor: 'pointer' }}>
                      <RecipeThumbnailSmall recipe={recipe} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                        {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{recipe.source_name}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setActiveTab('cookbook')} style={{
                  marginTop: '12px', padding: '8px 0',
                  background: 'none', border: 'none',
                  fontFamily: 'var(--font-body)', fontSize: '12px',
                  fontWeight: '600', color: 'var(--clay)', cursor: 'pointer'
                }}>See all in Cookbook →</button>
              </div>
            )}
          </>
        )}

        {/* Cookbook Tab */}
        {followStatus === 'approved' && activeTab === 'cookbook' && (
          <div style={{ padding: '0 20px' }}>

            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'var(--warm-white)', borderRadius: 'var(--radius-md)',
              padding: '10px 14px', marginBottom: '12px',
              border: '1.5px solid var(--tan)'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
                <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={cookbookSearch}
                onChange={e => setCookbookSearch(e.target.value)}
                placeholder="Search recipes..."
                style={{
                  flex: 1, border: 'none', background: 'none',
                  fontFamily: 'var(--font-body)', fontSize: '14px',
                  color: 'var(--ink)', outline: 'none'
                }}
              />
              {cookbookSearch && (
                <button onClick={() => setCookbookSearch('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: '16px', padding: 0, lineHeight: 1
                }}>×</button>
              )}
            </div>

            {/* Status label */}
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Status</div>

            {/* Status chips */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '12px' }}>
              {FILTERS.map(f => (
                <button key={f} onClick={() => setCookbookFilter(f)} style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-pill)',
                  border: cookbookFilter === f ? 'none' : '1.5px solid var(--tan)',
                  background: cookbookFilter === f ? 'var(--clay)' : 'transparent',
                  color: cookbookFilter === f ? 'var(--cream)' : 'var(--muted)',
                  fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s'
                }}>{f}</button>
              ))}
            </div>

            <div style={{ height: '1px', background: 'var(--parchment)', marginBottom: '12px' }} />

            {/* Sort row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Sort</div>
              <select
                value={cookbookSort}
                onChange={e => setCookbookSort(e.target.value)}
                style={{
                  padding: '5px 10px', borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--tan)', background: 'var(--warm-white)',
                  color: 'var(--muted)', fontFamily: 'var(--font-body)',
                  fontSize: '11px', fontWeight: '600', cursor: 'pointer', outline: 'none'
                }}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="alpha">A→Z</option>
                <option value="score">Cook Score</option>
                <option value="friends">Friends Have It</option>
              </select>
            </div>

            {/* Recipe count */}
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
              {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
            </div>

            {filteredRecipes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '13px' }}>
                No {cookbookFilter === 'All' ? '' : cookbookFilter} recipes yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredRecipes.map(recipe => (
                  <div key={recipe.id} onClick={() => handleRecipeTap(recipe)} style={{
                    background: 'var(--warm-white)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--parchment)', padding: '16px 18px',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {recipe.image_url && (
                        <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-sm)', background: 'var(--parchment)', flexShrink: 0, overflow: 'hidden' }}>
                          <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => e.target.parentElement.style.display = 'none'} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '500', color: 'var(--ink)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recipe.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {recipe.source_name && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{recipe.source_name}</span>}
                          {recipe.cook_time && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>· {recipe.cook_time}</span>}
                        </div>
                      </div>
                      <div style={{ ...verdictStyle[recipe.status], padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                        {statusLabel[recipe.status]}
                      </div>
                    </div>
                    {friendCircleMap[recipe.id] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--parchment)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="9" cy="7" r="4" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          <span style={{ fontWeight: '600', color: 'var(--clay)' }}>
                            {friendCircleMap[recipe.id]} {friendCircleMap[recipe.id] === 1 ? 'friend' : 'friends'}
                          </span> also have this
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {followStatus === 'approved' && activeTab === 'activity' && (
          <div style={{ padding: '0 20px' }}>
            {friendActivityLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
            ) : friendActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '8px' }}>No cooks logged yet</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Nothing here yet.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {friendActivity.map(item => {
                  if (item._type === 'save') {
                    return (
                      <div key={`save-${item.id}`} onClick={() => onSelectSave && onSelectSave(item)} style={{
                        background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--parchment)', overflow: 'hidden', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                          <div style={{
                            width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                            flexShrink: 0, overflow: 'hidden', position: 'relative',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {item.image_url && (
                              <img src={item.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                            )}
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--cream)' }}>{(item.title || '?')[0].toUpperCase()}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Saved a recipe</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                            {item.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{item.source_name}</div>}
                          </div>
                          <div style={{ background: 'var(--parchment)', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--muted)', flexShrink: 0 }}>Want to Make</div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderTop: '1px solid var(--parchment)' }}>
                          {(() => { const eng = friendEngagement[`save-${item.id}`] || { likes: 0, comments: 0 }; return (<>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.likes > 0 ? `${eng.likes} ` : ''}Like</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.comments > 0 ? `${eng.comments} ` : ''}Comment</span>
                            </div>
                          </>)})()}
                        </div>
                      </div>
                    )
                  }

                  const recipe = item.recipes
                  if (!recipe) return null
                  const eng = friendEngagement[`cook-${item.id}`] || { likes: 0, comments: 0 }
                  const verdictMap = {
                    would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
                    it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
                    never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
                  }
                  const v = verdictMap[item.verdict]
                  return (
                    <div key={`cook-${item.id}`} onClick={() => onSelectCook(item)} style={{
                      background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--parchment)', overflow: 'hidden', cursor: 'pointer'
                    }}>
                      {(item.photo_urls?.[0] || recipe.image_url) && (
                        <img src={item.photo_urls?.[0] || recipe.image_url} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                      )}
                      <div style={{ padding: '14px 16px' }}>
                        {v && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', background: v.bg, border: '1px solid ' + v.border, borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '11px', fontWeight: '600', color: v.color, marginBottom: '6px' }}>{v.label}</div>
                        )}
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '500', color: 'var(--ink)', marginBottom: '4px' }}>{recipe.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date(item.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        {item.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.55', fontStyle: 'italic', marginTop: '8px' }}>"{item.notes}"</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderTop: '1px solid var(--parchment)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.likes > 0 ? `${eng.likes} ` : ''}Like</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.comments > 0 ? `${eng.comments} ` : ''}Comment</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}