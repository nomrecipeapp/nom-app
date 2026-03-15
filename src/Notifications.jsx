import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const typeConfig = {
  follow_request: {
    icon: '👤',
    label: (actor) => `${actor} requested to follow you`,
  },
  follow_approved: {
    icon: '✓',
    label: (actor) => `${actor} approved your follow request`,
  },
  like: {
    icon: '♥',
    label: (actor, recipeName) => `${actor} liked your cook${recipeName ? ` of ${recipeName}` : ''}`,
  },
  comment: {
    icon: '💬',
    label: (actor, recipeName) => `${actor} commented on your cook${recipeName ? ` of ${recipeName}` : ''}`,
  },
  save: {
    icon: '🔖',
    label: (actor, recipeName) => `${actor} saved ${recipeName ? `"${recipeName}"` : 'a recipe'} from your cookbook`,
  },
}

export default function Notifications({ session, onSelectUser, onSelectCook, onClose }) {
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

    // Fetch actor profiles
    const actorIds = [...new Set(data.map(n => n.actor_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', actorIds)

    // Fetch recipe names for relevant notifications
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

    setNotifications(enriched)
    setLoading(false)

    // Mark all as read
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
  } else if ((n.type === 'like' || n.type === 'comment') && n.target_id && n.target_type === 'cook') {
    const { data: cook } = await supabase
      .from('cooks')
      .select('*, recipes(*)')
      .eq('id', n.target_id)
      .single()
    if (cook) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('id', cook.user_id)
        .single()
      onClose()
      setTimeout(() => onSelectCook({ ...cook, profiles: profile }, n.type === 'comment'), 50)
    }
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
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'var(--cream)',
      maxWidth: '480px', margin: '0 auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '56px 20px 16px',
        borderBottom: '1px solid var(--parchment)',
        background: 'var(--cream)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--ink)', letterSpacing: '-0.5px' }}>
          Notifications
        </div>
        <button onClick={onClose} style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'var(--parchment)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 40px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔔</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ink)', marginBottom: '6px' }}>No notifications yet</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>When someone likes, comments, or saves your recipes, you'll see it here.</div>
          </div>
        ) : (
          notifications.map(n => {
            const config = typeConfig[n.type]
            if (!config) return null
            const actorName = n.actorProfile?.full_name || n.actorProfile?.username || 'Someone'
            const label = config.label(actorName, n.recipeName)
            const tappable = ['follow_request', 'follow_approved', 'like', 'comment'].includes(n.type)

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
                {/* Unread dot */}
                <div style={{ paddingTop: '6px', width: '8px', flexShrink: 0 }}>
                  {!n.read && (
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--clay)' }} />
                  )}
                </div>

                {/* Avatar */}
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--cream)'
                }}>
                  {actorName[0].toUpperCase()}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: '1.5', marginBottom: '3px' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{timeAgo(n.created_at)}</div>
                </div>

                {/* Type icon */}
                <div style={{ fontSize: '16px', paddingTop: '2px', flexShrink: 0 }}>{config.icon}</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}