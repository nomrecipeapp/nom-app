// Nom's user-facing emails: one shared layout plus the templates.
// Colors match src/index.css. Email apps can't load Fraunces or DM Sans,
// so headings fall back to Georgia and body text to the system font.
// No emojis, no em dashes (house style).

export const APP_STORE_URL = 'https://apps.apple.com/us/app/nom-recipe-app/id6828565860'
export const SITE_URL = 'https://www.nomrecipeapp.com'
export const REPLY_TO = 'hello@nomrecipeapp.com'
export const FROM = 'Nom <hello@nomrecipeapp.com>'
const INSTAGRAM_URL = 'https://instagram.com/nom.recipeapp'

const C = {
  cream: '#FAF6EF',
  parchment: '#F0E8D8',
  tan: '#D9C9B0',
  clay: '#C4713A',
  rust: '#B85C2C',
  sage: '#7A8C6E',
  ink: '#1C1A17',
  charcoal: '#3A3630',
  muted: '#8A8070',
}
const DISPLAY = "Fraunces,Georgia,'Times New Roman',serif"
const BODY = "'DM Sans',-apple-system,Helvetica,Arial,sans-serif"

export type Email = { subject: string; html: string; text: string }

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// "Sydney Bernstein" -> "Sydney"
export function firstName(full: unknown): string {
  const f = String(full ?? '').trim().split(/\s+/)[0]
  return f && f.length <= 40 ? f : ''
}

// ── Building blocks ──

function p(html: string, extra = ''): string {
  return `<p style="font-family:${BODY};font-size:16px;line-height:1.65;color:${C.charcoal};margin:0 0 16px 0;${extra}">${html}</p>`
}

function heading(html: string): string {
  return `<h1 style="font-family:${DISPLAY};font-size:30px;line-height:1.2;font-weight:700;color:${C.ink};letter-spacing:-0.5px;margin:0 0 20px 0;">${html}</h1>`
}

function button(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
    <tr><td style="background:${C.clay};border-radius:100px;">
      <a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${BODY};font-size:16px;font-weight:700;color:${C.cream};text-decoration:none;border-radius:100px;">${esc(label)}</a>
    </td></tr>
  </table>`
}

// Numbered steps: [title, detail]
function steps(items: [string, string][]): string {
  const rows = items.map(([title, detail], i) => `
    <tr valign="top">
      <td width="40" style="padding:0 0 18px 0;">
        <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${C.parchment};color:${C.clay};font-family:${DISPLAY};font-size:15px;font-weight:700;text-align:center;">${i + 1}</div>
      </td>
      <td style="padding:2px 0 18px 0;">
        <div style="font-family:${BODY};font-size:16px;font-weight:700;color:${C.ink};margin:0 0 2px 0;">${title}</div>
        <div style="font-family:${BODY};font-size:15px;line-height:1.55;color:${C.charcoal};">${detail}</div>
      </td>
    </tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px 0;">${rows}</table>`
}

function signoff(line: string): string {
  return `
    ${p(line, 'margin-bottom:6px;')}
    <p style="font-family:${DISPLAY};font-size:24px;font-weight:600;color:${C.clay};margin:0 0 2px 0;">Syd</p>
    <p style="font-family:${BODY};font-size:13px;color:${C.muted};margin:0;">Founder of Nom</p>`
}

