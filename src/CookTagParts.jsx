import { useEffect, useState } from 'react'
import { IconCheck, IconUsers } from './icons'
import { tap } from './haptics'
import { loadTaggable, displayName, firstNameOf, cookedWithText } from './cookTags'

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

// "Cooked with" section on Log a Cook and Edit Cook.
// A row of people you follow; tap to tag. Search shows up once you follow more than 8 people.
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
  function toggle(id) {
    tap()
    onChange(selected.has(id) ? value.filter(v => v !== id) : [...value, id])
  }

  const q = query.trim().toLowerCase().replace(/^@/, '')
  const list = (people || [])
    .filter(p => !q || (p.full_name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q))
    // Tagged people first, so they stay in view
    .sort((a, b) => (selected.has(b.id) ? 1 : 0) - (selected.has(a.id) ? 1 : 0))

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Cooked with</div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px' }}>
        {value.length > 0 && people
          ? `Tagging ${cookedWithText(people.filter(p => selected.has(p.id)))}. They'll get a note to Log It Too.`
          : 'Tag friends who cooked with you. They\'ll get a note to Log It Too.'}
      </div>

      {people === null ? (
        <div style={{ height: '70px' }} />
      ) : people.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '12px 14px', background: 'var(--cream)', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-md)' }}>
          Follow friends to tag them in your cooks.
        </div>
      ) : (
        <>
          {people.length > 8 && (
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search people you follow"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ width: '100%', padding: '10px 14px', marginBottom: '10px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
            />
          )}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', margin: '0 -4px', padding: '2px 4px 4px' }}>
            {list.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '8px 0' }}>No one matches "{query.trim()}"</div>
            )}
            {list.map(p => {
              const on = selected.has(p.id)
              return (
                <button key={p.id} type="button" onClick={() => toggle(p.id)}
                  aria-pressed={on} aria-label={`${on ? 'Untag' : 'Tag'} ${displayName(p)}`}
                  style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', width: '64px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <div style={{ position: 'relative', borderRadius: '50%', boxShadow: on ? '0 0 0 2px var(--cream), 0 0 0 4px var(--clay)' : 'none', transition: 'box-shadow 0.15s' }}>
                    <Avatar p={p} />
                    {on && (
                      <div style={{ position: 'absolute', right: '-3px', bottom: '-3px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--clay)', color: 'var(--cream)', border: '2px solid var(--warm-white)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconCheck size={10} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: on ? '700' : '500', color: on ? 'var(--clay)' : 'var(--charcoal)', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstNameOf(p)}</span>
                </button>
              )
            })}
          </div>
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
