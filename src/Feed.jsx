import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import LikesModal from './LikesModal'
import CircleFriendsModal from './CircleFriendsModal'

const verdictStyles = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--parchment)', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--parchment)', flexShrink: 0 }} className="skel" />
        <div style={{ flex: 1 }}>
          <div style={{ height: '12px', width: '40%', background: 'var(--parchment)', borderRadius: '6px', marginBottom: '6px' }} className="skel" />
          <div style={{ height: '10px', width: '25%', background: 'var(--parchment)', borderRadius: '6px' }} className="skel" />
        </div>
      </div>
      <div style={{ height: '180px', background: 'var(--parchment)' }} className="skel" />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ height: '12px', width: '30%', background: 'var(--parchment)', borderRadius: '6px', marginBottom: '10px' }} className="skel" />
        <div style={{ height: '18px', width: '75%', background: 'var(--parchment)', borderRadius: '6px', marginBottom: '8px' }} className="skel" />
        <div style={{ height: '13px', width: '60%', background: 'var(--parchment)', borderRadius: '6px' }} className="skel" />
      </div>
    </div>
  )
}

export default function Feed({ session, onSelectCook, onSelectUser, onSelectSave, onGoToSearch, onGoToCookbook, savedScrollY, onScrollChange }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedLikes, setFeedLikes] = useState({})
  const [feedLikeCounts, setFeedLikeCounts] = useState({})
  const [feedCommentCounts, setFeedCommentCounts] = useState({})
  const [likesModal, setLikesModal] = useState(null)
  const [circleModal, setCircleModal] = useState(null)
  const [circleFriendsMap, setCircleFriendsMap] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [updatedLabel, setUpdatedLabel] = useState('')

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(null)
  const isPulling = useRef(false)
  const PULL_THRESHOLD = 72
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    fetchFeed()
    fetchSuggestions()
  }, [session.user.id])

  // Restore scroll position after feed loads
  useEffect(() => {
    if (!loading && savedScrollY) {
      const container = document.getElementById('feed-scroll-container')
      if (container) container.scrollTop = savedScrollY
    }
  }, [loading])

  // Save scroll position on scroll
  useEffect(() => {
    const container = document.getElementById('feed-scroll-container')
    if (!container) return
    function handleScroll() {
      onScrollChange && onScrollChange(container.scrollTop)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [onScrollChange])

  // Tick the "last updated" label every 30s
  useEffect(() => {
    if (!lastUpdated) return
    function updateLabel() {
      const diff = Math.floor((Date.now() - lastUpdated) / 1000)
      if (diff < 10) setUpdatedLabel('Updated just now')
      else if (diff < 60) setUpdatedLabel(`Updated ${diff}s ago`)
      else if (diff < 3600) setUpdatedLabel(`Updated ${Math.floor(diff / 60)}m ago`)
      else setUpdatedLabel(`Updated ${Math.floor(diff / 3600)}h ago`)
    }
    updateLabel()
    const interval = setInterval(updateLabel, 30000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  // ── PULL-TO-REFRESH HANDLERS ──
  function handleTouchStart(e) {
    const container = document.getElementById('feed-scroll-container')
    const scrollTop = container ? container.scrollTop : window.scrollY
    if (scrollTop <= 0 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }

  function handleTouchMove(e) {
    if (!isPulling.current || touchStartY.current === null) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta <= 0) { setPullDistance(0); return }
    // Rubber-band resistance — pull feels natural, slows down the further you go
    const resistance = Math.min(delta * 0.45, PULL_THRESHOLD + 20)
    setPullDistance(resistance)
  }

  async function handleTouchEnd() {
    if (!isPulling.current) return
    isPulling.current = false
    touchStartY.current = null

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true)
      setPullDistance(0)
      await fetchFeed()
      setIsRefreshing(false)
    } else {
      setPullDistance(0)
    }
  }

  async function fetchFeed() {
    setLoading(true)
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id)
      .eq('status', 'approved')

    if (!follows || follows.length === 0) {
      setLoading(false)
      setLastUpdated(Date.now())
      return
    }

    const ids = [...follows.map(f => f.following_id), session.user.id]

    const [{ data: cooks }, { data: saves }, { data: profiles }] = await Promise.all([
      supabase.from('cooks').select('*, recipes(*)').in('user_id', ids).order('cooked_at', { ascending: false }).limit(40),
      supabase.from('recipes').select('*').in('user_id', ids).eq('status', 'want_to_make').order('created_at', { ascending: false }).limit(40),
      supabase.from('profiles').select('*').in('id', ids)
    ])

    const cookItems = (cooks || []).map(c => ({
      ...c, _type: 'cook', _date: c.cooked_at,
      profiles: profiles?.find(p => p.id === c.user_id) || null
    }))

    const saveItems = (saves || []).map(r => ({
      ...r, _type: 'save', _date: r.created_at,
      profiles: profiles?.find(p => p.id === r.user_id) || null
    }))

    const merged = [...cookItems, ...saveItems]
      .sort((a, b) => new Date(b._date) - new Date(a._date))
      .slice(0, 60)

    setFeed(merged)
    setLoading(false)
    setLastUpdated(Date.now())
    fetchFeedEngagement(merged)
    fetchCircleFriendsForFeed(merged)
  }

  async function fetchSuggestions() {
    const { data: myFollows } = await supabase
      .from('follows').select('following_id, status')
      .eq('follower_id', session.user.id)
    const alreadyFollowing = new Set((myFollows || []).map(f => f.following_id))
    alreadyFollowing.add(session.user.id)

    const { data: myFollowers } = await supabase
      .from('follows').select('follower_id')
      .eq('following_id', session.user.id).eq('status', 'approved')
    if (!myFollowers || myFollowers.length === 0) return

    const followerIds = myFollowers.map(f => f.follower_id)
    const { data: friendsOfFriends } = await supabase
      .from('follows').select('following_id')
      .in('follower_id', followerIds).eq('status', 'approved')
    if (!friendsOfFriends || friendsOfFriends.length === 0) return

    const candidateIds = [...new Set(friendsOfFriends.map(f => f.following_id))]
      .filter(id => !alreadyFollowing.has(id))
      .slice(0, 5)

    if (candidateIds.length === 0) return

    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url')
      .in('id', candidateIds)
    setSuggestions(profiles || [])
  }

  async function fetchCircleFriendsForFeed(items) {
    const { data: following } = await supabase
      .from('follows').select('following_id')
      .eq('follower_id', session.user.id).eq('status', 'approved')
    if (!following || following.length === 0) return
    const followingIds = following.map(f => f.following_id)

    const canonicalIds = items
      .map(i => i._type === 'cook' ? i.recipes?.canonical_id : i.canonical_id)
      .filter(Boolean)
    if (canonicalIds.length === 0) return

    const { data: matchingRecipes } = await supabase
      .from('recipes').select('id, user_id, canonical_id')
      .in('canonical_id', canonicalIds)
      .in('user_id', [...followingIds, session.user.id])

    if (!matchingRecipes || matchingRecipes.length === 0) return

    const allUserIds = [...new Set(matchingRecipes.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, avatar_url').in('id', allUserIds)

    const map = {}
    for (const item of items) {
      const canonicalId = item._type === 'cook' ? item.recipes?.canonical_id : item.canonical_id
      if (!canonicalId) continue
      const allMatches = matchingRecipes.filter(m => m.canonical_id === canonicalId)
      const otherMatches = allMatches.filter(m => m.user_id !== item.user_id)
      if (otherMatches.length === 0) continue

      const iHaveIt = allMatches.some(m => m.user_id === session.user.id)
      const friendIds = [...new Set(allMatches
        .filter(m => m.user_id !== session.user.id)
        .map(m => m.user_id)
      )]
      const avatars = friendIds.slice(0, 3).map(id => profiles?.find(p => p.id === id)).filter(Boolean)
      map[`${item._type}-${item.id}`] = { count: friendIds.length, avatars, canonicalId, iHaveIt }
    }
    setCircleFriendsMap(map)
  }

  async function fetchFeedEngagement(items) {
    if (!items || items.length === 0) return
    const cookIds = items.filter(i => i._type === 'cook').map(i => i.id)
    const saveIds = items.filter(i => i._type === 'save').map(i => i.id)

    const likesMap = {}
    const likeCountsMap = {}
    const commentCountsMap = {}

    const [
      cookLikesRes, saveLikesRes,
      allCookLikesRes, allSaveLikesRes,
      allCookCommentsRes, allSaveCommentsRes
    ] = await Promise.all([
      cookIds.length > 0 ? supabase.from('likes').select('target_id').eq('target_type', 'cook').eq('user_id', session.user.id).in('target_id', cookIds) : { data: [] },
      saveIds.length > 0 ? supabase.from('likes').select('target_id').eq('target_type', 'save').eq('user_id', session.user.id).in('target_id', saveIds) : { data: [] },
      cookIds.length > 0 ? supabase.from('likes').select('target_id').eq('target_type', 'cook').in('target_id', cookIds) : { data: [] },
      saveIds.length > 0 ? supabase.from('likes').select('target_id').eq('target_type', 'save').in('target_id', saveIds) : { data: [] },
      cookIds.length > 0 ? supabase.from('comments').select('target_id').eq('target_type', 'cook').in('target_id', cookIds) : { data: [] },
      saveIds.length > 0 ? supabase.from('comments').select('target_id').eq('target_type', 'save').in('target_id', saveIds) : { data: [] },
    ])

    cookLikesRes.data?.forEach(l => { likesMap[`cook-${l.target_id}`] = true })
    saveLikesRes.data?.forEach(l => { likesMap[`save-${l.target_id}`] = true })

    cookIds.forEach(id => { likeCountsMap[`cook-${id}`] = allCookLikesRes.data?.filter(l => l.target_id === id).length || 0 })
    saveIds.forEach(id => { likeCountsMap[`save-${id}`] = allSaveLikesRes.data?.filter(l => l.target_id === id).length || 0 })
    cookIds.forEach(id => { commentCountsMap[`cook-${id}`] = allCookCommentsRes.data?.filter(c => c.target_id === id).length || 0 })
    saveIds.forEach(id => { commentCountsMap[`save-${id}`] = allSaveCommentsRes.data?.filter(c => c.target_id === id).length || 0 })

    setFeedLikes(likesMap)
    setFeedLikeCounts(likeCountsMap)
    setFeedCommentCounts(commentCountsMap)
  }

  async function toggleFeedLike(e, item) {
    e.stopPropagation()
    const key = `${item._type}-${item.id}`
    const isLiked = feedLikes[key]
    if (isLiked) {
      await supabase.from('likes').delete().eq('target_type', item._type).eq('target_id', item.id).eq('user_id', session.user.id)
      setFeedLikes(prev => ({ ...prev, [key]: false }))
      setFeedLikeCounts(prev => ({ ...prev, [key]: (prev[key] || 1) - 1 }))
    } else {
      await supabase.from('likes').upsert({ user_id: session.user.id, target_type: item._type, target_id: item.id }, { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true })
      setFeedLikes(prev => ({ ...prev, [key]: true }))
      setFeedLikeCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
      if (item.user_id !== session.user.id) {
        await supabase.from('notifications').insert({
          recipient_id: item.user_id,
          actor_id: session.user.id,
          type: 'like',
          recipe_id: item._type === 'cook' ? item.recipe_id : item.id,
          target_type: item._type,
          target_id: item.id,
        })
      }
    }
  }

  const engagementBar = (item, type) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 16px 12px', borderTop: '1px solid var(--parchment)' }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <button onClick={e => toggleFeedLike(e, item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={feedLikes[`${type}-${item.id}`] ? 'var(--clay)' : 'none'}>
            <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z"
              stroke={feedLikes[`${type}-${item.id}`] ? 'var(--clay)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {feedLikeCounts[`${type}-${item.id}`] > 0 ? (
          <button onClick={e => { e.stopPropagation(); setLikesModal({ targetType: type, targetId: item.id }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: feedLikes[`${type}-${item.id}`] ? 'var(--clay)' : 'var(--muted)' }}>
              {feedLikeCounts[`${type}-${item.id}`]} {feedLikes[`${type}-${item.id}`] ? 'Liked' : 'Like'}
            </span>
          </button>
        ) : (
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Like</span>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); type === 'cook' ? onSelectCook(item, true) : onSelectSave(item, true) }}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
            stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
          {feedCommentCounts[`${type}-${item.id}`] > 0 ? `${feedCommentCounts[`${type}-${item.id}`]} ` : ''}Comment
        </span>
      </button>
    </div>
  )

  const circleBadge = (key) => circleFriendsMap[key] && (
    <div onClick={e => { e.stopPropagation(); setCircleModal(circleFriendsMap[key].canonicalId) }} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '8px 16px', borderTop: '1px solid var(--parchment)', cursor: 'pointer'
    }}>
      <div style={{ display: 'flex' }}>
        {circleFriendsMap[key].avatars.map((p, i) => (
          <div key={p.id} style={{
            width: '18px', height: '18px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: '7px', fontWeight: '700', color: 'var(--cream)',
            marginLeft: i === 0 ? '0' : '-4px', border: '1.5px solid var(--warm-white)', flexShrink: 0
          }}>{(p.full_name || p.username || '?')[0].toUpperCase()}</div>
        ))}
      </div>
      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
        {circleFriendsMap[key].iHaveIt ? (
          <>
            <span style={{ fontWeight: '600', color: 'var(--clay)' }}>You</span>
            {circleFriendsMap[key].count > 0 && (
              <> and <span style={{ fontWeight: '600', color: 'var(--clay)' }}>
                {circleFriendsMap[key].count} {circleFriendsMap[key].count === 1 ? 'friend' : 'friends'}
              </span></>
            )} have this
          </>
        ) : (
          <>
            <span style={{ fontWeight: '600', color: 'var(--clay)' }}>
              {circleFriendsMap[key].count} {circleFriendsMap[key].count === 1 ? 'friend' : 'friends'}
            </span> have this
          </>
        )}
      </span>
    </div>
  )

  // Pull indicator progress (0 to 1)
  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1)

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ maxWidth: '480px', margin: '0 auto', padding: '70px 16px 100px' }}
    >
      <style>{`
        @keyframes shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        .skel { animation: shimmer 1.4s ease-in-out infinite; }
        @keyframes ptr-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── PULL-TO-REFRESH INDICATOR ── */}
      {(pullDistance > 0 || isRefreshing) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: isRefreshing ? '52px' : `${pullDistance}px`,
          marginTop: '-70px', marginBottom: isRefreshing ? '8px' : '0',
          transition: isRefreshing ? 'height 0.2s ease' : 'none',
          overflow: 'hidden',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--parchment)', border: '1px solid var(--tan)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isRefreshing ? 1 : pullProgress,
            transform: `scale(${0.7 + pullProgress * 0.3})`,
            transition: isRefreshing ? 'none' : 'opacity 0.1s, transform 0.1s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            {isRefreshing ? (
              // Spinning loader
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                style={{ animation: 'ptr-spin 0.8s linear infinite' }}>
                <circle cx="12" cy="12" r="9" stroke="var(--tan)" strokeWidth="2.5"/>
                <path d="M12 3a9 9 0 019 9" stroke="var(--clay)" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            ) : (
              // Arrow that rotates as you pull
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                style={{ transform: `rotate(${pullProgress * 180}deg)`, transition: 'transform 0.15s' }}>
                <path d="M12 5v14M12 19l-5-5M12 19l5-5"
                  stroke="var(--clay)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      )}

      {likesModal && (
        <LikesModal targetType={likesModal.targetType} targetId={likesModal.targetId}
          onClose={() => setLikesModal(null)} onSelectUser={onSelectUser} />
      )}
      {circleModal && (
        <CircleFriendsModal canonicalId={circleModal} session={session}
          onClose={() => setCircleModal(null)} onSelectUser={onSelectUser} />
      )}

      {/* Last updated label */}
      {!loading && feed.length > 0 && updatedLabel && (
        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', marginBottom: '16px', marginTop: '-8px' }}>
          {updatedLabel}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : feed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px 0' }}>
          <svg width="100%" viewBox="0 0 680 420" style={{ maxWidth: '360px', margin: '0 auto 8px', display: 'block' }}>
            <rect x="140" y="270" width="400" height="12" rx="6" fill="#D9C9B0" opacity="0.5"/>
            <g transform="rotate(-8, 230, 230)">
              <ellipse cx="230" cy="252" rx="52" ry="14" fill="#C4713A" opacity="0.18"/>
              <path d="M178 238 Q178 268 230 274 Q282 268 282 238" fill="#F0E8D8" stroke="#D9C9B0" strokeWidth="1.5"/>
              <ellipse cx="230" cy="238" rx="52" ry="13" fill="#F8F2EA" stroke="#D9C9B0" strokeWidth="1.5"/>
              <path d="M218 228 Q215 220 218 212" stroke="#D9C9B0" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
              <path d="M230 225 Q227 217 230 209" stroke="#D9C9B0" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
              <path d="M242 228 Q239 220 242 212" stroke="#D9C9B0" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
            </g>
            <g transform="rotate(5, 450, 225)">
              <ellipse cx="450" cy="252" rx="58" ry="15" fill="#C4713A" opacity="0.2"/>
              <path d="M392 236 Q392 268 450 275 Q508 268 508 236" fill="#F0E8D8" stroke="#D9C9B0" strokeWidth="1.5"/>
              <ellipse cx="450" cy="236" rx="58" ry="14" fill="#F8F2EA" stroke="#D9C9B0" strokeWidth="1.5"/>
              <path d="M436 225 Q433 216 436 207" stroke="#D9C9B0" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
              <path d="M450 222 Q447 213 450 204" stroke="#D9C9B0" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.75"/>
              <path d="M464 225 Q461 216 464 207" stroke="#D9C9B0" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
            </g>
            <g opacity="0.35">
              <line x1="160" y1="245" x2="160" y2="272" stroke="#8A8070" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="156" y1="245" x2="156" y2="258" stroke="#8A8070" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="160" y1="245" x2="160" y2="258" stroke="#8A8070" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="164" y1="245" x2="164" y2="258" stroke="#8A8070" strokeWidth="1.2" strokeLinecap="round"/>
            </g>
            <g opacity="0.35">
              <ellipse cx="522" cy="244" rx="7" ry="9" fill="none" stroke="#8A8070" strokeWidth="1.5"/>
              <line x1="522" y1="253" x2="522" y2="272" stroke="#8A8070" strokeWidth="1.5" strokeLinecap="round"/>
            </g>
          </svg>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.2', marginBottom: '8px' }}>
            Your feed fills up<br />as friends join.
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6', marginBottom: '28px' }}>
            Follow a cook to see what they're making.<br />Until then, your Cookbook is waiting.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: suggestions.length > 0 ? '32px' : '0' }}>
            <button onClick={() => onGoToSearch && onGoToSearch()} style={{
              padding: '13px 24px', background: 'var(--clay)', color: 'var(--cream)',
              border: 'none', borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
            }}>Find Cooks</button>
            <button onClick={() => onGoToCookbook && onGoToCookbook()} style={{
              padding: '13px 24px', background: 'none', color: 'var(--muted)',
              border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
            }}>Go to Cookbook</button>
          </div>
          {suggestions.length > 0 && (
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>People You Might Know</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {suggestions.map(person => (
                  <div key={person.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--parchment)', cursor: 'pointer' }}
                    onClick={() => onSelectUser && onSelectUser(person.id)}>
                    {person.avatar_url
                      ? <img src={person.avatar_url} alt="" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                      : <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{(person.full_name || person.username || '?')[0].toUpperCase()}</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.full_name || person.username}</div>
                      {person.username && person.full_name && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>@{person.username}</div>}
                    </div>
                    <button onClick={e => {
                      e.stopPropagation()
                      supabase.from('follows').insert({ follower_id: session.user.id, following_id: person.id, status: 'pending' })
                      supabase.from('notifications').insert({ recipient_id: person.id, actor_id: session.user.id, type: 'follow_request' })
                      setSuggestions(prev => prev.filter(p => p.id !== person.id))
                    }} style={{ padding: '7px 14px', background: 'transparent', border: '1.5px solid var(--clay)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', color: 'var(--clay)', cursor: 'pointer', flexShrink: 0 }}>Follow</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feed.map(item => {
            const profile = item.profiles

            // --- SAVE CARD ---
            if (item._type === 'save') {
              return (
                <div key={`save-${item.id}`} onClick={() => onSelectSave(item)} style={{
                  background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--parchment)', overflow: 'hidden', cursor: 'pointer'
                }}>
                  <div onClick={e => { e.stopPropagation(); onSelectUser && onSelectUser(item.user_id) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{(profile?.full_name || profile?.username || '?')[0].toUpperCase()}</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--ink)' }}>
                          {item.user_id === session.user.id ? 'You' : (profile?.full_name || profile?.username || 'Unknown')}
                        </span>{' '}saved a recipe
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px 14px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                    }}>
                      {item.image_url && (
                        <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                          onError={e => e.target.style.display = 'none'} />
                      )}
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--cream)' }}>
                        {(item.title || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                      {item.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{item.source_name}</div>}
                    </div>
                  </div>
                  {circleBadge(`save-${item.id}`)}
                  {engagementBar(item, 'save')}
                </div>
              )
            }

            // --- COOK CARD ---
            const v = verdictStyles[item.verdict]
            const recipe = item.recipes
            if (!recipe) return null

            return (
              <div key={`cook-${item.id}`} onClick={() => onSelectCook(item)} style={{
                cursor: 'pointer', background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--parchment)', overflow: 'hidden'
              }}>
                <div onClick={e => { e.stopPropagation(); onSelectUser && onSelectUser(item.user_id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', cursor: 'pointer' }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{(profile?.full_name || profile?.username || '?')[0].toUpperCase()}</div>
                  }
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>
                      {item.user_id === session.user.id ? 'You' : (profile?.full_name || profile?.username || 'Unknown')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {new Date(item.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(item.cooked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                {(item.photo_urls?.[0] || recipe.image_url) && (
                  <img src={item.photo_urls?.[0] || recipe.image_url} alt=""
                    style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
                    onError={e => e.target.style.display = 'none'} />
                )}
                <div style={{ padding: '14px 16px' }}>
                  {v && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: v.bg, border: '1px solid ' + v.border,
                      borderRadius: 'var(--radius-pill)', padding: '5px 12px',
                      fontSize: '12px', fontWeight: '600', color: v.color, marginBottom: '8px'
                    }}>{v.label}</div>
                  )}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '4px' }}>{recipe.title}</div>
                  {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>{recipe.source_name}</div>}
                  {item.notes && (
                    <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.55', fontStyle: 'italic' }}>"{item.notes}"</div>
                  )}
                </div>
                {circleBadge(`cook-${item.id}`)}
                {engagementBar(item, 'cook')}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}