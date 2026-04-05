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
  if (recipe.image_url) {
    return (
      <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
        <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return <RecipeInitial title={recipe.title} />
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
          <img src={recipe.image_url} alt="" style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }} />
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

export default function FriendProfile({ userId, session, onBack, onSelectCook, onViewFollowList }) {
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
    console.log('fetchFollowCounts for userId:', userId)
    const { count: followingCount } = await supabase
      .from('follows').select('*', { count: 'exact', head: true })
      .eq('follower_id', userId).eq('status', 'approved')
    const { count: followersCount } = await supabase
      .from('follows').select('*', { count: 'exact', head: true })
      .eq('following_id', userId).eq('status', 'approved')
    console.log('followingCount:', followingCount, 'followersCount:', followersCount)
    setFollowCounts({ following: followingCount || 0, followers: followersCount || 0 })
  }

  useEffect(() => {
    if (followStatus === 'approved') {
      fetchCooks()
      fetchStats()
      fetchWantToMake()
      fetchAllRecipes()
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
    if (data) setAllRecipes(data)
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
    // Find most recent cook for this recipe
    const cook = cooks.find(c => c.recipe_id === recipe.id)
    if (cook) {
      onSelectCook(cook)
    } else {
      setSelectedRecipe(recipe)
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
              <img src={profile.avatar_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 3px var(--cream), 0 0 0 5px var(--tan)', display: 'block' }} />
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
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔒</div>
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
            {['stats', 'cookbook'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '10px',
                background: activeTab === tab ? 'var(--clay)' : 'var(--warm-white)',
                color: activeTab === tab ? 'var(--cream)' : 'var(--muted)',
                border: 'none',
                borderRight: tab === 'stats' ? '1px solid var(--parchment)' : 'none',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>
                {tab === 'stats' ? 'Stats' : 'Cookbook'}
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
                          background: recipe.image_url ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
                          marginBottom: '6px', position: 'relative', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {recipe.image_url
                            ? <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                          }
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
              padding: '10px 14px', marginBottom: '16px',
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

            {/* Filters + Sort */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {FILTERS.map(f => (
                  <button key={f} onClick={() => setCookbookFilter(f)} style={{
                    padding: '7px 16px', borderRadius: 'var(--radius-pill)',
                    border: cookbookFilter === f ? 'none' : '1.5px solid var(--tan)',
                    background: cookbookFilter === f ? 'var(--clay)' : 'transparent',
                    color: cookbookFilter === f ? 'var(--cream)' : 'var(--muted)',
                    fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s'
                  }}>{f}</button>
                ))}
              </div>
              <select
                value={cookbookSort}
                onChange={e => setCookbookSort(e.target.value)}
                style={{
                  flexShrink: 0, marginLeft: '10px', padding: '7px 12px',
                  borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--tan)',
                  background: 'var(--warm-white)', color: 'var(--muted)',
                  fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', outline: 'none'
                }}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="alpha">A→Z</option>
              </select>
            </div>

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
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px'
                  }}>
                    {recipe.image_url && (
                      <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-sm)', background: 'var(--parchment)', flexShrink: 0, overflow: 'hidden' }}>
                        <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}