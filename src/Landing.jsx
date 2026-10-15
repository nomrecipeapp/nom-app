// Public homepage for logged-out web visitors (nomrecipeapp.com).
// Shown only on the web, never inside the iOS app. Logged-in users never see it.
// Apple checks this page during organization enrollment, so it must explain
// what Nom is and who makes it (SPB STUDIO LLC).

const PRIVACY_URL = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=758a4b17-ed24-4c70-acda-5aaa6c508907'
const TERMS_URL = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=61e1bda6-9414-4896-bd55-972479e2c5ee'
const CONTACT_EMAIL = 'hello@nomrecipeapp.com'

const css = `
  .nl { background: var(--cream); color: var(--ink); font-family: var(--font-body); min-height: 100vh; }
  .nl-wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
  .nl-nav { display: flex; align-items: center; justify-content: space-between; padding: 20px 0; padding-top: calc(20px + env(safe-area-inset-top)); }
  .nl-logo { font-family: var(--font-display); font-weight: 700; font-size: 30px; color: var(--clay); letter-spacing: -1px; line-height: 1; }
  .nl-signin { background: none; border: 1.5px solid var(--tan); color: var(--charcoal); border-radius: var(--radius-pill); padding: 9px 18px; font-family: var(--font-body); font-size: 14px; font-weight: 600; cursor: pointer; }
  .nl-signin:active, .nl-btn:active, .nl-btn-ghost:active { transform: scale(0.98); }

  .nl-hero { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center; padding: 32px 0 56px; }
  .nl-pill { display: inline-flex; align-items: center; gap: 8px; background: var(--parchment); border: 1px solid var(--tan); color: var(--charcoal); border-radius: var(--radius-pill); padding: 6px 14px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
  .nl-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sage); }
  .nl-h1 { font-family: var(--font-display); font-weight: 700; font-size: clamp(40px, 9vw, 64px); line-height: 1.02; letter-spacing: -1.5px; margin: 0 0 18px; }
  .nl-h1 em { font-style: italic; font-weight: 400; color: var(--clay); }
  .nl-lede { font-size: 17px; line-height: 1.65; color: var(--charcoal); max-width: 480px; margin: 0 0 28px; }
  .nl-ctas { display: flex; flex-direction: column; gap: 10px; max-width: 360px; }
  .nl-btn { background: var(--clay); color: var(--cream); border: none; border-radius: var(--radius-pill); padding: 15px 24px; font-family: var(--font-body); font-size: 15px; font-weight: 700; cursor: pointer; }
  .nl-btn-ghost { background: transparent; color: var(--clay); border: 2px solid var(--clay); border-radius: var(--radius-pill); padding: 13px 24px; font-family: var(--font-body); font-size: 15px; font-weight: 600; cursor: pointer; }
  .nl-note { font-size: 13px; color: var(--muted); margin-top: 14px; }

  .nl-phone { justify-self: center; width: 100%; max-width: 330px; background: var(--ink); border-radius: 40px; padding: 12px; box-shadow: 0 24px 60px rgba(28,26,23,0.22); }
  .nl-screen { background: var(--cream); border-radius: 30px; overflow: hidden; }
  .nl-screen-top { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px 10px; }
  .nl-screen-logo { font-family: var(--font-display); font-weight: 700; font-size: 20px; color: var(--clay); }
  .nl-post { margin: 0 12px 12px; background: var(--warm-white); border: 1px solid var(--parchment); border-radius: var(--radius-md); overflow: hidden; }
  .nl-post-head { display: flex; align-items: center; gap: 9px; padding: 11px 12px; }
  .nl-av { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 700; font-size: 12px; color: var(--cream); flex-shrink: 0; }
  .nl-post-name { font-size: 12px; font-weight: 600; }
  .nl-post-time { font-size: 10px; color: var(--muted); }
  .nl-post-img { height: 132px; }
  .nl-post-body { padding: 11px 12px 13px; }
  .nl-verdict { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--radius-pill); padding: 4px 10px; font-size: 11px; font-weight: 600; margin-bottom: 7px; }
  .nl-post-title { font-family: var(--font-display); font-size: 16px; font-weight: 500; margin-bottom: 4px; }
  .nl-post-note { font-size: 12px; color: var(--charcoal); line-height: 1.5; font-style: italic; }

  .nl-section { padding: 56px 0; border-top: 1px solid var(--parchment); }
  .nl-label { font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .nl-h2 { font-family: var(--font-display); font-weight: 500; font-size: clamp(28px, 6vw, 38px); line-height: 1.15; letter-spacing: -0.5px; margin: 0 0 32px; max-width: 620px; }
  .nl-grid3 { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .nl-card { background: var(--warm-white); border: 1px solid var(--parchment); border-radius: var(--radius-lg); padding: 24px; }
  .nl-card-icon { width: 40px; height: 40px; border-radius: 12px; background: #F2E0D1; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
  .nl-card h3 { font-family: var(--font-display); font-size: 20px; font-weight: 500; margin: 0 0 6px; }
  .nl-card p { font-size: 14px; color: var(--charcoal); line-height: 1.6; margin: 0; }

  .nl-verdicts { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .nl-vcard { border-radius: var(--radius-md); padding: 22px 18px; text-align: center; border: 2px solid; }
  .nl-vcard-label { font-family: var(--font-display); font-size: 18px; font-weight: 500; margin-top: 10px; }
  .nl-vcard-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }

  .nl-band { background: var(--parchment); border: 1px solid var(--tan); border-radius: var(--radius-lg); padding: 36px 28px; position: relative; overflow: hidden; }
  .nl-band-word { position: absolute; right: -10px; bottom: -36px; font-family: var(--font-display); font-weight: 700; font-size: 150px; letter-spacing: -5px; color: var(--tan); line-height: 1; pointer-events: none; }
  .nl-band-inner { position: relative; z-index: 1; max-width: 520px; }

  .nl-foot { padding: 40px 0 calc(48px + env(safe-area-inset-bottom)); border-top: 1px solid var(--tan); margin-top: 56px; }
  .nl-foot-links { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 14px 0 18px; }
  .nl-foot a { color: var(--charcoal); font-size: 14px; font-weight: 500; text-decoration: underline; text-decoration-color: var(--tan); text-underline-offset: 3px; }
  .nl-legal { font-size: 12px; color: var(--muted); line-height: 1.6; }

  @media (min-width: 760px) {
    .nl-wrap { padding: 0 32px; }
    .nl-hero { grid-template-columns: 1.1fr 0.9fr; padding: 56px 0 80px; }
    .nl-ctas { flex-direction: row; max-width: none; }
    .nl-grid3, .nl-verdicts { grid-template-columns: repeat(3, 1fr); }
    .nl-band { padding: 48px; }
  }
`

