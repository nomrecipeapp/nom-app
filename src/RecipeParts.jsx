// Shared pieces of the recipe page, so your recipe, a friend's saved recipe and a
// friend's cook all look and read the same way.
import { forwardRef } from 'react'
import { linkProps } from './openLink'
import { ordinal } from './cookStats'
import { IconChevronRight } from './icons'
import { IngredientList, InstructionList, CopyIngredientsButton, RecipeTimes } from './RecipeContent'
import { verdictOptions, verdictStyles, SLIDERS, sectionLabelStyle, roundIconBtn, cardStyle, shortDate } from './recipeStyle'

const YOUR_VERDICT = {
  would_make_again: { text: "You'd make it again", icon: 'M5 12.5l4.5 4.5L19 7.5' },
  it_was_fine: { text: 'You thought it was fine', icon: 'M6 12h12' },
  never_again: { text: "You'd never make it again", icon: 'M7 7l10 10M17 7L7 17' },
}

const VERDICT_PHRASE = { would_make_again: 'would make it again', it_was_fine: 'thought it was fine', never_again: 'would never make it again' }

// "2 friends made it. Both would make it again." / "1 friend made it. Thought it was fine."
function friendsHeadline(circleCooks, others) {
  const n = circleCooks.length
  const verdicts = new Set(circleCooks.map(c => c.verdict))
  const lead = others ? `${n} other ${n === 1 ? 'friend' : 'friends'} made it too.` : `${n} ${n === 1 ? 'friend' : 'friends'} made it.`
  if (verdicts.size === 1) {
    const phrase = VERDICT_PHRASE[circleCooks[0].verdict]
    if (!phrase) return [lead, '']
    const who = n === 1 ? '' : n === 2 ? 'Both ' : `All ${n} `
    return [lead, who ? `${who}${phrase}.` : phrase[0].toUpperCase() + phrase.slice(1) + '.']
  }
  const again = circleCooks.filter(c => c.verdict === 'would_make_again').length
  return [lead, again > 0 ? `${again} would make it again.` : '']
}

export function Avatars({ people }) {
  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      {people.slice(0, 3).map((p, i) => {
        const name = p?.full_name || p?.username || '?'
        return (
          <div key={p?.id || i} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid var(--warm-white)', marginLeft: i ? '-10px' : 0, overflow: 'hidden', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)' }}>
            {p?.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name[0].toUpperCase()}
          </div>
        )
      })}
    </div>
  )
}

