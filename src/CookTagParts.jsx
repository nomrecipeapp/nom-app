import { useEffect, useState } from 'react'
import { IconUsers, IconX } from './icons'
import { tap } from './haptics'
import { loadTaggable, displayName, firstNameOf } from './cookTags'

function Avatar({ p, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--clay), var(--ember))',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {p?.avatar_url
        ? <img loading="lazy" decoding="async" src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
        : <span style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.38, fontWeight: '700', color: 'var(--cream)' }}>{displayName(p).replace('@', '')[0]?.toUpperCase() || '?'}</span>}
    </div>
  )
}

// "Cooked with" section on Log a Cook and Edit Cook. Works like @ in comments:
// type a name or @username, pick from the list (full name + @username, so two Joshes are easy to tell apart).
//   <TagPicker myId={session.user.id} value={tagIds} onChange={setTagIds} alsoIds={[friendId]} />
export function TagPicker({ myId, value = [], onChange, alsoIds = [] }) {
  const [people, setPeople] = useState(null)
  const [query, setQuery] = useState('')
  const alsoKey = alsoIds.join(',')

  useEffect(() => {
    let alive = true
    loadTaggable(myId, alsoKey ? alsoKey.split(',') : []).then(list => { if (alive) setPeople(list) })
    return () => { alive = false }
  }, [myId, alsoKey])

  const selected = new Set(value)
  const byId = Object.fromEntries((people || []).map(p => [p.id, p]))
  const tagged = value.map(id => byId[id]).filter(Boolean)

  function add(p) { tap(); onChange([...value, p.id]); setQuery('') }
  function remove(id) { tap(); onChange(value.filter(v => v !== id)) }

  const q = query.trim().toLowerCase().replace(/^@/, '')
  const matches = !q ? [] : (people || [])
    .filter(p => !selected.has(p.id))
    .filter(p => (p.full_name || '').toLowerCase().split(/\s+/).some(w => w.startsWith(q))
      || (p.full_name || '').toLowerCase().startsWith(q)
      || (p.username || '').toLowerCase().startsWith(q))
    .slice(0, 5)

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Cooked with</div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>Tag friends who cooked with you. They'll get a note to Log It Too.</div>

      {tagged.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {tagged.map(p => (
            <div key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 2px 3px 3px', background: 'var(--parchment)', border: '1px solid var(--tan)', borderRadius: 'var(--radius-pill)', maxWidth: '100%' }}>
              <Avatar p={p} size={24} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName(p)}{p.full_name && p.username ? <span style={{ fontWeight: '500', color: 'var(--muted)' }}> @{p.username}</span> : null}
              </span>
              <button type="button" className="nom-hit" onClick={() => remove(p.id)} aria-label={`Untag ${displayName(p)}`}
                style={{ background: 'none', border: 'none', padding: '4px 8px 4px 2px', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
                <IconX size={12} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}

      {people !== null && people.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '12px 14px', background: 'var(--cream)', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-md)' }}>
          Follow friends to tag them in your cooks.
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tagged.length > 0 ? 'Tag someone else' : 'Type a name or @username'}
            aria-label="Tag who you cooked with"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
          />
          {q && (
            <div style={{ marginTop: '6px', background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              {matches.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '12px 14px' }}>No one you follow matches "{query.trim()}"</div>
              ) : matches.map((p, i) => (
                <button key={p.id} type="button" onClick={() => add(p)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '48px',
                  padding: '8px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                  borderBottom: i < matches.length - 1 ? '1px solid var(--parchment)' : 'none', fontFamily: 'var(--font-body)'
                }}>
                  <Avatar p={p} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name || `@${p.username}`}</div>
                    {p.full_name && p.username && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{p.username}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// "Cooked with Maya and Josh" under a cook. Names open their profile when onSelectUser is given.
export function CookedWith({ people, meId, onSelectUser, style }) {
  if (!people || people.length === 0) return null
  const shown = people.length > 3 ? people.slice(0, 2) : people
  const others = people.length - shown.length
  const nameStyle = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: '700', color: 'var(--charcoal)', cursor: onSelectUser ? 'pointer' : 'default' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', lineHeight: '1.4', ...style }}>
      <IconUsers size={14} strokeWidth={2} style={{ color: 'var(--muted)' }} />
      <span>
        Cooked with{' '}
        {shown.map((p, i) => (
          <span key={p.id}>
            {i > 0 && (i === shown.length - 1 && others === 0 ? ' and ' : ', ')}
            {onSelectUser
              ? <button type="button" onClick={e => { e.stopPropagation(); onSelectUser(p.id) }} style={nameStyle}>{p.id === meId ? 'you' : firstNameOf(p)}</button>
              : <span style={nameStyle}>{p.id === meId ? 'you' : firstNameOf(p)}</span>}
          </span>
        ))}
        {others > 0 && <> and {others} others</>}
      </span>
    </div>
  )
}
