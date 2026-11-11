import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { IconX } from './icons'
import { toast } from './ui'
import { fetchSuggestions, cachedSuggestions, dismissSuggestion, removeFromSuggestions, mutualLine } from './suggestions'

// Sideways row of people your friends follow. Shows the saved list instantly, then refreshes.
export default function PeopleYouMightKnow({ session, onSelectUser, headerPadding = '0 20px', marginBottom = 0, onCountChange }) {
  const userId = session.user.id
  const [people, setPeople] = useState(() => cachedSuggestions(userId) || [])

  useEffect(() => {
    let alive = true
    fetchSuggestions(userId).then(list => { if (alive) setPeople(list) }).catch(() => { /* keep what's showing */ })
    return () => { alive = false }
  }, [userId])

  useEffect(() => { onCountChange && onCountChange(people.length) }, [people.length, onCountChange])

  async function follow(person) {
    setPeople(prev => prev.filter(p => p.id !== person.id))
    removeFromSuggestions(userId, person.id)
    const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: person.id, status: 'pending' })
    if (error) {
      toast("Couldn't send that request. Try again?", { icon: null })
      setPeople(prev => [person, ...prev])
      return
    }
    supabase.from('notifications').insert({ recipient_id: person.id, actor_id: userId, type: 'follow_request' })
    toast(`Request sent to ${(person.full_name || person.username || 'them').split(' ')[0]}`)
  }

  function hide(person) {
    dismissSuggestion(userId, person.id)
    setPeople(prev => prev.filter(p => p.id !== person.id))
  }

  if (people.length === 0) return null

  return (
    <div style={{ textAlign: 'left', marginBottom }}>
      <div style={{ padding: headerPadding, fontSize: '13px', fontWeight: '600', color: 'var(--muted)', marginBottom: '10px' }}>People you might know</div>
      <div className="nom-hscroll" style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
        {people.map(person => {
          const line = mutualLine(person)
          return (
            <div key={person.id} onClick={() => onSelectUser(person.id)} style={{
              position: 'relative', flexShrink: 0, width: '112px', padding: '14px 8px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-md)', cursor: 'pointer'
            }}>
              <button onClick={e => { e.stopPropagation(); hide(person) }} aria-label={`Hide ${person.full_name || person.username}`} style={{
                position: 'absolute', top: 0, right: 0, width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0
              }}><IconX size={12} strokeWidth={2.2} /></button>
              {person.avatar_url
                ? <img src={person.avatar_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                : <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--cream)' }}>{(person.full_name || person.username || '?')[0].toUpperCase()}</div>
              }
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{person.full_name || person.username}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', lineHeight: '1.3', minHeight: '29px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{line}</div>
              <button onClick={e => { e.stopPropagation(); follow(person) }} style={{
                minHeight: '32px', padding: '0 16px', background: 'var(--clay)', border: 'none', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', color: 'var(--cream)', cursor: 'pointer'
              }}>Request</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
