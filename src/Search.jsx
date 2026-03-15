import { useState } from 'react'
import { supabase } from './supabase'

export default function Search({ session, onSelectUser, onSelectSave }) {
  const [activeTab, setActiveTab] = useState('people')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [recipeResults, setRecipeResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [followStates, setFollowStates] = useState({})

  async function searchPeople() {
    if (!query.trim()) return
    setLoading(true)

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .neq('id', session.user.id)
      .limit(20)

    if (data) {
      setResults(data)
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id, status')
        .eq('follower_id', session.user.id)
        .in('following_id', data.map(p => p.id))

      const states = {}
      if (follows) follows.forEach(f => { states[f.following_id] = f.status })
      setFollowStates(states)
    }

    setLoading(false)
  }

  async function searchRecipes() {
    if (!query.trim()) return
    setLoading(true)

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id)
      .eq('status', 'approved')

    if (!follows || follows.length === 0) {
      setRecipeResults([])
      setLoading(false)
      return
    }

    const friendIds = follows.map(f => f.following_id)

    const { data: recipes } = await supabase
      .from('recipes')
      .select('*')
      .in('user_id', friendIds)
      .ilike('title', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(30)

    if (!recipes || recipes.length === 0) {
      setRecipeResults([])
      setLoading(false)
      return
    }

    const userIds = [...new Set(recipes.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', userIds)

    setRecipeResults(recipes.map(r => ({
      ...r,
      profiles: profiles?.find(p => p.id === r.user_id) || null
    })))

    setLoading(false)
  }

  function handleSearch() {
    if (activeTab === 'people') searchPeople()
    else searchRecipes()
  }

  async function sendFollowRequest(userId) {
    await supabase.from('follows').insert({
      follower_id: session.user.id,
      following_id: userId,
      status: 'pending'
    })
    await supabase.from('notifications').insert({
      recipient_id: userId,
      actor_id: session.user.id,
      type: 'follow_request',
    })
    setFollowStates(s => ({ ...s, [userId]: 'pending' }))
  }

  async function unfollow(userId) {
    await supabase.from('follows').delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', userId)
    setFollowStates(s => ({ ...s, [userId]: null }))
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px 100px' }}>

      {/* Spacer for top bar */}
      <div style={{ height: '70px' }} />

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', padding: '4px', marginBottom: '20px' }}>
        {['people', 'recipes'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setResults([]); setRecipeResults([]); setQuery('') }} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: 'var(--radius-pill)',
            background: activeTab === tab ? 'var(--clay)' : 'transparent',
            color: activeTab === tab ? 'var(--cream)' : 'var(--muted)',
            fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
            cursor: 'pointer', transition: 'all 0.15s'
          }}>
            {tab === 'people' ? 'Find Cooks' : 'Search Recipes'}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={activeTab === 'people' ? 'Search by name or username...' : 'Search your friends\' recipes...'}
          style={{
            flex: 1, padding: '12px 16px',
            border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
            background: 'var(--warm-white)', fontFamily: 'var(--font-body)',
            fontSize: '14px', color: 'var(--ink)', outline: 'none'
          }}
        />
        <button onClick={handleSearch} style={{
          padding: '12px 20px', background: 'var(--clay)', color: 'var(--cream)',
          border: 'none', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
        }}>Search</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' }}>Searching...</div>
      ) : activeTab === 'people' ? (
        results.length === 0 && query ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' }}>No cooks found for "{query}"</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {results.map(profile => {
              const followStatus = followStates[profile.id]
              return (
                <div key={profile.id} style={{
                  background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--parchment)', padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                }} onClick={() => onSelectUser(profile.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0
                    }}>
                      {(profile.full_name || profile.username || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>{profile.full_name || profile.username}</div>
                      {profile.username && profile.full_name && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{profile.username}</div>}
                    </div>
                  </div>
                  {followStatus === 'approved' ? (
                    <button onClick={e => { e.stopPropagation(); unfollow(profile.id) }} style={{ padding: '7px 14px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Following</button>
                  ) : followStatus === 'pending' ? (
                    <button disabled style={{ padding: '7px 14px', background: 'var(--parchment)', color: 'var(--muted)', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'not-allowed' }}>Requested</button>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); sendFollowRequest(profile.id) }} style={{ padding: '7px 14px', background: 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Follow</button>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        recipeResults.length === 0 && query ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' }}>No recipes found for "{query}"</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recipeResults.map(recipe => (
              <div key={recipe.id} onClick={() => onSelectSave && onSelectSave(recipe)} style={{
                background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--parchment)', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer'
              }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: 'var(--radius-md)',
                  overflow: 'hidden', flexShrink: 0,
                  background: recipe.image_url ? 'var(--parchment)' : 'linear-gradient(135deg, var(--clay), var(--ember))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {recipe.image_url
                    ? <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recipe.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    in {recipe.profiles?.full_name || recipe.profiles?.username || 'someone'}'s cookbook
                    {recipe.source_name ? ` · ${recipe.source_name}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}