// One card under the title: your verdict and what friends thought. Hidden when there's nothing to say.
// others: on a friend's cook or saved recipe, circleCooks leaves that friend out, so say "other friends"
export function TakeSummary({ cooks, circleCooks, friendsWithIt, avatars, onYourTake, onCircle, others = false }) {
  const latest = cooks[0]
  const n = circleCooks.length
  if (!latest && n === 0 && !friendsWithIt) return null
  const yv = latest && YOUR_VERDICT[latest.verdict]
  const vs = latest && verdictOptions.find(o => o.value === latest.verdict)
  const row = { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', color: 'inherit' }
  const sub = { fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }
  const chevron = <IconChevronRight size={16} strokeWidth={2.4} style={{ color: 'var(--clay)', flexShrink: 0 }} />
  const savedOnly = Math.max(0, (friendsWithIt || 0) - n)
  const [lead, rest] = n > 0 ? friendsHeadline(circleCooks, others) : ['', '']
  return (
    <div style={{ background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px' }}>
      {latest && (
        <button onClick={onYourTake} style={row}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: vs?.bg || 'var(--parchment)', border: `1px solid ${vs?.border || 'var(--tan)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vs?.color || 'var(--charcoal)'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={yv?.icon || 'M5 12.5l4.5 4.5L19 7.5'} /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: vs?.color || 'var(--ink)' }}>{yv?.text || 'You made this'}</div>
            <div style={sub}>{cooks.length === 1 ? `Made once · ${shortDate(latest.cooked_at)}` : `Made ${cooks.length} times · last ${shortDate(latest.cooked_at)}`}</div>
          </div>
          {chevron}
        </button>
      )}
      {latest && (n > 0 || friendsWithIt > 0) && <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 16px' }} />}
      {(n > 0 || friendsWithIt > 0) && (
        <button onClick={onCircle} style={row}>
          <Avatars people={n > 0 ? circleCooks.map(c => c.profiles) : avatars} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {n > 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--ink)' }}><strong style={{ fontWeight: '700' }}>{lead}</strong>{rest ? ` ${rest}` : ''}</div>
            ) : (
              <div style={{ fontSize: '14px', color: 'var(--ink)' }}><strong style={{ fontWeight: '700' }}>{friendsWithIt} {friendsWithIt === 1 ? 'friend has' : 'friends have'} this.</strong></div>
            )}
            <div style={sub}>{n > 0 ? (savedOnly > 0 ? `${savedOnly} more saved it` : 'See what they thought') : 'Nobody has cooked it yet'}</div>
          </div>
          {chevron}
        </button>
      )}
    </div>
  )
}

// A cook's verdict, sliders and notes in one card. Used for "Your take" and a friend's cook.
export const TakeCard = forwardRef(function TakeCard({ label, sub, cook, footer, cookedWith }, ref) {
  const v = verdictOptions.find(o => o.value === cook.verdict)
  const filled = SLIDERS.filter(s => cook[s.key])
  return (
    <div ref={ref} style={{ ...cardStyle, scrollMarginTop: 'calc(var(--top-bar-h) + 12px)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: filled.length || cook.notes ? '16px' : (footer ? '12px' : '0') }}>
        <div style={{ minWidth: 0 }}>
          <div style={sectionLabelStyle}>{label}</div>
          {sub && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{sub}</div>}
          {cookedWith && <div style={{ marginTop: '6px' }}>{cookedWith}</div>}
        </div>
        {v && <div style={{ background: v.bg, border: '1px solid ' + v.border, borderRadius: '100px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', color: v.color, whiteSpace: 'nowrap' }}>{v.label}</div>}
      </div>
      {filled.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: cook.notes ? '14px' : '4px' }}>
          {filled.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--charcoal)', width: '120px', flexShrink: 0 }}>{s.label}</span>
              <div aria-hidden="true" style={{ flex: 1, height: '6px', borderRadius: '100px', background: 'var(--parchment)', overflow: 'hidden' }}>
                <div style={{ width: `${cook[s.key] * 20}%`, height: '100%', background: 'var(--clay)', borderRadius: '100px' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: 'var(--clay)', width: '28px', textAlign: 'right', flexShrink: 0 }}>{cook[s.key]}/5</span>
            </div>
          ))}
        </div>
      )}
      {cook.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: '1.5' }}>"{cook.notes}"</div>}
      {footer}
    </div>
  )
})

// "1 friend made this and would make it again."
// "4 friends made this. 3 would make it again, 1 thought it was fine."
// "3 friends made this. All 3 would make it again."
export function CircleTally({ circleCooks, others = false }) {
  const n = circleCooks.length
  const who = others ? `${n} other ${n === 1 ? 'friend' : 'friends'} made it too` : `${n} ${n === 1 ? 'friend' : 'friends'} made this`
  const count = k => circleCooks.filter(c => c.verdict === k).length
  const again = count('would_make_again'), fine = count('it_was_fine'), never = count('never_again')
  const parts = [
    again && `${again} ${VERDICT_PHRASE.would_make_again}`,
    fine && `${fine} ${VERDICT_PHRASE.it_was_fine}`,
    never && `${never} ${VERDICT_PHRASE.never_again}`,
  ].filter(Boolean)
  const only = [again, fine, never].filter(Boolean).length === 1
  const sentence = n === 1
    ? <><strong style={{ color: 'var(--ink)' }}>{who}</strong>{VERDICT_PHRASE[circleCooks[0].verdict] ? ` and ${VERDICT_PHRASE[circleCooks[0].verdict]}.` : '.'}</>
    : <><strong style={{ color: 'var(--ink)' }}>{who}.</strong> {only && parts.length ? `${n === 2 ? 'Both' : `All ${n}`} ${VERDICT_PHRASE[[['would_make_again', again], ['it_was_fine', fine], ['never_again', never]].find(([, c]) => c)[0]]}.` : parts.length ? parts.join(', ') + '.' : ''}</>
  const seg = (k, color) => count(k) > 0 && <div style={{ flex: count(k), background: color }} />
  return (
    <div style={{ background: 'var(--parchment)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.45', marginBottom: '8px' }}>
        {sentence}
      </div>
      <div role="img" aria-label={parts.join(', ')} style={{ display: 'flex', gap: '3px', height: '8px', borderRadius: '100px', overflow: 'hidden' }}>
        {seg('would_make_again', '#7A8C6E')}{seg('it_was_fine', '#E8A87C')}{seg('never_again', '#C47070')}
      </div>
    </div>
  )
}

// A friend's sliders as small chips: "Flavor 5 · Effort 4 ..."
export function SliderChips({ cook, style }) {
  const filled = SLIDERS.filter(s => cook[s.key])
  if (filled.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', ...style }}>
      {filled.map(s => (
        <span key={s.key} style={{ padding: '3px 8px', borderRadius: '100px', background: 'var(--parchment)', fontSize: '11px', color: 'var(--charcoal)' }}>{s.short} <strong style={{ color: 'var(--clay)' }}>{cook[s.key]}</strong></span>
      ))}
    </div>
  )
}

// "From your circle": up to 3 friends' latest cooks, with a tally on top.
export const CircleCooksCard = forwardRef(function CircleCooksCard({ circleCooks, friendsCount = 0, onSeeAll, onSelectUser, others = false }, ref) {
  if (circleCooks.length === 0) return null
  const shown = circleCooks.slice(0, 3)
  const total = Math.max(friendsCount, circleCooks.length)
  return (
    <div ref={ref} style={{ ...cardStyle, scrollMarginTop: 'calc(var(--top-bar-h) + 12px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={sectionLabelStyle}>From your circle</div>
        {(circleCooks.length > 3 || friendsCount > circleCooks.length) && <button className="nom-hit" onClick={onSeeAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--clay)', padding: 0 }}>See all {total}<IconChevronRight size={12} strokeWidth={2.4} style={{ marginLeft: '3px', marginTop: '-1px' }} /></button>}
      </div>
      <CircleTally circleCooks={circleCooks} others={others} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {shown.map((c, i) => {
          const v = verdictStyles[c.verdict]
          const name = c.profiles?.full_name || c.profiles?.username || 'Someone'
          const last = i === shown.length - 1
          return (
            <div key={c.id} style={{ paddingBottom: last ? '0' : '14px', borderBottom: last ? 'none' : '1px solid var(--parchment)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>{name[0].toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <span onClick={() => onSelectUser && onSelectUser(c.user_id)} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--tan)' }}>{name}</span>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{shortDate(c.cooked_at)}{c._times >= 2 ? ` · ${ordinal(c._times)} time` : ''}</div>
                  </div>
                </div>
                {v && <div style={{ background: v.bg, border: '1px solid ' + v.border, borderRadius: '100px', padding: '2px 8px', fontSize: '10px', fontWeight: '700', color: v.color }}>{v.label}</div>}
              </div>
              {c.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic', lineHeight: '1.5', paddingLeft: '36px' }}>"{c.notes}"</div>}
              <SliderChips cook={c} style={{ paddingLeft: '36px', marginTop: '6px' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
})

// Title plus one info line: source (opens the original), times, difficulty, tags.
// Round buttons (share, edit, more) go in children.
export function RecipeHeader({ recipe, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.15', letterSpacing: '-0.5px', marginBottom: '12px' }}>{recipe.title}</div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '4px 6px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px', color: 'var(--muted)' }}>
          {recipe.source_url ? (
            <a {...linkProps(recipe.source_url)} style={{ color: 'var(--clay)', fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {recipe.source_name || 'Original recipe'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </a>
          ) : recipe.source_name ? <span>{recipe.source_name}</span> : null}
          <RecipeTimes prep={recipe.prep_time} total={recipe.cook_time} />
          {recipe.difficulty && <span>· {recipe.difficulty}</span>}
          {(recipe.tags || []).map(tag => <span key={tag}>· {tag}</span>)}
        </div>
        {children}
      </div>
    </div>
  )
}

// Ingredients and Instructions cards, always open.
export function RecipeBody({ recipe }) {
  return (
    <>
      {recipe.ingredients && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={sectionLabelStyle}>Ingredients</div>
            <CopyIngredientsButton text={recipe.ingredients} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <IngredientList text={recipe.ingredients} />
          </div>
        </div>
      )}
      {recipe.instructions && (
        <div style={cardStyle}>
          <div style={{ ...sectionLabelStyle, marginBottom: '14px' }}>Instructions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <InstructionList text={recipe.instructions} />
          </div>
        </div>
      )}
    </>
  )
}

// Share and "more" buttons in the round style used on your recipe page
export function ShareButton({ onClick }) {
  return (
    <button aria-label="Share" onClick={onClick} style={roundIconBtn}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="var(--charcoal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

export function MoreButton({ onClick }) {
  return (
    <button aria-label="More options" onClick={onClick} style={roundIconBtn}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--charcoal)" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
    </button>
  )
}

// Big recipe photo when there are no cook photos to swipe through
export function RecipeHero({ url, children }) {
  if (!url) return <div style={{ height: 'var(--top-bar-h)' }} />
  return (
    <div style={{ height: '220px', background: 'var(--parchment)', position: 'relative', overflow: 'hidden', marginTop: 'var(--top-bar-h)' }}>
      <img loading="lazy" decoding="async" src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none' }} />
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-pill)', padding: '3px 8px' }}>
        <span style={{ fontSize: '10px', fontWeight: '600', color: 'white' }}>Recipe photo</span>
      </div>
      {children}
    </div>
  )
}

// "Saved by" / "Cooked by" row under the title on a friend's recipe
export function PersonRow({ label, profile, onClick }) {
  if (!profile) return null
  const name = profile.full_name || profile.username || 'Unknown'
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '700', color: 'var(--cream)', flexShrink: 0 }}>
        {profile.avatar_url ? <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name[0].toUpperCase()}
      </div>
      <div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '1px' }}>{label}</div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{name}<IconChevronRight size={12} strokeWidth={2.4} style={{ marginLeft: '3px', marginTop: '-1px' }} /></div>
      </div>
    </button>
  )
}
