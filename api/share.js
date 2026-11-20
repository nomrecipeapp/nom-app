// Shareable recipe and cook links (1.0.4).
// nomrecipeapp.com/r/<recipe id> and /c/<cook id> land here (see vercel.json), and so do
// older links like /?recipe=<id> and /?cook=<id>. This builds the preview page on the server
// so iMessage, Instagram and others can read the photo and title (they don't run the app's code).
//
// What a visitor sees: photo, title, the person's first name and verdict, their cook note,
// a credit link to the original site, and Get Nom. Never ingredients or steps.
// Private accounts get a plain "shared on Nom" card, unless the owner shared that item themselves. Data comes from the share_preview()
// database function (supabase/sql/2026-11-20-share-links.sql), which only hands out those fields.
//
// People who have Nom: the iPhone opens these links straight in the app (Universal Links,
// public/.well-known/apple-app-site-association). This page is for everyone else, plus
// members whose link opened in another app's browser (Instagram): "Already a member? Log in"
// opens Nom on the recipe or cook. Website login stays off.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const SITE = 'https://www.nomrecipeapp.com'
const APP_STORE_URL = 'https://apps.apple.com/us/app/nom-recipe-app/id6828565860'
const FALLBACK_IMAGE = `${SITE}/apple-touch-icon.png`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VERDICTS = {
  would_make_again: { label: 'Would Make Again', phrase: 'would make it again', bg: '#EEF4E5', border: '#7A8C6E', color: '#4A5E42' },
  it_was_fine: { label: 'It Was Fine', phrase: 'thought it was fine', bg: '#FBF0E6', border: '#E8A87C', color: '#C4713A' },
  never_again: { label: 'Never Again', phrase: 'would never make it again', bg: '#F4E8E8', border: '#C47070', color: '#9B4040' },
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

function httpsUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null
}

async function loadPreview(kind, id) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/share_preview`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_kind: kind, p_id: id }),
  })
  if (!r.ok) {
    console.error('share_preview failed', r.status, await r.text().catch(() => ''))
    return null
  }
  return r.json()
}

function timesLine(times) {
  if (!times || times < 2) return ''
  return `Made ${times}x`
}

function buildPage({ kind, id, data }) {
  const path = kind === 'cook' ? `/c/${id}` : `/r/${id}`
  const pageUrl = `${SITE}${path}`
  const appUrl = `nomrecipeapp://${kind === 'cook' ? 'c' : 'r'}/${id}`
  const thing = kind === 'cook' ? 'cook' : 'recipe'

  const hidden = !data || data.private
  const name = hidden ? '' : (data.name || 'A friend')
  const verdict = hidden ? null : VERDICTS[data.verdict]
  const image = hidden ? null : httpsUrl(data.image)
  const source = hidden ? null : httpsUrl(data.source_url)
  let sourceHost = ''
  try { sourceHost = source ? new URL(source).hostname.replace(/^www\./, '') : '' } catch { /* bad link */ }
  const sourceName = hidden ? '' : (data.source_name || sourceHost)

  // What the link preview bubble says
  let ogTitle, ogDesc
  if (hidden) {
    ogTitle = `Someone shared a ${thing} on Nom`
    ogDesc = 'Nom is a recipe app for saving what you find and logging what you actually cook, with friends.'
  } else if (kind === 'cook') {
    ogTitle = `${name} made ${data.title}`
    ogDesc = verdict ? `${verdict.label}. ` : ''
    ogDesc += data.note ? `"${data.note.length > 120 ? data.note.slice(0, 117) + '...' : data.note}"` : 'See it on Nom.'
  } else {
    ogTitle = data.title
    ogDesc = verdict ? `${name} ${verdict.phrase}. ` : `Saved by ${name} on Nom. `
    ogDesc += sourceName ? `Recipe from ${sourceName}.` : ''
  }

  const heading = hidden ? `Someone shared a ${thing} with you` : data.title
  const byline = hidden
    ? (data?.private
      ? 'This one is from a private account, so only their friends on Nom can see it.'
      : "We couldn't find this one. It may have been removed.")
    : (kind === 'cook' ? `${name} made this` : `Saved by ${name}`)

  const avatar = !hidden && httpsUrl(data.avatar)
    ? `<img class="av" src="${esc(data.avatar)}" alt="">`
    : (!hidden ? `<div class="av av-letter">${esc(name[0]?.toUpperCase() || 'N')}</div>` : '')

  const pills = []
  if (verdict) pills.push(`<span class="pill" style="background:${verdict.bg};border-color:${verdict.border};color:${verdict.color}">${esc(verdict.label)}</span>`)
  if (!hidden && timesLine(data.times)) pills.push(`<span class="pill pill-plain">${esc(timesLine(data.times))}</span>`)

  const note = !hidden && data.note ? `<p class="note">"${esc(data.note)}"</p>` : ''
  const credit = source
    ? `<a class="credit" href="${esc(source)}" rel="nofollow noopener" target="_blank">Recipe from ${esc(sourceName)}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`
    : (sourceName ? `<p class="credit">Recipe from ${esc(sourceName)}</p>` : '')

  const hero = image
    ? `<img class="hero" src="${esc(image)}" alt="" onerror="this.removeAttribute('src');this.alt=''">`
    : `<div class="hero hero-empty"><div class="hero-mark">nom</div></div>`

  const askLine = hidden
    ? 'Nom is invite-only right now. Ask the friend who sent you this for an invite.'
    : `Nom is invite-only right now. Ask ${esc(name)} for an invite.`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(ogTitle)} | Nom</title>
