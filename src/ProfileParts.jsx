// Shared pieces of the profile page, so your profile and a friend's look the same.
import { IconChevronRight } from './icons'

const verdictShort = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never' },
}

const verdictLong = {
  would_make_again: { bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42', label: 'Would Make Again' },
  it_was_fine: { bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A', label: 'It Was Fine' },
  never_again: { bg: '#F4E8E8', border: '#C47070', color: '#9B4040', label: 'Never Again' },
}

const sectionLabel = {
  fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px'
}

const listRow = { display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0' }
const divider = <div style={{ height: '1px', background: 'var(--parchment)', margin: '0 20px 20px' }} />

export function RecipeThumbnailSmall({ recipe, dashed }) {
  return (
    <div style={{
      width: '36px', height: '36px',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden', flexShrink: 0,
      border: dashed ? '1.5px dashed var(--tan)' : 'none',
      background: dashed ? 'transparent' : 'linear-gradient(135deg, var(--clay), var(--ember))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative'
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700',
        color: dashed ? 'var(--tan)' : 'var(--cream)'
      }}>{(recipe.title || '?')[0].toUpperCase()}</span>
      {recipe.image_url && (
        <img loading="lazy" decoding="async"
          src={recipe.image_url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
          onError={e => e.target.style.display = 'none'}
        />
      )}
    </div>
  )
}

// Following / Followers under the name
export function FollowCounts({ following, followers, onFollowing, onFollowers }) {
  const btn = { background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }
  const num = { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }
  return (
    <div style={{ display: 'flex', gap: '32px', textAlign: 'center' }}>
      <button className="nom-hit" onClick={onFollowing} style={btn}>
        <div style={num}>{following === null ? '—' : following}</div>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Following</div>
      </button>
      <button className="nom-hit" onClick={onFollowers} style={btn}>
        <div style={num}>{followers === null ? '—' : followers}</div>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Followers</div>
      </button>
    </div>
  )
}

// Saved / Cooked strip
export function StatsStrip({ saved, cooked, onSaved, onCooked }) {
  const btn = { flex: 1, padding: '12px 0', textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer' }
  const num = { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }
  return (
    <div style={{ display: 'flex', borderTop: '1px solid var(--parchment)', borderBottom: '1px solid var(--parchment)', margin: '0 0 20px' }}>
      <button onClick={onSaved} style={{ ...btn, borderRight: '1px solid var(--parchment)' }}>
        <div style={num}>{saved === null ? '—' : saved}</div>
        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Saved</div>
      </button>
      <button onClick={onCooked} style={btn}>
        <div style={num}>{cooked === null ? '—' : cooked}</div>
        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Cooked</div>
      </button>
    </div>
  )
}

// Underlined tabs: Stats / Cookbook / Activity
export function ProfileTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', margin: '0 0 20px', borderBottom: '2px solid var(--parchment)' }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)} style={{
          flex: 1, padding: '12px',
          background: 'none', border: 'none',
          borderBottom: active === tab.id ? '2px solid var(--clay)' : '2px solid transparent',
          marginBottom: '-2px',
          fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
          color: active === tab.id ? 'var(--clay)' : 'var(--muted)',
          cursor: 'pointer', transition: 'all 0.15s'
        }}>{tab.label}</button>
      ))}
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {[1, 2, 3].map(i => (
        <div key={i}>
          <div style={{ height: '12px', width: '80px', background: 'var(--parchment)', borderRadius: '6px', marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            {[1, 2, 3, 4, 5].map(j => (
              <div key={j} style={{ width: '88px', height: '88px', borderRadius: 'var(--radius-md)', background: 'var(--parchment)', flexShrink: 0 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Recently cooked, Go-tos and Want to Make
export function StatsLists({ recentCooks, topRated, wantToMake, onSelectRecent, onSelectGoTo, onSelectWant, onSeeAllWant }) {
  const sections = []
  if (recentCooks.length > 0) sections.push(
    <div key="recent" style={{ marginBottom: '20px' }}>
      <div style={{ padding: '0 20px' }}><div style={sectionLabel}>Recently cooked</div></div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
        {recentCooks.map(cook => {
          const v = verdictShort[cook.verdict]
          const recipe = cook.recipes
          if (!recipe) return null
          return (
            <div key={cook.id} onClick={() => onSelectRecent(cook)} style={{ flexShrink: 0, width: '88px', cursor: 'pointer' }}>
              <div style={{ width: '88px', height: '88px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--clay), var(--ember))', marginBottom: '6px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: 'var(--cream)' }}>{(recipe.title || '?')[0].toUpperCase()}</span>
                {recipe.image_url && (
                  <img loading="lazy" decoding="async" src={recipe.image_url} alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                    onError={e => e.target.style.display = 'none'} />
                )}
                {v && (
                  <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: v.bg, border: '1px solid ' + v.border, borderRadius: '100px', padding: '2px 6px', fontSize: '8px', fontWeight: '700', color: v.color }}>{v.label}</div>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--charcoal)', fontWeight: '500', lineHeight: '1.3', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{recipe.title}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
  if (topRated.length > 0) sections.push(
    <div key="gotos" style={{ padding: '0 20px', marginBottom: '20px' }}>
      <div style={sectionLabel}>Go-tos</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {topRated.map(cook => {
          const recipe = cook.recipes
          if (!recipe) return null
          return (
            <div key={cook.id} onClick={() => onSelectGoTo(cook)} style={{ ...listRow, cursor: 'pointer' }}>
              <RecipeThumbnailSmall recipe={recipe} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{recipe.source_name}</div>}
              </div>
              <div style={{ background: '#EEF4E5', border: '1px solid #7A8C6E', borderRadius: '100px', padding: '3px 9px', fontSize: '11px', fontWeight: '700', color: '#4A5E42', flexShrink: 0, whiteSpace: 'nowrap' }}>Made {cook.times}x</div>
            </div>
          )
        })}
      </div>
    </div>
  )
  if (wantToMake.length > 0) sections.push(
    <div key="want" style={{ padding: '0 20px', marginBottom: '20px' }}>
      <div style={sectionLabel}>Want to Make</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {wantToMake.map(recipe => (
          <div key={recipe.id} onClick={() => onSelectWant(recipe)} style={{ ...listRow, cursor: 'pointer' }}>
            <RecipeThumbnailSmall recipe={recipe} dashed />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
              {recipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{recipe.source_name}</div>}
            </div>
          </div>
        ))}
      </div>
      {onSeeAllWant && (
        <button onClick={onSeeAllWant} style={{
          marginTop: '8px', padding: '8px 0', background: 'none', border: 'none',
          fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', color: 'var(--clay)', cursor: 'pointer'
        }}>See all in Cookbook<IconChevronRight size={12} strokeWidth={2.4} style={{ marginLeft: '3px', marginTop: '-1px' }} /></button>
      )}
    </div>
  )
  // A line between sections, never a stray one at the end
  return sections.flatMap((s, i) => (i === 0 ? [s] : [<div key={`d${i}`}>{divider}</div>, s]))
}

const heartPath = 'M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z'
const bubblePath = 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'

function Engagement({ eng, onComment }) {
  return (
    <div style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderTop: '1px solid var(--parchment)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d={heartPath} stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.likes > 0 ? `${eng.likes} ${eng.likes === 1 ? 'Like' : 'Likes'}` : 'Like'}</span>
      </div>
      <button className="nom-hit" aria-label={eng.comments > 0 ? `${eng.comments} comments, open comments` : 'Add a comment'}
        onClick={e => { e.stopPropagation(); onComment && onComment() }}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d={bubblePath} stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>{eng.comments > 0 ? `${eng.comments} ` : ''}Comment</span>
      </button>
    </div>
  )
}

// Cooks and saves, newest first. onOpenComments(item) opens that cook or save straight to its comments.
export function ActivityList({ items, engagement, onSelectCook, onSelectSave, onOpenComments }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.map(item => {
        if (item._type === 'save') {
          const eng = engagement[`save-${item.id}`] || { likes: 0, comments: 0 }
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
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--cream)' }}>{(item.title || '?')[0].toUpperCase()}</span>
                  {item.image_url && (
                    <img loading="lazy" decoding="async" src={item.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Saved a recipe</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '500', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  {item.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{item.source_name}</div>}
                </div>
                <div style={{ background: 'var(--parchment)', border: '1.5px dashed var(--tan)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--muted)', flexShrink: 0 }}>Want to Make</div>
              </div>
              <Engagement eng={eng} onComment={() => onOpenComments && onOpenComments(item)} />
            </div>
          )
        }

        const recipe = item.recipes
        if (!recipe) return null
        const eng = engagement[`cook-${item.id}`] || { likes: 0, comments: 0 }
        const v = verdictLong[item.verdict]
        return (
          <div key={`cook-${item.id}`} onClick={() => onSelectCook && onSelectCook(item)} style={{
            background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--parchment)', overflow: 'hidden', cursor: 'pointer'
          }}>
            {(item.photo_urls?.[0] || recipe.image_url) && (
              <img loading="lazy" decoding="async" src={item.photo_urls?.[0] || recipe.image_url} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
            )}
            <div style={{ padding: '14px 16px' }}>
              {v && (
                <div style={{ display: 'inline-flex', alignItems: 'center', background: v.bg, border: '1px solid ' + v.border, borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '11px', fontWeight: '600', color: v.color, marginBottom: '6px' }}>{v.label}</div>
              )}
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '500', color: 'var(--ink)', marginBottom: '4px' }}>{recipe.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date(item.cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              {item.notes && <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.55', fontStyle: 'italic', marginTop: '8px' }}>"{item.notes}"</div>}
            </div>
            <Engagement eng={eng} onComment={() => onOpenComments && onOpenComments(item)} />
          </div>
        )
      })}
    </div>
  )
}