function layout(opts: { preheader: string; body: string; footerNote: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>Nom</title>
</head>
<body style="margin:0;padding:0;background:${C.parchment};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.parchment};">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.parchment};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${C.cream};border:1px solid ${C.tan};border-radius:24px;overflow:hidden;">
      <tr><td style="background:${C.clay};padding:28px 40px;">
        <p style="font-family:${DISPLAY};font-size:36px;font-weight:700;color:${C.cream};letter-spacing:-1px;line-height:1;margin:0;">nom</p>
      </td></tr>
      <tr><td style="padding:40px 40px 36px 40px;">
        ${opts.body}
      </td></tr>
      <tr><td style="background:${C.parchment};border-top:1px solid ${C.tan};padding:20px 40px;text-align:center;">
        <p style="font-family:${BODY};font-size:12px;line-height:1.7;color:${C.muted};margin:0;">
          ${opts.footerNote}<br>
          Questions? Just reply, or write to <a href="mailto:${REPLY_TO}" style="color:${C.clay};text-decoration:none;">${REPLY_TO}</a><br>
          <a href="${INSTAGRAM_URL}" style="color:${C.clay};text-decoration:none;">@nom.recipeapp</a> on Instagram
        </p>
      </td></tr>
    </table>
    <p style="font-family:${BODY};font-size:11px;color:${C.muted};margin:16px 0 0 0;">SPB STUDIO LLC</p>
  </td></tr>
</table>
</body>
</html>`
}

const textFooter = `\n\nQuestions? Just reply, or write to ${REPLY_TO}\n@nom.recipeapp on Instagram`

// ── 1. Welcome (sent when someone creates an account) ──

export function welcomeEmail(opts: { name?: string }): Email {
  const name = firstName(opts.name)
  const hi = name ? `Hi ${esc(name)}!` : 'Hi there!'
  const html = layout({
    preheader: 'Three things to try first in your new cookbook.',
    footerNote: "You're getting this because you just made a Nom account.",
    body: `
      ${heading(`Welcome to Nom. <span style="font-style:italic;color:${C.clay};">Your cookbook is ready.</span>`)}
      ${p(hi)}
      ${p("I'm so glad you're here. Nom is a home for the recipes you actually cook, and an honest record of how they turned out. You'll see what your friends are making too, and whether they'd make it again.")}
      ${p('Here are three things to try first:', 'font-weight:700;color:' + C.ink + ';margin-bottom:18px;')}
      ${steps([
        ['Bring in a recipe', 'Tap the + and paste a link from any recipe site, TikTok or Instagram. You can also snap a photo of a cookbook page.'],
        ['Log a cook', 'Made something? Log it with a photo and your verdict: Would Make Again, It Was Fine, or Never Again.'],
        ['Invite your people', 'Nom is better with friends. You have 3 invite codes in Settings. Tap Share to send one.'],
      ])}
      ${p("If anything feels confusing or broken, reply to this email. It comes straight to me, and I read every one. Ideas are always welcome too.")}
      ${signoff('Happy cooking,')}`,
  })
  const text = `${name ? `Hi ${name}!` : 'Hi there!'}

Welcome to Nom. Your cookbook is ready.

I'm so glad you're here. Nom is a home for the recipes you actually cook, and an honest record of how they turned out. You'll see what your friends are making too, and whether they'd make it again.

Three things to try first:
1. Bring in a recipe: tap the + and paste a link from any recipe site, TikTok or Instagram. You can also snap a photo of a cookbook page.
2. Log a cook: log it with a photo and your verdict (Would Make Again, It Was Fine, or Never Again).
3. Invite your people: you have 3 invite codes in Settings. Tap Share to send one.

If anything feels confusing or broken, reply to this email. It comes straight to me, and I read every one.

Happy cooking,
Syd
Founder of Nom${textFooter}`
  return { subject: 'Welcome to Nom!', html, text }
}

// ── 2. Waitlist confirmation (sent when someone requests an invite) ──

export function waitlistEmail(): Email {
  const html = layout({
    preheader: "Thanks for requesting an invite. Here's what happens next.",
    footerNote: 'You asked for an invite to Nom. If that wasn\'t you, you can ignore this email.',
    body: `
      ${heading(`You're on the list!`)}
      ${p('Thanks for wanting to cook with us. Nom is invite-only while we grow, so we let people in a few at a time.')}
      ${p('Here\'s what happens next:', 'font-weight:700;color:' + C.ink + ';margin-bottom:18px;')}
      ${steps([
        ['We send you a code', "When a spot opens up, you'll get an email from us with your own invite code."],
        ['Download Nom', 'Grab the app from the App Store. It\'s free.'],
        ['Enter your code', 'Tap "I have an invite code" when you sign up, and you\'re in.'],
      ])}
      ${p('<strong style="color:' + C.ink + ';">Know someone already on Nom?</strong> Ask them for a code. Every member can share a few from Settings, so that\'s the fastest way in.')}
      ${button('See Nom on the App Store', APP_STORE_URL)}
      ${signoff('See you soon,')}`,
  })
  const text = `You're on the list!

Thanks for wanting to cook with us. Nom is invite-only while we grow, so we let people in a few at a time.

What happens next:
1. When a spot opens up, you'll get an email from us with your own invite code.
2. Download Nom from the App Store. It's free: ${APP_STORE_URL}
3. Tap "I have an invite code" when you sign up, and you're in.

Know someone already on Nom? Ask them for a code. Every member can share a few from Settings, so that's the fastest way in.

See you soon,
Syd
Founder of Nom${textFooter}`
  return { subject: "You're on the Nom waitlist", html, text }
}

// ── 3. Invite (sent by Syd to someone from the waitlist) ──

export function inviteEmail(opts: { code: string }): Email {
  const code = esc(opts.code)
  const codeCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px 0;">
      <tr><td align="center" style="background:${C.parchment};border:2px dashed ${C.clay};border-radius:16px;padding:22px 16px;">
        <div style="font-family:${BODY};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.muted};margin:0 0 8px 0;">Your invite code</div>
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:0.18em;color:${C.ink};">${code}</div>
      </td></tr>
    </table>`
  const html = layout({
    preheader: `Your spot on Nom is ready. Your code: ${opts.code}`,
    footerNote: 'You asked for an invite to Nom, and here it is. This code works once.',
    body: `
      ${heading(`You're in! <span style="font-style:italic;color:${C.clay};">Come cook with us.</span>`)}
      ${p("A spot opened up on Nom, and it's yours. Nom is a home for the recipes you actually cook. Save them from anywhere, log what you make, and see what your friends would honestly make again.")}
      ${codeCard}
      ${steps([
        ['Download Nom', 'Get it free from the App Store.'],
        ['Tap "I have an invite code"', 'Then enter the code above and set up your account.'],
      ])}
      ${button('Download on the App Store', APP_STORE_URL)}
      ${signoff("Can't wait to see what you cook,")}`,
  })
  const text = `You're in! Come cook with us.

A spot opened up on Nom, and it's yours.

Your invite code: ${opts.code}

1. Download Nom free from the App Store: ${APP_STORE_URL}
2. Tap "I have an invite code", enter the code above, and set up your account.

This code works once.

Can't wait to see what you cook,
Syd
Founder of Nom${textFooter}`
  return { subject: "You're invited to Nom", html, text }
}

// ── 4. Budget alert (internal, to Syd; sent by the Admin page later) ──

export function budgetAlertEmail(opts: {
  spent: number
  budget: number
  level: 75 | 100
  users?: number | null
  waiting?: number | null
}): Email {
  const pct = Math.round((opts.spent / opts.budget) * 100)
  const money = (n: number) => `$${n.toFixed(2)}`
  const atLimit = opts.level === 100
  const barColor = atLimit ? C.rust : C.clay
  const width = Math.min(100, Math.max(2, pct))
  const stat = (value: string, label: string, color: string = C.ink) => `
    <td style="background:${C.parchment};border-radius:12px;padding:12px 10px;text-align:center;">
      <div style="font-family:${DISPLAY};font-size:22px;font-weight:700;color:${color};">${value}</div>
      <div style="font-family:${BODY};font-size:12px;color:${C.muted};">${label}</div>
    </td>`
  const show = (n: number | null | undefined) => (n === null || n === undefined ? '?' : String(n))
  const html = layout({
    preheader: `${money(opts.spent)} of ${money(opts.budget)} used this month.`,
    footerNote: 'Internal alert for the Nom team.',
    body: `
      <p style="font-family:${BODY};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${barColor};margin:0 0 10px 0;">Budget alert</p>
      ${heading(atLimit ? 'Nom hit this month\'s budget.' : `Nom is at ${pct}% of this month's budget.`)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
        <tr><td style="background:${C.parchment};border-radius:100px;height:14px;font-size:0;line-height:0;">
          <div style="width:${width}%;height:14px;background:${barColor};border-radius:100px;"></div>
        </td></tr>
      </table>
      ${p(`<strong style="color:${C.ink};">${money(opts.spent)}</strong> of ${money(opts.budget)} spent on AI imports this month.`, 'font-size:15px;margin-bottom:20px;')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px 24px -8px;">
        <tr>
          ${stat(show(opts.users), 'users')}
          ${stat(show(opts.waiting), 'waiting', C.clay)}
          ${stat(opts.users ? money(opts.spent / opts.users) : '?', 'per user')}
        </tr>
      </table>
      ${atLimit
        ? p('<strong style="color:' + C.ink + ';">Friend invites are paused.</strong> Unused codes stop working and new members get 0 codes. Everyone already on Nom can keep using everything, and the waitlist keeps collecting emails. Turn invites back on from the Admin page when you\'re ready.')
        : p("Nothing has changed yet. If spending reaches 100%, Nom will pause friend invites on its own. Current users won't notice anything.")}
      ${p('The hard cap in the Anthropic Console still applies on top of this.', 'font-size:14px;color:' + C.muted + ';')}`,
  })
  const text = `Budget alert: ${pct}% of this month's budget used.

${money(opts.spent)} of ${money(opts.budget)} spent on AI imports this month.
Users: ${show(opts.users)} | Waiting: ${show(opts.waiting)}

${atLimit
    ? 'Friend invites are paused. Turn them back on from the Admin page when you\'re ready.'
    : 'Nothing has changed yet. At 100%, Nom will pause friend invites on its own.'}`
  const subject = atLimit
    ? `Nom budget reached: ${money(opts.spent)} of ${money(opts.budget)} (invites paused)`
    : `Nom budget at ${pct}%: ${money(opts.spent)} of ${money(opts.budget)}`
  return { subject, html, text }
}

// ── Sending ──

export async function sendEmail(to: string, email: Email): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, reply_to: REPLY_TO, subject: email.subject, html: email.html, text: email.text }),
  })
  if (!res.ok) {
    const error = `${res.status} ${await res.text()}`
    console.error('Resend failed:', error)
    return { ok: false, error }
  }
  return { ok: true }
}
