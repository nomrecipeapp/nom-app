// Emails nom.recipeapp@gmail.com whenever someone files a report.
// Triggered by a Database Webhook on INSERT into public.reports (deployed with verify_jwt = false;
// the report is re-read from the database so fake calls can't send email).
// Uses RESEND_API_KEY (already set) plus SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (built in).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const reasonLabels: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Offensive or inappropriate',
  harassment: 'Harassment or bullying',
  other: 'Something else',
}

const typeLabels: Record<string, string> = {
  comment: 'Comment',
  cook: 'Cook post',
  save: 'Saved recipe post',
  profile: 'Profile',
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function fetchOne(table: string, select: string, id: string | null) {
  if (!id) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}&id=eq.${encodeURIComponent(id)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    })
    const rows = await res.json()
    return Array.isArray(rows) ? rows[0] ?? null : null
  } catch (_e) {
    return null
  }
}

function personLabel(p: { full_name?: string; username?: string } | null, id: string | null) {
  if (!p) return id ? `unknown user (${esc(id)})` : 'unknown'
  const name = esc(p.full_name || p.username || 'No name')
  return p.username ? `${name} (@${esc(p.username)})` : name
}

Deno.serve(async (req) => {
  // Only trust reports that really exist in the database (the webhook just tells us which one)
  let payload: { record?: { id?: string } } = {}
  try { payload = await req.json() } catch (_e) { /* ignore */ }
  const r = await fetchOne('reports', '*', payload.record?.id ?? null)
  if (!r) return new Response('report not found', { status: 404 })

  const [reporter, reported] = await Promise.all([
    fetchOne('profiles', 'full_name,username', r.reporter_id),
    fetchOne('profiles', 'full_name,username', r.reported_user_id),
  ])

  // What exactly was reported
  let contentHtml = ''
  let tableToEdit = ''
  if (r.target_type === 'comment') {
    const c = await fetchOne('comments', 'body', r.target_id)
    contentHtml = c ? `<blockquote style="border-left:3px solid #C4713A;margin:0;padding:8px 12px;color:#3A3630">${esc(c.body)}</blockquote>` : '<p><em>Comment not found (it may already be deleted).</em></p>'
    tableToEdit = 'comments'
  } else if (r.target_type === 'cook') {
    const c = await fetchOne('cooks', 'notes,photo_urls', r.target_id)
    contentHtml = c ? `<p>Notes: ${esc(c.notes || '(none)')}</p><p>Photos: ${(c.photo_urls || []).map((u: string) => `<a href="${esc(u)}">photo</a>`).join(', ') || '(none)'}</p>` : '<p><em>Post not found (it may already be deleted).</em></p>'
    tableToEdit = 'cooks'
  } else if (r.target_type === 'save') {
    const rec = await fetchOne('recipes', 'title,image_url,notes', r.target_id)
    contentHtml = rec ? `<p>Recipe: ${esc(rec.title)}</p><p>Notes: ${esc(rec.notes || '(none)')}</p>${rec.image_url ? `<p><a href="${esc(rec.image_url)}">image</a></p>` : ''}` : '<p><em>Recipe not found (it may already be deleted).</em></p>'
    tableToEdit = 'recipes'
  } else {
    tableToEdit = 'profiles'
  }

  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1C1A17;line-height:1.5">
      <h2 style="margin:0 0 12px">New report on Nom</h2>
      <p><strong>What:</strong> ${esc(typeLabels[r.target_type] || r.target_type)}<br>
      <strong>Reason:</strong> ${esc(reasonLabels[r.reason] || r.reason)}<br>
      <strong>Posted by:</strong> ${personLabel(reported, r.reported_user_id)}<br>
      <strong>Reported by:</strong> ${personLabel(reporter, r.reporter_id)}</p>
      ${r.note ? `<p><strong>Their note:</strong> ${esc(r.note)}</p>` : ''}
      ${contentHtml}
      <hr style="border:none;border-top:1px solid #F0E8D8;margin:16px 0">
      <p style="font-size:13px;color:#8A8070">
        Apple expects action within 24 hours. To remove it: Supabase, Table Editor, <strong>${esc(tableToEdit)}</strong>, find id <code>${esc(r.target_id)}</code>, delete the row.
        Then in the <strong>reports</strong> table, set this report's status to <code>resolved</code>.<br>
        Report id: <code>${esc(r.id)}</code>
      </p>
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nom <hello@nomrecipeapp.com>',
      to: 'nom.recipeapp@gmail.com',
      subject: `Nom report: ${typeLabels[r.target_type] || r.target_type}, ${reasonLabels[r.reason] || r.reason}`,
      html,
    }),
  })

  if (!res.ok) {
    console.error('Resend failed:', res.status, await res.text())
    return new Response('email failed', { status: 500 })
  }
  return new Response('ok', { status: 200 })
})
