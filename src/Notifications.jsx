import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { IconAt, IconBell, IconBookmark, IconCheck, IconComment, IconHeart, IconUserCheck, IconUserPlus } from './icons'

const typeConfig = {
  follow_request: {
    icon: <IconUserPlus size={18} />,
    label: (actor) => `${actor} requested to follow you`,
  },
  follow_approved: {
    icon: <IconUserCheck size={18} />,
    label: (actor) => `${actor} approved your follow request`,
  },
  like: {
    icon: <IconHeart size={18} />,
    label: (actor, recipeName) => `${actor} liked your cook${recipeName ? ` of ${recipeName}` : ''}`,
  },
  comment: {
    icon: <IconComment size={18} />,
    label: (actor, recipeName) => `${actor} commented on your cook${recipeName ? ` of ${recipeName}` : ''}`,
  },
  save: {
    icon: <IconBookmark size={18} />,
    label: (actor, recipeName) => `${actor} saved ${recipeName ? `"${recipeName}"` : 'a recipe'} from your cookbook`,
  },
  mention: {
    icon: <IconAt size={18} />,
    label: (actor, recipeName) => `${actor} mentioned you in a comment${recipeName ? ` on ${recipeName}` : ''}`,
  },
}

export default function Notifications({ session, onSelectUser, onSelectCook, onSelectSaveCard, onClose }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    setLoading(true)

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data || data.length === 0) {
      setNotifications([])
      setLoading(false)
      return
    }

    const actorIds = [...new Set(data.map(n => n.actor_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', actorIds)

    const recipeIds = data.filter(n => n.recipe_id).map(n => n.recipe_id)
    let recipeMap = {}
    if (recipeIds.length > 0) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, title')
        .in('id', recipeIds)
      recipes?.forEach(r => { recipeMap[r.id] = r.title })
    }

    const enriched = data.map(n => ({
      ...n,
      actorProfile: profiles?.find(p => p.id === n.actor_id) || null,
      recipeName: n.recipe_id ? recipeMap[n.recipe_id] || null : null,
    }))

       const sorted = [
      ...enriched.filter(n => n.type === 'follow_request'),
      ...enriched.filter(n => n.type !== 'follow_request'),
    ]
    setNotifications(sorted)
    setLoading(false)

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', session.user.id)
      .eq('read', false)
  }

  async function handleTap(n) {
    if (n.type === 'follow_request' || n.type === 'follow_approved') {
      onClose()
      setTimeout(() => onSelectUser(n.actor_id), 50)
    } else if ((n.type === 'like' || n.type === 'comment' || n.type === 'mention') && n.target_id && n.target_type === 'cook') {
      const { data: cook } = await supabase
        .from('cooks')
        .select('*, recipes(*)')
        .eq('id', n.target_id)
        .single()
      if (cook) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', cook.user_id)
          .single()
        onClose()
        setTimeout(() => onSelectCook({ ...cook, profiles: profile }, n.type === 'comment'), 50)
      }
    } else if ((n.type === 'like' || n.type === 'comment' || n.type === 'save' || n.type === 'mention') && n.target_type === 'save') {
      const { data: recipe } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', n.target_id)
        .single()
      if (recipe) {
        onClose()
        setTimeout(() => onSelectSaveCard(recipe, n.type === 'comment'), 50)
      }
    } else if (n.type === 'save') {
      onClose()
    }
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      paddingBottom: '100px',
    }}>
      {/* Spacer for top bar */}
      <div style={{ height: '54px' }} />

      <div style={{ padding: '8px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--parchment)', color: 'var(--clay)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><IconBell size={26} strokeWidth={1.8} /></div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '6px' }}>No notifications yet</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>When someone likes, comments, or saves your recipes, you'll see it here.</div>
          </div>
        ) : (
          notifications.map(n => {
            const config = typeConfig[n.type]
            if (!config) return null
            const actorName = n.actorProfile?.full_name || n.actorProfile?.username || 'Someone'
            const label = config.label(actorName, n.recipeName)
            const tappable = ['follow_request', 'follow_approved', 'like', 'comment', 'save', 'mention'].includes(n.type)
            return (
              <div
                key={n.id}
                onClick={() => tappable && handleTap(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  padding: '14px 20px',
                  background: n.read ? 'transparent' : 'var(--warm-white)',
                  borderBottom: '1px solid var(--parchment)',
                  cursor: tappable ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ paddingTop: '6px', width: '8px', flexShrink: 0 }}>
                  {!n.read && (
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--clay)' }} />
                  )}
                </div>

                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)'
                }}>
                  {n.actorProfile?.avatar_url
                    ? <img src={n.actorProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    : actorName[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: '1.5', marginBottom: '3px' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{timeAgo(n.created_at)}</div>
                  {n.type === 'follow_request' && !n._approved && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={async e => {
                        e.stopPropagation()
                        await supabase.from('follows').update({ status: 'approved' }).eq('follower_id', n.actor_id).eq('following_id', session.user.id)
                        await supabase.from('notifications').insert({ recipient_id: n.actor_id, actor_id: session.user.id, type: 'follow_approved' })
                        await supabase.from('notifications').delete().eq('id', n.id)
                        const { data: existingFollow } = await supabase
                          .from('follows')
                          .select('status')
                          .eq('follower_id', session.user.id)
                          .eq('following_id', n.actor_id)
                          .maybeSingle()
                        setNotifications(prev => prev.map(x => x.id !== n.id ? x : {
                          ...x,
                          _approved: true,
                          _followsBack: existingFollow ? existingFollow.status : false,
                        }))
                      }} style={{
                        padding: '6px 14px', background: 'var(--clay)', color: 'var(--cream)',
                        border: 'none', borderRadius: 'var(--radius-pill)',
                        fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                      }}>Approve</button>
                      <button onClick={async e => {
                        e.stopPropagation()
                        await supabase.from('follows').delete().eq('follower_id', n.actor_id).eq('following_id', session.user.id)
                        await supabase.from('notifications').delete().eq('id', n.id)
                        setNotifications(prev => prev.filter(x => x.id !== n.id))
                      }} style={{
                        padding: '6px 14px', background: 'transparent', color: 'var(--muted)',
                        border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-pill)',
                        fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                      }}>Deny</button>
                    </div>
                  )}
                  {n.type === 'follow_request' && n._approved && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: n._followsBack ? '0' : '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <IconCheck size={13} strokeWidth={2.5} />You approved their request
                      </div>
                      {!n._followsBack && (
                        <button onClick={async e => {
                          e.stopPropagation()
                          await supabase.from('follows').insert({
                            follower_id: session.user.id,
                            following_id: n.actor_id,
                            status: 'pending'
                          })
                          await supabase.from('notifications').insert({
                            recipient_id: n.actor_id,
                            actor_id: session.user.id,
                            type: 'follow_request',
                          })
                          setNotifications(prev => prev.map(x => x.id !== n.id ? x : {
                            ...x,
                            _followsBack: 'pending',
                          }))
                        }} style={{
                          padding: '6px 14px', background: 'transparent', color: 'var(--clay)',
                          border: '2px solid var(--clay)', borderRadius: 'var(--radius-pill)',
                          fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                        }}>Request to Follow Back</button>
                      )}
                      {n._followsBack === 'pending' && (
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Requested</div>
                      )}
                      {n._followsBack === 'approved' && (
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>You follow each other</div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: '2px', flexShrink: 0, color: 'var(--clay)', display: 'flex' }}>{config.icon}</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}