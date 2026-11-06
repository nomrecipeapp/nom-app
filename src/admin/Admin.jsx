// Nom Admin: waitlist + invites, users, costs, budget, friend-invite controls.
// All data comes from admin_* functions in Supabase (supabase/sql/2026-11-06-admin-page.sql),
// which refuse anyone who isn't on the admins list. Nothing here is visible in the app.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'

const TZ = 'America/Chicago'

// ── Formatting ──
const money = (n, digits = 2) => `$${Number(n || 0).toFixed(digits)}`
const smallMoney = (n) => {
  const v = Number(n || 0)
  if (v === 0) return '$0'
  return v < 0.1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`
}
const shortDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ }) : ''
function ago(d) {
  if (!d) return 'never'
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return shortDate(d)
}
const isToday = (d) => d && shortDate(d) === shortDate(new Date())

// ── Small building blocks (design system tokens only, no hover states) ──
const card = {
  background: 'var(--warm-white)', border: '1px solid var(--parchment)',
  borderRadius: 'var(--radius-md)', padding: '18px 20px',
}
const label = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }
const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)',
  border: '1.5px solid var(--tan)', background: 'var(--cream)', color: 'var(--ink)',
  fontFamily: 'var(--font-body)', fontSize: '15px', outline: 'none',
}

function Button({ children, onClick, disabled, kind = 'primary', small, style, ...rest }) {
  const base = {
    border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    padding: small ? '7px 14px' : '12px 22px', fontSize: small ? '12px' : '14px',
  }
  const kinds = {
    primary: { background: disabled ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)' },
    secondary: { background: 'transparent', color: 'var(--clay)', border: '1.5px solid var(--clay)', padding: small ? '5.5px 12.5px' : '10.5px 20.5px' },
    quiet: { background: 'var(--parchment)', color: 'var(--charcoal)' },
  }
  return <button {...rest} onClick={onClick} disabled={disabled} style={{ ...base, ...kinds[kind], ...style }}>{children}</button>
}

function Chip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { background: 'var(--parchment)', color: 'var(--charcoal)' },
    good: { background: '#EEF4E5', color: 'var(--forest)' },
    warn: { background: '#FBEBDD', color: 'var(--rust)' },
  }
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 600, ...tones[tone] }}>
      {children}
    </span>
  )
}

function Switch({ on, onChange, disabled, label: aria }) {
  return (
    <button role="switch" aria-checked={on} aria-label={aria} disabled={disabled} onClick={() => onChange(!on)} style={{
      width: '52px', height: '30px', borderRadius: 'var(--radius-pill)', border: 'none', padding: '3px',
      background: on ? 'var(--sage)' : 'var(--tan)', cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', flexShrink: 0,
    }}>
      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--warm-white)', boxShadow: '0 1px 3px rgba(28,26,23,0.2)' }} />
    </button>
  )
}

function Stat({ value, title, sub, accent }) {
  return (
    <div style={{ ...card, padding: '16px 18px' }}>
      <div style={label}>{title}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 700, color: accent ? 'var(--clay)' : 'var(--ink)', lineHeight: 1.15, marginTop: '6px' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: '28px 0 12px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>{children}</div>
      {right}
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ ...card, textAlign: 'center', color: 'var(--muted)', fontSize: '14px', padding: '28px 20px' }}>{children}</div>
}

function ErrorNote({ children }) {
  return <div style={{ background: '#FBEBDD', color: 'var(--rust)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', marginTop: '10px' }}>{children}</div>
}

// ── 30-day bar chart: one series, one axis. Tap a bar to see its value. ──
function DailyBars({ title, days, field, format }) {
  const [picked, setPicked] = useState(null)
  const values = days.map(d => Number(d[field] || 0))
  const max = Math.max(...values, 0)
  const total = values.reduce((a, b) => a + b, 0)
  const W = 300, H = 90, gap = 2
  const bw = (W - gap * (days.length - 1)) / days.length
  const shown = picked === null ? null : days[picked]
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
        <div style={label}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--charcoal)', fontWeight: 600 }}>
          {shown ? `${shortDate(shown.day + 'T12:00:00')}: ${format(Number(shown[field] || 0))}` : `${format(total)} in 30 days`}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 1}`} style={{ width: '100%', height: '110px', marginTop: '10px', display: 'block' }} role="img" aria-label={`${title}, last 30 days`}>
        <line x1="0" x2={W} y1={H + 0.5} y2={H + 0.5} stroke="var(--tan)" strokeWidth="1" />
        {days.map((d, i) => {
          const v = values[i]
          const h = max > 0 ? Math.max(v > 0 ? 3 : 0, (v / max) * (H - 4)) : 0
          const x = i * (bw + gap)
          const r = Math.min(4, bw / 2, h)
          return (
            <g key={d.day} onClick={() => setPicked(picked === i ? null : i)} style={{ cursor: 'pointer' }}>
              <rect x={x} y="0" width={bw} height={H} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${H} L${x},${H - h + r} Q${x},${H - h} ${x + r},${H - h} L${x + bw - r},${H - h} Q${x + bw},${H - h} ${x + bw},${H - h + r} L${x + bw},${H} Z`}
                  fill={picked === i ? 'var(--rust)' : 'var(--clay)'}
                  opacity={picked === null || picked === i ? 1 : 0.45}
                />
              )}
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
        <span>{days.length ? shortDate(days[0].day + 'T12:00:00') : ''}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

// ── Sign in ──
function SignIn({ onDone }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message)
    else onDone()
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <form onSubmit={submit} style={{ ...card, width: '100%', maxWidth: '380px', padding: '28px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '34px', fontWeight: 700, color: 'var(--ink)' }}>nom <span style={{ color: 'var(--clay)', fontWeight: 300, fontStyle: 'italic' }}>admin</span></div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 22px' }}>Sign in with your Nom account.</div>
        <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />
        <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: '16px' }} />
        <Button disabled={busy || !email || !password} style={{ width: '100%' }}>{busy ? 'Signing in...' : 'Sign in'}</Button>
        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </div>
  )
}

// ── Overview ──
function Overview({ data, onSaveSettings }) {
  const s = data.settings
  const spent = Number(data.month_spend)
  const budget = Number(s.monthly_budget)
  const pct = budget > 0 ? (spent / budget) * 100 : 0
  const fixed = Number(s.fixed_costs)
  const monthTotal = spent + fixed
  const perUser = data.users ? monthTotal / data.users : 0
  const barColor = pct >= 100 ? 'var(--rust)' : pct >= 75 ? 'var(--clay)' : 'var(--sage)'
  const [editing, setEditing] = useState(false)
  const [budgetInput, setBudgetInput] = useState(String(budget))
  const [fixedInput, setFixedInput] = useState(String(fixed))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    const b = Number(budgetInput), f = Number(fixedInput)
    if (!(b > 0) || !(f >= 0)) { setError('Budget must be more than $0, and fixed costs $0 or more.'); return }
    setSaving(true); setError(null)
    const err = await onSaveSettings({ monthly_budget: b, fixed_costs: f })
    setSaving(false)
    if (err) setError(err)
    else setEditing(false)
  }

  const month = new Date().toLocaleDateString('en-US', { month: 'long', timeZone: TZ })

  return (
    <>
      <SectionTitle>{month} budget</SectionTitle>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '34px', fontWeight: 700 }}>{money(spent)}</span>
            <span style={{ fontSize: '14px', color: 'var(--muted)' }}> of {money(budget)} on AI imports</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: pct >= 75 ? 'var(--rust)' : 'var(--forest)' }}>{Math.round(pct)}%</div>
        </div>
        <div style={{ position: 'relative', height: '14px', background: 'var(--parchment)', borderRadius: 'var(--radius-pill)', marginTop: '12px' }}>
          <div style={{ width: `${Math.min(100, pct)}%`, minWidth: pct > 0 ? '6px' : 0, height: '100%', background: barColor, borderRadius: 'var(--radius-pill)' }} />
          <div style={{ position: 'absolute', left: '75%', top: '-4px', width: '2px', height: '22px', background: 'var(--charcoal)', opacity: 0.5 }} />
        </div>
        <div style={{ position: 'relative', height: '16px', fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
          <span style={{ position: 'absolute', left: 0 }}>$0</span>
          <span style={{ position: 'absolute', left: '75%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>75% alert</span>
          <span style={{ position: 'absolute', right: 0 }}>{money(budget, 0)}</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--charcoal)', marginTop: '14px', lineHeight: 1.6 }}>
          {pct >= 100
            ? 'Budget reached. Friend invites paused on their own and you got an email. Turn them back on in the Invites tab.'
            : pct >= 75
              ? 'Past 75%: you got an email. At 100%, friend invites pause on their own.'
              : 'You get an email at 75%. At 100%, friend invites pause on their own. Current members never notice.'}
          {data.month_unpriced > 0 && <span style={{ color: 'var(--muted)' }}> {data.month_unpriced} import{data.month_unpriced === 1 ? '' : 's'} this month happened before cost tracking started, so the real total is a bit higher.</span>}
        </div>
        {editing ? (
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)' }}>AI budget per month ($)
              <input type="number" inputMode="decimal" min="1" step="1" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} style={{ ...inputStyle, marginTop: '4px' }} />
            </label>
            <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Fixed costs per month ($)
              <input type="number" inputMode="decimal" min="0" step="1" value={fixedInput} onChange={e => setFixedInput(e.target.value)} style={{ ...inputStyle, marginTop: '4px' }} />
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
              <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              <Button kind="quiet" onClick={() => { setEditing(false); setBudgetInput(String(budget)); setFixedInput(String(fixed)); setError(null) }}>Cancel</Button>
            </div>
            {error && <div style={{ gridColumn: '1 / -1' }}><ErrorNote>{error}</ErrorNote></div>}
          </div>
        ) : (
          <div style={{ marginTop: '14px' }}>
            <Button kind="secondary" small onClick={() => setEditing(true)}>Change budget or fixed costs</Button>
          </div>
        )}
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>Keep the Anthropic Console limit at or above this budget. It's the hard stop behind this one.</div>
      </div>

      <SectionTitle>Costs</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        <Stat title="This month" value={money(monthTotal)} sub={`${money(spent)} AI + ${money(fixed)} fixed`} />
        <Stat title="Per user" value={money(perUser)} sub={`AI only: ${smallMoney(data.users ? spent / data.users : 0)}`} accent />
        <Stat title="Per import" value={smallMoney(data.avg_import_cost)} sub={`${data.month_imports} imports this month`} />
        <Stat title="AI all time" value={money(data.all_time_spend)} sub="since cost tracking began" />
      </div>

      <SectionTitle>Users and activity</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        <Stat title="Users" value={data.users} sub={`${data.new_users_7d} new this week`} />
        <Stat title="Active" value={data.active_30d} sub={`last 30 days (${data.active_7d} this week)`} />
        <Stat title="Waiting" value={data.waiting} sub="on the waitlist, not invited" accent />
        <Stat title="Recipes" value={data.recipes} sub={`${data.cooks} cooks logged`} />
      </div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>Active means they saved a recipe, logged a cook or imported something.</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginTop: '16px' }}>
        <DailyBars title="Sign-ups per day" days={data.daily || []} field="signups" format={n => `${n}`} />
        <DailyBars title="AI cost per day" days={data.daily || []} field="cost" format={n => smallMoney(n)} />
      </div>
    </>
  )
}

// ── Waitlist ──
function Waitlist({ rows, onInvited }) {
  const [filter, setFilter] = useState('waiting')
  const [busy, setBusy] = useState({})
  const [errors, setErrors] = useState({})
  const [manual, setManual] = useState('')
  const [manualState, setManualState] = useState(null)

  const counts = useMemo(() => ({
    waiting: rows.filter(r => !r.invited_at && !r.has_account).length,
    invited: rows.filter(r => r.invited_at && !r.has_account).length,
    joined: rows.filter(r => r.has_account).length,
  }), [rows])

  const shown = rows.filter(r =>
    filter === 'waiting' ? !r.invited_at && !r.has_account
      : filter === 'invited' ? r.invited_at && !r.has_account
        : filter === 'joined' ? r.has_account : true)

  async function sendInvite(email, waitlistId) {
    const { data, error } = await supabase.functions.invoke('send-invite', { body: { email, waitlist_id: waitlistId } })
    if (!error) return { ok: true, data }
    let message = error.message
    try {
      const body = await error.context.json()
      message = body.error + (body.code ? ` Code: ${body.code}` : '')
    } catch { /* keep the default message */ }
    return { ok: false, message }
  }

  async function invite(row) {
    setBusy(b => ({ ...b, [row.id]: true }))
    setErrors(e => ({ ...e, [row.id]: null }))
    const result = await sendInvite(row.email, row.id)
    setBusy(b => ({ ...b, [row.id]: false }))
    if (result.ok) onInvited(row.id, result.data.invited_at)
    else setErrors(e => ({ ...e, [row.id]: result.message }))
  }

  async function inviteManual() {
    const email = manual.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setManualState({ error: "That doesn't look like an email address." }); return }
    setManualState({ busy: true })
    const result = await sendInvite(email)
    if (result.ok) { setManualState({ done: `Invite sent to ${email}.` }); setManual(''); onInvited(null) }
    else setManualState({ error: result.message })
  }

  const tabs = [['waiting', `Waiting (${counts.waiting})`], ['invited', `Invited (${counts.invited})`], ['joined', `Joined (${counts.joined})`], ['all', `All (${rows.length})`]]

  return (
    <>
      <SectionTitle>Waitlist</SectionTitle>
      <div className="nom-hscroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '12px' }}>
        {tabs.map(([key, text]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 14px', fontFamily: 'var(--font-body)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            background: filter === key ? 'var(--clay)' : 'var(--parchment)', color: filter === key ? 'var(--cream)' : 'var(--charcoal)',
          }}>{text}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty>{filter === 'waiting' ? "Nobody's waiting. Everyone on the list has an invite." : 'Nobody here yet.'}</Empty>
      ) : (
        <div style={{ ...card, padding: '4px 0' }}>
          {shown.map((r, i) => (
            <div key={r.id} style={{ padding: '14px 20px', borderTop: i ? '1px solid var(--parchment)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.email}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>Asked {shortDate(r.created_at)}{r.source && r.source !== 'app' ? ` on the ${r.source}` : ''}</span>
                    {r.tried_inviter_name && !r.has_account && <Chip tone="warn">Tried {r.tried_inviter_name}'s code</Chip>}
                    {r.has_account ? <Chip tone="good">Has an account</Chip>
                      : r.invited_at ? <Chip tone="good">Invited {isToday(r.invited_at) ? 'today' : shortDate(r.invited_at)}</Chip>
                        : <Chip>Waiting</Chip>}
                  </div>
                </div>
                {!r.has_account && (
                  r.invited_at
                    ? <Button kind="secondary" small disabled={busy[r.id]} onClick={() => invite(r)}>{busy[r.id] ? 'Sending...' : 'Resend'}</Button>
                    : <Button small disabled={busy[r.id]} onClick={() => invite(r)}>{busy[r.id] ? 'Sending...' : 'Send invite'}</Button>
                )}
              </div>
              {errors[r.id] && <ErrorNote>{errors[r.id]}</ErrorNote>}
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Invite someone else</SectionTitle>
      <div style={card}>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>For people who aren't on the waitlist. They get the same "You're invited to Nom" email with a one-time code.</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="email" placeholder="friend@example.com" value={manual} onChange={e => { setManual(e.target.value); setManualState(null) }} style={inputStyle} />
          <Button disabled={!manual.trim() || manualState?.busy} onClick={inviteManual}>{manualState?.busy ? 'Sending...' : 'Send'}</Button>
        </div>
        {manualState?.error && <ErrorNote>{manualState.error}</ErrorNote>}
        {manualState?.done && <div style={{ fontSize: '13px', color: 'var(--forest)', marginTop: '10px', fontWeight: 600 }}>{manualState.done}</div>}
      </div>
    </>
  )
}

// ── Users ──
function GiveCodes({ user, onGiven }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  async function give() {
    setBusy(true); setError(null)
    const { data, error } = await supabase.rpc('admin_give_codes', { p_user: user.id, p_count: count })
    setBusy(false)
    if (error) { setError(error.message); return }
    setDone(`Gave ${count} code${count === 1 ? '' : 's'}. They now have ${data} to share.`)
    setOpen(false)
    onGiven(user.id, data)
  }

  if (!open) {
    return (
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <Button kind="secondary" small onClick={() => { setOpen(true); setDone(null) }}>Give codes</Button>
        {done && <span style={{ fontSize: '12px', color: 'var(--forest)', fontWeight: 600 }}>{done}</span>}
      </div>
    )
  }
  return (
    <div style={{ marginTop: '12px', background: 'var(--parchment)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
      <div style={{ fontSize: '13px', color: 'var(--charcoal)', marginBottom: '10px' }}>How many new codes for {user.full_name?.split(' ')[0] || user.username || 'them'}? They show up in their Settings right away.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <Button kind="quiet" small disabled={busy || count <= 1} onClick={() => setCount(c => c - 1)} style={{ width: '36px', padding: '7px 0', background: 'var(--warm-white)' }} aria-label="Fewer">-</Button>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{count}</div>
        <Button kind="quiet" small disabled={busy || count >= 10} onClick={() => setCount(c => c + 1)} style={{ width: '36px', padding: '7px 0', background: 'var(--warm-white)' }} aria-label="More">+</Button>
        <Button small disabled={busy} onClick={give}>{busy ? 'Giving...' : `Give ${count}`}</Button>
        <Button kind="quiet" small disabled={busy} onClick={() => setOpen(false)} style={{ background: 'var(--warm-white)' }}>Cancel</Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  )
}

function Users({ rows, onCodesGiven }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const q = query.trim().toLowerCase()
  const list = rows
    .filter(u => !q || [u.full_name, u.username, u.email].some(v => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => sort === 'cost' ? Number(b.cost_month) - Number(a.cost_month)
      : sort === 'active' ? new Date(b.last_active || 0) - new Date(a.last_active || 0)
        : new Date(b.joined_at) - new Date(a.joined_at))
  const sorts = [['newest', 'Newest'], ['active', 'Recently active'], ['cost', 'Cost this month']]
  return (
    <>
      <SectionTitle>Users ({rows.length})</SectionTitle>
      <input placeholder="Search by name, username or email" value={query} onChange={e => setQuery(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />
      <div className="nom-hscroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '12px' }}>
        {sorts.map(([key, text]) => (
          <button key={key} onClick={() => setSort(key)} style={{
            border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 14px', fontFamily: 'var(--font-body)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            background: sort === key ? 'var(--clay)' : 'var(--parchment)', color: sort === key ? 'var(--cream)' : 'var(--charcoal)',
          }}>{text}</button>
        ))}
      </div>
      {list.length === 0 ? <Empty>No one matches that search.</Empty> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
          {list.map(u => (
            <div key={u.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 500, color: 'var(--ink)' }}>{u.full_name || u.username || 'No name yet'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username ? `@${u.username} · ` : ''}{u.email}</div>
                </div>
                {!u.onboarded && <Chip tone="warn">Didn't finish setup</Chip>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', margin: '14px 0 12px' }}>
                {[[u.recipes, 'recipes'], [u.cooks, 'cooks'], [u.imports_30d, 'imports 30d'], [smallMoney(u.cost_month), 'AI this month']].map(([v, t]) => (
                  <div key={t} style={{ background: 'var(--parchment)', borderRadius: 'var(--radius-sm)', padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{v}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{t}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--charcoal)', lineHeight: 1.7 }}>
                <div>Joined {shortDate(u.joined_at)} · last active {ago(u.last_active)}</div>
                <div>Invited by {u.invited_by_name || (u.invite_source === 'admin' ? 'you' : 'unknown')} · codes: {u.codes_left} left, {u.codes_used} used</div>
              </div>
              <GiveCodes user={u} onGiven={onCodesGiven} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Friend invites ──
function Invites({ settings, users, onSaveSettings }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const paused = !settings.friend_invites_on

  async function save(patch) {
    setSaving(true); setError(null)
    const err = await onSaveSettings(patch)
    setSaving(false)
    if (err) setError(err)
  }

  // Who invited whom, grouped by the person who shared the code
  const groups = useMemo(() => {
    const byId = new Map()
    for (const u of users) {
      if (!u.invited_by && u.invite_source !== 'admin') continue
      const key = u.invited_by || 'you'
      if (!byId.has(key)) byId.set(key, { name: u.invited_by_name || 'You (sent from Admin or Terminal)', people: [] })
      byId.get(key).people.push(u)
    }
    return [...byId.values()].sort((a, b) => b.people.length - a.people.length)
  }, [users])

  const codes = settings.codes_per_new_user

  return (
    <>
      <SectionTitle>Friend invites</SectionTitle>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Friend invites are {paused ? 'paused' : 'on'}</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.5 }}>
              {paused
                ? "Members' codes don't work right now. Anyone who tries one sees \"Nom is full for a moment\" and joins your waitlist. New members still get codes, which work once you turn this back on. Invites you send always work."
                : "Members can share their codes. Invites you send always work, even when this is off."}
            </div>
          </div>
          <Switch on={!paused} disabled={saving} label="Friend invites" onChange={on => save({ friend_invites_on: on })} />
        </div>
        {paused && settings.paused_reason === 'budget' && (
          <div style={{ background: '#FBEBDD', color: 'var(--rust)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', marginTop: '14px' }}>
            Nom paused these on its own because AI spending hit this month's budget. Turning them back on keeps them on for the rest of the month.
          </div>
        )}
        <div style={{ height: '1px', background: 'var(--parchment)', margin: '18px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Codes per new member</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>How many codes each person gets when they join. Doesn't change anyone who already joined. To give someone more, use Give codes in the Users tab.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <Button kind="quiet" small disabled={saving || codes <= 0} onClick={() => save({ codes_per_new_user: codes - 1 })} style={{ width: '36px', padding: '7px 0' }} aria-label="Fewer">-</Button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>{codes}</div>
            <Button kind="quiet" small disabled={saving || codes >= 10} onClick={() => save({ codes_per_new_user: codes + 1 })} style={{ width: '36px', padding: '7px 0' }} aria-label="More">+</Button>
          </div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>

      <SectionTitle>Who invited whom</SectionTitle>
      {groups.length === 0 ? <Empty>No one has joined with a code yet.</Empty> : (
        <div style={{ ...card, padding: '4px 0' }}>
          {groups.map((g, i) => (
            <div key={g.name + i} style={{ padding: '14px 20px', borderTop: i ? '1px solid var(--parchment)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{g.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{g.people.length} joined</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {g.people.map(p => <Chip key={p.id}>{p.full_name || p.username || p.email} · {shortDate(p.joined_at)}</Chip>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Page ──
export default function Admin() {
  const [session, setSession] = useState(undefined) // undefined = checking
  const [adminCheck, setAdminCheck] = useState(null) // { userId, ok }
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [waitlist, setWaitlist] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    const [o, w, u] = await Promise.all([
      supabase.rpc('admin_overview'),
      supabase.rpc('admin_waitlist'),
      supabase.rpc('admin_users'),
    ])
    setLoading(false)
    const err = o.error || w.error || u.error
    if (err) { setLoadError(err.message); return }
    setOverview(o.data); setWaitlist(w.data || []); setUsers(u.data || [])
    setLoadedAt(new Date())
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (cancelled) return
      const ok = !error && data === true
      setAdminCheck({ userId, ok })
      if (ok) load()
    })
    return () => { cancelled = true }
  }, [userId, load])
  const isAdmin = adminCheck && adminCheck.userId === userId ? adminCheck.ok : null

  async function saveSettings(patch) {
    const { data, error } = await supabase.rpc('admin_update_settings', { p: patch })
    if (error) return error.message
    setOverview(o => ({ ...o, settings: data }))
    if ('monthly_budget' in patch) load() // alerts may have fired
    return null
  }

  function markInvited(id, invitedAt) {
    if (id) setWaitlist(rows => rows.map(r => r.id === id ? { ...r, invited_at: invitedAt } : r))
    load()
  }

  async function signOut() {
    await supabase.auth.signOut()
    setOverview(null); setWaitlist([]); setUsers([]); setAdminCheck(null)
  }

  if (session === undefined) return null
  if (!session) return <SignIn onDone={() => {}} />
  if (isAdmin === null) return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '80px 0' }}>Checking...</div>
  if (isAdmin === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ ...card, maxWidth: '380px', textAlign: 'center', padding: '28px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700 }}>This account can't open Admin</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', margin: '8px 0 18px' }}>You're signed in as {session.user.email}.</div>
          <Button onClick={signOut}>Sign out</Button>
        </div>
      </div>
    )
  }

  const tabs = [['overview', 'Overview'], ['waitlist', `Waitlist${overview ? ` (${overview.waiting})` : ''}`], ['users', 'Users'], ['invites', 'Invites']]

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--cream)', borderBottom: '1px solid var(--parchment)', paddingTop: 'var(--safe-top)' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '14px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, color: 'var(--ink)' }}>nom <span style={{ color: 'var(--clay)', fontWeight: 300, fontStyle: 'italic' }}>admin</span></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button kind="quiet" small disabled={loading} onClick={load}>{loading ? 'Loading...' : 'Refresh'}</Button>
              <Button kind="secondary" small onClick={signOut}>Sign out</Button>
            </div>
          </div>
          <div className="nom-hscroll" style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginTop: '10px' }}>
            {tabs.map(([key, text]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                border: 'none', background: 'transparent', padding: '10px 12px', fontFamily: 'var(--font-body)',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                color: tab === key ? 'var(--clay)' : 'var(--muted)',
                borderBottom: `2.5px solid ${tab === key ? 'var(--clay)' : 'transparent'}`,
              }}>{text}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '980px', margin: '0 auto', padding: '0 20px 60px' }}>
        {loadError && <div style={{ marginTop: '20px' }}><ErrorNote>Couldn't load: {loadError}</ErrorNote></div>}
        {!overview ? (
          !loadError && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '60px 0' }}>Loading...</div>
        ) : (
          <>
            {!overview.settings.friend_invites_on && tab !== 'invites' && (
              <div style={{ background: '#FBEBDD', color: 'var(--rust)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <span>Friend invites are paused{overview.settings.paused_reason === 'budget' ? ' because the budget was reached' : ''}.</span>
                <Button kind="secondary" small onClick={() => setTab('invites')}>Manage</Button>
              </div>
            )}
            {tab === 'overview' && <Overview data={overview} onSaveSettings={saveSettings} />}
            {tab === 'waitlist' && <Waitlist rows={waitlist} onInvited={markInvited} />}
            {tab === 'users' && <Users rows={users} onCodesGiven={(id, left) => setUsers(list => list.map(x => x.id === id ? { ...x, codes_left: left } : x))} />}
            {tab === 'invites' && <Invites settings={overview.settings} users={users} onSaveSettings={saveSettings} />}
            {loadedAt && <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '32px' }}>Updated {loadedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })}</div>}
          </>
        )}
      </div>
    </div>
  )
}