function FaceIcon({ mood, stroke, fill, size = 40 }) {
  const mouth = mood === 'happy'
    ? <path d="M11 19c1.5 2.5 4 4 7 4s5.5-1.5 7-4" stroke={fill} strokeWidth="2" strokeLinecap="round" />
    : mood === 'meh'
      ? <line x1="12" y1="22" x2="24" y2="22" stroke={fill} strokeWidth="2" strokeLinecap="round" />
      : <path d="M11 22c1.5-2.5 4-4 7-4s5.5 1.5 7 4" stroke={fill} strokeWidth="2" strokeLinecap="round" />
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="16" stroke={stroke} strokeWidth="2" />
      {mouth}
      <circle cx="13" cy="15" r="1.5" fill={fill} />
      <circle cx="23" cy="15" r="1.5" fill={fill} />
    </svg>
  )
}

function PhoneMock() {
  return (
    <div className="nl-phone" aria-hidden="true">
      <div className="nl-screen">
        <div className="nl-screen-top">
          <span className="nl-screen-logo">Nom</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>Feed</span>
        </div>
        <div className="nl-post">
          <div className="nl-post-head">
            <div className="nl-av" style={{ background: 'linear-gradient(135deg, var(--clay), var(--ember))' }}>J</div>
            <div><div className="nl-post-name">Jamie cooked</div><div className="nl-post-time">2 hours ago</div></div>
          </div>
          <div className="nl-post-img" style={{ background: 'linear-gradient(160deg, var(--rust) 0%, var(--ember) 55%, var(--tan) 100%)' }} />
          <div className="nl-post-body">
            <div className="nl-verdict" style={{ background: '#EEF4E5', border: '1px solid var(--sage)', color: 'var(--forest)' }}>
              <FaceIcon mood="happy" stroke="var(--sage)" fill="var(--forest)" size={13} /> Would Make Again
            </div>
            <div className="nl-post-title">Spicy Peanut Noodles</div>
            <div className="nl-post-note">"Added chili crisp on top. Doubling the sauce next time."</div>
          </div>
        </div>
        <div className="nl-post">
          <div className="nl-post-head">
            <div className="nl-av" style={{ background: 'linear-gradient(135deg, var(--sage), var(--forest))' }}>M</div>
            <div><div className="nl-post-name">Maya cooked</div><div className="nl-post-time">Yesterday</div></div>
          </div>
          <div className="nl-post-body" style={{ paddingTop: 0 }}>
            <div className="nl-verdict" style={{ background: '#FBF0E6', border: '1px solid var(--ember)', color: 'var(--clay)' }}>
              <FaceIcon mood="meh" stroke="var(--ember)" fill="var(--clay)" size={13} /> It Was Fine
            </div>
            <div className="nl-post-title">Sheet Pan Gnocchi</div>
            <div className="nl-post-note">"Easy weeknight, but needed way more salt."</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const features = [
  {
    title: 'Save from anywhere',
    body: 'Paste a link from any recipe site, TikTok or Instagram, or snap a photo of a cookbook page. Nom pulls out the ingredients and steps for you.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--rust)" strokeWidth="2.2" strokeLinecap="round" /></svg>,
  },
  {
    title: 'Log what you cook',
    body: 'Every time you make something, give it a verdict, rate the details and add notes: the swaps, the shortcuts, the "skip step 3."',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14zM4 19.5A2.5 2.5 0 006.5 22H20v-5" stroke="var(--rust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    title: 'Cook with your circle',
    body: 'Follow friends, see what they actually made this week and how it went, and save their winners straight into your own cookbook.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="var(--rust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" stroke="var(--rust)" strokeWidth="2" /></svg>,
  },
]

const verdicts = [
  { mood: 'happy', label: 'Would Make Again', sub: 'A keeper', bg: '#EEF4E5', border: 'var(--sage)', stroke: 'var(--sage)', fill: 'var(--forest)' },
  { mood: 'meh', label: 'It Was Fine', sub: 'No regrets, no encore', bg: '#FBF0E6', border: 'var(--ember)', stroke: 'var(--ember)', fill: 'var(--clay)' },
  { mood: 'sad', label: 'Never Again', sub: 'Duly noted', bg: '#F4E8E8', border: '#C47070', stroke: '#C47070', fill: '#9B4040' },
]

export default function Landing({ onGetStarted, onSignIn }) {
  return (
    <div className="nl">
      <style>{css}</style>
      <div className="nl-wrap">

        <nav className="nl-nav">
          <div className="nl-logo">Nom</div>
          <button className="nl-signin" onClick={onSignIn}>Sign in</button>
        </nav>

        <header className="nl-hero">
          <div>
            <div className="nl-pill"><span className="nl-pill-dot" />Coming soon to the App Store</div>
            <h1 className="nl-h1">Find it. Cook it. <em>Share it.</em></h1>
            <p className="nl-lede">
              Nom is your living cookbook. Save recipes from anywhere, keep an honest record of what you actually cook, and see what your friends are making.
            </p>
            <div className="nl-ctas">
              <button className="nl-btn" onClick={onGetStarted}>I have an invite</button>
              <button className="nl-btn-ghost" onClick={onSignIn}>Sign in</button>
            </div>
            <div className="nl-note">Nom is invite-only for now. Ask a friend on Nom for a code.</div>
          </div>
          <PhoneMock />
        </header>

        <section className="nl-section">
          <div className="nl-label">How it works</div>
          <h2 className="nl-h2">Your recipes, your verdicts, your people.</h2>
          <div className="nl-grid3">
            {features.map(f => (
              <div key={f.title} className="nl-card">
                <div className="nl-card-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="nl-section">
          <div className="nl-label">The verdict</div>
          <h2 className="nl-h2">Honest ratings from people who actually made it.</h2>
          <div className="nl-verdicts">
            {verdicts.map(v => (
              <div key={v.label} className="nl-vcard" style={{ background: v.bg, borderColor: v.border }}>
                <FaceIcon mood={v.mood} stroke={v.stroke} fill={v.fill} />
                <div className="nl-vcard-label">{v.label}</div>
                <div className="nl-vcard-sub">{v.sub}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="nl-section">
          <div className="nl-band">
            <div className="nl-band-word" aria-hidden="true">nom</div>
            <div className="nl-band-inner">
              <h2 className="nl-h2" style={{ marginBottom: '12px' }}>Friends over algorithms.</h2>
              <p className="nl-lede" style={{ marginBottom: '24px' }}>
                No trending feed, no strangers. Just the people you follow and what they really thought of dinner.
              </p>
              <button className="nl-btn" onClick={onGetStarted}>I have an invite</button>
            </div>
          </div>
        </section>

        <footer className="nl-foot">
          <div className="nl-logo" style={{ fontSize: '24px' }}>Nom</div>
          <div className="nl-foot-links">
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms of Service</a>
          </div>
          <div className="nl-legal">
            Nom is made by SPB STUDIO LLC, Chicago, Illinois.<br />
            Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.<br />
            © {new Date().getFullYear()} SPB STUDIO LLC. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  )
}