<meta name="description" content="${esc(ogDesc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Nom">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:image" content="${esc(image || FALLBACK_IMAGE)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="apple-itunes-app" content="app-id=6828565860, app-argument=${esc(pageUrl)}">
${hidden ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(pageUrl)}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --cream: #FAF6EF; --warm-white: #FDF9F4; --parchment: #F0E8D8; --tan: #D9C9B0;
    --clay: #C4713A; --ink: #1C1A17; --charcoal: #3A3630; --muted: #8A8070;
    --font-display: 'Fraunces', serif; --font-body: 'DM Sans', sans-serif;
    --radius-md: 16px; --radius-lg: 24px; --radius-pill: 100px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cream); color: var(--ink); font-family: var(--font-body); -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 480px; margin: 0 auto; padding: calc(16px + env(safe-area-inset-top)) 20px calc(32px + env(safe-area-inset-bottom)); }
  .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .logo { font-family: var(--font-display); font-weight: 700; font-size: 28px; color: var(--clay); letter-spacing: -1px; text-decoration: none; }
  .card { background: var(--warm-white); border: 1px solid var(--parchment); border-radius: var(--radius-lg); overflow: hidden; }
  .hero { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: var(--parchment); }
  .hero-empty { display: flex; align-items: center; justify-content: center; }
  .hero-mark { font-family: var(--font-display); font-weight: 700; font-size: 56px; color: var(--tan); letter-spacing: -2px; }
  .body { padding: 20px; }
  .who { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 14px; color: var(--charcoal); }
  .av { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .av-letter { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #C4713A, #E8A87C); color: var(--cream); font-family: var(--font-display); font-weight: 700; font-size: 13px; }
  h1 { font-family: var(--font-display); font-weight: 700; font-size: 28px; line-height: 1.15; letter-spacing: -0.5px; margin: 0 0 12px; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .pill { display: inline-flex; align-items: center; border: 1px solid; border-radius: var(--radius-pill); padding: 5px 12px; font-size: 13px; font-weight: 600; }
  .pill-plain { background: var(--parchment); border-color: var(--tan); color: var(--charcoal); }
  .note { font-size: 16px; line-height: 1.55; color: var(--charcoal); margin: 0 0 12px; }
  .credit { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: var(--muted); margin: 0; text-decoration: underline; text-decoration-color: var(--tan); text-underline-offset: 3px; }
  .sub { font-size: 15px; line-height: 1.55; color: var(--charcoal); margin: 0; }
  .cta { margin-top: 20px; text-align: center; }
  .cta h2 { font-family: var(--font-display); font-weight: 500; font-size: 22px; line-height: 1.25; margin: 0 0 8px; }
  .cta p { font-size: 15px; line-height: 1.55; color: var(--charcoal); margin: 0 0 16px; }
  .btn { display: flex; align-items: center; justify-content: center; min-height: 52px; background: var(--clay); color: var(--cream); border-radius: var(--radius-pill); font-size: 16px; font-weight: 700; text-decoration: none; }
  .btn:active { transform: scale(0.98); }
  .btn-2 { margin-top: 10px; width: 100%; border: 1.5px solid var(--tan); background: transparent; color: var(--ink); font-family: var(--font-body); cursor: pointer; }
  .desk { display: none; font-size: 14px; line-height: 1.5; color: var(--charcoal); margin: 10px 0 0; }
  .fine { font-size: 13px; color: var(--muted); margin-top: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <a class="logo" href="/">nom</a>
  </div>
  <div class="card">
    ${hero}
    <div class="body">
      ${hidden ? '' : `<div class="who">${avatar}<span>${esc(byline)}</span></div>`}
      <h1>${esc(heading)}</h1>
      ${pills.length ? `<div class="pills">${pills.join('')}</div>` : ''}
      ${note}
      ${hidden ? `<p class="sub">${esc(byline)}</p>` : credit}
    </div>
  </div>
  <div class="cta">
    <h2>${hidden ? 'See what your friends are cooking' : `See the full ${thing} on Nom`}</h2>
    <p>Save recipes from anywhere, log what you actually cook, and see what your friends would make again.</p>
    <a class="btn" href="${APP_STORE_URL}">Get Nom on the App Store</a>
    <button class="btn btn-2" id="login" type="button">Already a member? Log in</button>
    <p class="desk" id="desk">Nom lives on the iPhone. Open this link on your iPhone to see the full ${thing}.</p>
    <p class="fine">${askLine}</p>
  </div>
</div>
<script>
  // Already a member: open Nom on this recipe or cook (Nom asks them to sign in first if needed,
  // then opens it). No Nom on this phone: go to the App Store instead of Safari's error.
  // On a computer: Nom lives on the iPhone, so say so.
  document.getElementById('login').addEventListener('click', function () {
    var ua = navigator.userAgent;
    var iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!iOS) { document.getElementById('desk').style.display = 'block'; return; }
    var left = false;
    document.addEventListener('visibilitychange', function () { if (document.hidden) left = true; });
    window.location.href = ${JSON.stringify(appUrl)};
    setTimeout(function () { if (!left && !document.hidden) window.location.href = ${JSON.stringify(APP_STORE_URL)}; }, 2000);
  });
</script>
</body>
</html>`
}

export default async function handler(req, res) {
  const kind = req.query.kind === 'cook' ? 'cook' : 'recipe'
  const id = String(req.query.id || '').trim()

  let data = null
  if (UUID.test(id)) {
    try { data = await loadPreview(kind, id) } catch (e) { console.error('share page', e) }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Cache briefly at Vercel's edge so a link posted in a group chat doesn't hit the database every tap,
  // but an edited photo or a switch to private shows up within a few minutes.
  // The plain card is never cached, so a link shows its preview as soon as the owner taps Share.
  const full = data && !data.private
  res.setHeader('Cache-Control', full ? 'public, s-maxage=300, stale-while-revalidate=600' : 'no-store')
  res.status(200).send(buildPage({ kind, id: UUID.test(id) ? id : '', data }))
}
