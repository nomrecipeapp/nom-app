// Shared helpers for Nom's internal alert emails (sign-ups, waitlist).
// Uses RESEND_API_KEY (already set) plus SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (built in).

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
export const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALERT_TO = 'nom.recipeapp@gmail.com'
const FROM = 'Nom <hello@nomrecipeapp.com>'

const dbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Read one row by id, straight from the database
export async function fetchOne(table: string, select: string, id: string | null | undefined) {
  if (!id) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}&id=eq.${encodeURIComponent(id)}`, { headers: dbHeaders })
    const rows = await res.json()
    return Array.isArray(rows) ? rows[0] ?? null : null
  } catch (_e) {
    return null
  }
}

// Read one column for every row (small tables only)
async function fetchColumn(table: string, column: string): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=10000`, { headers: dbHeaders })
  const rows = await res.json()
  return Array.isArray(rows) ? rows.map((r: Record<string, string>) => r[column]).filter(Boolean) : []
}

// Current totals: everyone with an account, and waitlist emails that don't have an account yet
export async function getCounts(): Promise<{ users: number | null; waiting: number | null }> {
  try {
    const [userEmails, waitlistEmails] = await Promise.all([
      fetchColumn('profiles', 'email'),
      fetchColumn('waitlist', 'email'),
    ])
    const joined = new Set(userEmails.map((e) => e.trim().toLowerCase()))
    const waiting = waitlistEmails.filter((e) => !joined.has(e.trim().toLowerCase())).length
    const users = await countRows('profiles')
    return { users, waiting }
  } catch (e) {
    console.error('Count failed:', e)
    return { users: null, waiting: null }
  }
}

async function countRows(table: string): Promise<number | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
    method: 'HEAD',
    headers: { ...dbHeaders, Prefer: 'count=exact', Range: '0-0' },
  })
  const range = res.headers.get('content-range') // looks like "0-0/63"
  const total = range?.split('/')[1]
  return total && total !== '*' ? Number(total) : null
}

export function countsHtml(c: { users: number | null; waiting: number | null }): string {
  const show = (n: number | null) => (n === null ? '?' : String(n))
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:separate;border-spacing:8px 0">
      <tr>
        <td style="background:#FAF6EF;border:1px solid #D9C9B0;border-radius:12px;padding:12px 18px;text-align:center">
          <div style="font-size:24px;font-weight:bold;color:#1C1A17">${show(c.users)}</div>
          <div style="font-size:12px;color:#8A8070">users</div>
        </td>
        <td style="background:#FAF6EF;border:1px solid #D9C9B0;border-radius:12px;padding:12px 18px;text-align:center">
          <div style="font-size:24px;font-weight:bold;color:#C4713A">${show(c.waiting)}</div>
          <div style="font-size:12px;color:#8A8070">waiting for an invite</div>
        </td>
      </tr>
    </table>`
}

export function wrap(title: string, body: string): string {
  return `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1C1A17;line-height:1.5">
      <h2 style="margin:0 0 12px">${esc(title)}</h2>
      ${body}
    </div>`
}

export async function sendAlert(subject: string, html: string): Promise<Response> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: ALERT_TO, subject, html }),
  })
  if (!res.ok) {
    console.error('Resend failed:', res.status, await res.text())
    return new Response('email failed', { status: 500 })
  }
  return new Response('ok', { status: 200 })
}

// Read the webhook body safely
export async function readRecordId(req: Request): Promise<string | null> {
  try {
    const payload = await req.json()
    return payload?.record?.id ?? null
  } catch (_e) {
    return null
  }
}
