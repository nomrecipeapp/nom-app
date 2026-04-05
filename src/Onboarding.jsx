import { useState } from 'react'
import { supabase } from './supabase'

const TOTAL_STEPS = 5

function ProgressDots({ step }) {
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '16px' }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{
          height: '6px',
          width: i + 1 === step ? '18px' : '6px',
          borderRadius: i + 1 === step ? '3px' : '50%',
          background: i + 1 === step ? 'var(--clay)' : 'var(--tan)',
          transition: 'all 0.2s'
        }} />
      ))}
    </div>
  )
}

export default function Onboarding({ onComplete, session, prefillInviteCode }) {
  const [step, setStep] = useState(session ? 3 : prefillInviteCode ? 2 : 1)
  const [accountCreated, setAccountCreated] = useState(!!session)

  // Step 2 — account
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [userId, setUserId] = useState(session?.user?.id || null)
  const [inviteCode, setInviteCode] = useState(prefillInviteCode || '')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Step 3 — find cooks
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [requested, setRequested] = useState({})

  // Step 4 — first recipe
  const [recipeUrl, setRecipeUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importedRecipe, setImportedRecipe] = useState(null)
  const [importError, setImportError] = useState(null)

  // ── VALIDATION ──
  function validateStep2() {
    if (!fullName.trim()) return 'Please enter your name.'
    if (!username.trim()) return 'Please choose a username.'
    if (!email.trim()) return 'Please enter your email.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    return null
  }

  async function handleCreateAccount() {
    const validationError = validateStep2()
    if (validationError) { setAuthError(validationError); return }

    // Validate invite code
    const { data: invite } = await supabase
      .from('invites')
      .select('id, used_by')
      .eq('code', inviteCode.trim().toUpperCase())
      .maybeSingle()

    if (!invite) {
      setAuthError('That invite code is invalid. Ask a friend for one.')
      setAuthLoading(false)
      return
    }
    if (invite.used_by) {
      setAuthError('That invite code has already been used.')
      setAuthLoading(false)
      return
    }

    setAuthLoading(true)
    setAuthError(null)

    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingUsername) {
      setAuthError('That username is already taken. Try another one.')
      setAuthLoading(false)
      return
    }

    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingEmail) {
      setAuthError('An account with this email already exists. Try logging in instead.')
      setAuthLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setAuthError('An account with this email already exists. Try logging in instead.')
      } else {
        setAuthError(error.message)
      }
      setAuthLoading(false)
      return
    }

    const user = data?.user
    if (!user) { setAuthError('Something went wrong. Please try again.'); setAuthLoading(false); return }

    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      username: username || null,
      email: email,
      onboarding_complete: false
    })

    // Mark invite as used
    await supabase
      .from('invites')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('id', invite.id)

    // Generate 3 invite codes for the new user
    const codes = Array.from({ length: 3 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    )
    await supabase.from('invites').insert(
      codes.map(code => ({ code, created_by: user.id }))
    )

    setUserId(user.id)
    setAccountCreated(true)
    setAuthLoading(false)
    setStep('photo')
  }

  async function searchUsers(query) {
    setSearchQuery(query)
    if (query.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
      .neq('id', userId)
      .limit(5)
    setSearchResults(data || [])
  }

  async function sendFollowRequest(targetId) {
    await supabase.from('follows').insert({
      follower_id: userId,
      following_id: targetId,
      status: 'pending'
    })
    await supabase.from('notifications').insert({
      recipient_id: targetId,
      actor_id: userId,
      type: 'follow_request',
    })
    setRequested(prev => ({ ...prev, [targetId]: true }))
  }

async function importRecipe() {
    if (!recipeUrl.trim()) return
    setImporting(true)
    setImportError(null)
    try {
      const apiKey = import.meta.env.VITE_SPOONACULAR_KEY
      const res = await fetch(`https://api.spoonacular.com/recipes/extract?url=${encodeURIComponent(recipeUrl)}&apiKey=${apiKey}`)
      const data = await res.json()

      if (data.code === 402) {
        setImportError('Daily import limit reached. Try again tomorrow or add manually.')
        setImporting(false)
        return
      }

      setImportedRecipe({
        title: data.title || 'Untitled Recipe',
        source_url: recipeUrl,
        source_name: data.sourceName || new URL(recipeUrl).hostname.replace('www.', ''),
        image_url: data.image || null,
      })
    } catch {
      setImportError("Couldn't fetch that URL. Try another link.")
    }
    setImporting(false)
  }

  async function saveFirstRecipe() {
    if (!importedRecipe || !userId) return
    await supabase.from('recipes').insert({
      user_id: userId,
      title: importedRecipe.title,
      source_url: importedRecipe.source_url,
      source_name: importedRecipe.source_name,
      image_url: importedRecipe.image_url,
      status: 'want_to_make'
    })
    setStep(5)
  }

  async function finishOnboarding() {
    try {
      const id = userId || session?.user?.id
      if (id) {
        await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', id)
      }
    } catch (e) {
      console.log('Profile update error:', e)
    }
    onComplete()
  }

  const inputStyle = {
    width: '100%', padding: '13px 16px', border: '1.5px solid var(--tan)',
    borderRadius: 'var(--radius-md)', background: 'var(--parchment)',
    fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)',
    outline: 'none', boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: '700',
    color: 'var(--charcoal)', letterSpacing: '0.08em',
    textTransform: 'uppercase', marginBottom: '6px'
  }

  // ── STEP 1: WELCOME ──
  if (step === 1) return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)',
      display: 'flex', flexDirection: 'column',
      maxWidth: '480px', margin: '0 auto'
    }}>
      <div style={{
        background: 'linear-gradient(160deg, var(--clay) 0%, var(--ember) 60%, var(--parchment) 100%)',
        height: '45vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0
      }}>
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <ellipse cx="70" cy="95" rx="48" ry="14" fill="rgba(0,0,0,0.15)"/>
          <path d="M30 90 Q30 120 70 125 Q110 120 110 90" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
          <ellipse cx="70" cy="90" rx="40" ry="12" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
          <path d="M45 82 Q55 75 65 82 Q75 75 85 82 Q95 75 100 82" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <path d="M48 88 Q58 81 68 88 Q78 81 90 88" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <line x1="88" y1="60" x2="105" y2="90" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="94" y1="58" x2="110" y2="86" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M55 65 Q52 55 55 45" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M70 62 Q67 52 70 42" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M85 65 Q82 55 85 45" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" fill="none"/>
        </svg>
      </div>

      <div style={{ flex: 1, padding: '32px 28px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', fontWeight: '700', color: 'var(--clay)', letterSpacing: '-1.5px', marginBottom: '12px' }}>Nom</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.2', marginBottom: '12px' }}>What's cookin'<br />good lookin'?</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6' }}>Finally, a place for all the recipes you've been meaning to cook.</div>
        </div>
        <div>
          <ProgressDots step={1} />
          <button onClick={() => setStep(2)} style={{
            width: '100%', padding: '15px', background: 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)',
            fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginBottom: '10px'
          }}>Let's go</button>
          <button onClick={() => onComplete('login')} style={{
            width: '100%', padding: '10px', background: 'none', border: 'none',
            fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer'
          }}>I already have an account</button>
        </div>
      </div>
    </div>
  )

  // ── STEP 2: CREATE ACCOUNT ──
  if (step === 2) return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)', display: 'flex',
      flexDirection: 'column', maxWidth: '480px', margin: '0 auto',
      padding: '48px 28px 120px'
    }}>
      <button onClick={() => setStep(1)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '6px',
        color: 'var(--muted)', fontFamily: 'var(--font-body)',
        fontSize: '13px', fontWeight: '600', padding: '0 0 24px'
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </button>

      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>Create your account</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '28px' }}>Your Cookbook starts here.</div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Your name</label>
        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Alex" style={inputStyle} />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Username</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>@</span>
          <input type="text" value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="alexcooks"
            style={{ ...inputStyle, paddingLeft: '28px' }} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Letters, numbers, and underscores only</div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={labelStyle}>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px' }}>Must be at least 8 characters</div>

      <div style={{ marginBottom: '24px' }}>
        <label style={labelStyle}>Invite Code</label>
        <input
          type="text"
          value={inviteCode}
          onChange={e => setInviteCode(e.target.value.trim().toUpperCase())}
          placeholder="XXXXXXXX"
          style={{ ...inputStyle, letterSpacing: '0.1em' }}
        />
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
          You need an invite code to join Nom.
        </div>
      </div>
      {authError && (
        <div style={{
          background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)',
          padding: '12px 16px', fontSize: '13px', color: '#B85252', marginBottom: '16px'
        }}>{authError}</div>
      )}

      <ProgressDots step={2} />
      <button onClick={handleCreateAccount}
        disabled={authLoading || !fullName || !username || !email || !password}
        style={{
          width: '100%', padding: '15px',
          background: (authLoading || !fullName || !username || !email || !password) ? 'var(--tan)' : 'var(--clay)',
          color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
          cursor: (authLoading || !fullName || !username || !email || !password) ? 'not-allowed' : 'pointer',
          marginBottom: '10px'
        }}
      >{authLoading ? 'Creating account...' : 'Create Account'}</button>
      <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', lineHeight: '1.5' }}>
        By continuing you agree to our{' '}
        <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=61e1bda6-9414-4896-bd55-972479e2c5ee" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--clay)', textDecoration: 'underline' }}>Terms</a>
        {' & '}
        <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=758a4b17-ed24-4c70-acda-5aaa6c508907" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--clay)', textDecoration: 'underline' }}>Privacy Policy</a>
      </div>
    </div>
  )

  // ── STEP 2.5: PROFILE PHOTO ──
  if (step === 'photo') {
    const initial = (fullName || '?')[0].toUpperCase()

    const handlePhotoUpload = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      setAvatarUploading(true)
      try {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${userId}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId)
        setAvatarUrl(data.publicUrl)
      } catch (err) {
        console.error('Avatar upload failed:', err)
      }
      setAvatarUploading(false)
          e.target.value = ''
      }

      return (
      <div style={{
        minHeight: '100vh', background: 'var(--cream)', display: 'flex',
        flexDirection: 'column', maxWidth: '480px', margin: '0 auto',
        padding: '48px 28px 40px'
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.2', marginBottom: '8px', textAlign: 'center' }}>
            Put a face to the name.
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '40px', textAlign: 'center', lineHeight: '1.6' }}>
            Help your friends recognize you.
          </div>

          {/* Avatar */}
          <input
            id="onboarding-avatar"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />
          <label htmlFor="onboarding-avatar" style={{ cursor: 'pointer', marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{
                  width: '120px', height: '120px', borderRadius: '50%',
                  objectFit: 'cover',
                  boxShadow: '0 0 0 4px var(--cream), 0 0 0 6px var(--clay)'
                }} />
              ) : (
                <div style={{
                  width: '120px', height: '120px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: '48px', fontWeight: '700',
                  color: 'var(--cream)',
                  boxShadow: '0 0 0 4px var(--cream), 0 0 0 6px var(--tan)'
                }}>{initial}</div>
              )}
              <div style={{
                position: 'absolute', bottom: '4px', right: '4px',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--clay)', border: '3px solid var(--cream)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {avatarUploading
                  ? <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2.5"/></svg>
                }
              </div>
            </div>
          </label>

          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
            {avatarUploading ? 'Uploading...' : avatarUrl ? 'Tap to change' : 'Tap to add a photo'}
          </div>

        </div>

        <div>
          <ProgressDots step={2} />
          <button onClick={() => setStep(3)} style={{
            width: '100%', padding: '15px',
            background: avatarUrl ? 'var(--clay)' : 'var(--clay)',
            color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
            cursor: 'pointer', marginBottom: '10px'
          }}>{avatarUrl ? 'Continue' : 'Continue'}</button>
          {!avatarUrl && (
            <button onClick={() => setStep(3)} style={{
              width: '100%', padding: '10px', background: 'none', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer'
            }}>Skip for now</button>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── STEP 3: FIND FELLOW COOKS ──
  if (step === 3) return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)', display: 'flex',
      flexDirection: 'column', maxWidth: '480px', margin: '0 auto', padding: '48px 28px 40px'
    }}>
      {/* Only show back if account hasn't been created yet */}
      {!accountCreated && (
        <button onClick={() => setStep(2)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
          color: 'var(--muted)', fontFamily: 'var(--font-body)',
          fontSize: '13px', fontWeight: '600', padding: '0 0 24px'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      )}
      {accountCreated && <div style={{ paddingBottom: '24px' }} />}

      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.2', marginBottom: '4px' }}>Find fellow<br />friendly cooks.</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>Nom is private by default — send a request to cook together.</div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--parchment)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px', border: '1.5px solid var(--tan)'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
            <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input type="text" value={searchQuery} onChange={e => searchUsers(e.target.value)}
            placeholder="Search by name or username" style={{
              flex: 1, border: 'none', background: 'none',
              fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', outline: 'none'
            }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {searchResults.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--parchment)', borderRadius: 'var(--radius-md)', padding: '12px 14px'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700',
                color: 'var(--cream)', flexShrink: 0
              }}>{(u.full_name || u.username || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{u.full_name || u.username}</div>
                {u.username && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{u.username}</div>}
              </div>
              <button onClick={() => !requested[u.id] && sendFollowRequest(u.id)} style={{
                padding: '7px 14px',
                background: requested[u.id] ? '#EEF4E5' : 'var(--clay)',
                color: requested[u.id] ? 'var(--forest)' : 'var(--cream)',
                border: 'none', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
                cursor: requested[u.id] ? 'default' : 'pointer'
              }}>{requested[u.id] ? 'Sent ✓' : '+ Request'}</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <ProgressDots step={3} />
        <button onClick={() => setStep(4)} style={{
          width: '100%', padding: '15px', background: 'var(--clay)', color: 'var(--cream)',
          border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)',
          fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginBottom: '10px'
        }}>Continue</button>
        <button onClick={() => setStep(4)} style={{
          width: '100%', padding: '10px', background: 'none', border: 'none',
          fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer'
        }}>Skip for now</button>
      </div>
    </div>
  )

  // ── STEP 4: FIRST RECIPE ──
  if (step === 4) return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)', display: 'flex',
      flexDirection: 'column', maxWidth: '480px', margin: '0 auto', padding: '48px 28px 40px'
    }}>
      <button onClick={() => setStep(3)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '6px',
        color: 'var(--muted)', fontFamily: 'var(--font-body)',
        fontSize: '13px', fontWeight: '600', padding: '0 0 24px'
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </button>

      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.2', marginBottom: '4px' }}>Ready to chef<br />it up?</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>Save your first recipe to your Cookbook.</div>

        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--charcoal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Paste a link</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="url" value={recipeUrl}
              onChange={e => { setRecipeUrl(e.target.value); setImportedRecipe(null); setImportError(null) }}
              placeholder="https://nytcooking.com/recipe..."
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={importRecipe} disabled={importing || !recipeUrl.trim()} style={{
              padding: '13px 16px',
              background: importing || !recipeUrl.trim() ? 'var(--tan)' : 'var(--clay)',
              color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
              cursor: importing || !recipeUrl.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
            }}>{importing ? '...' : 'Import'}</button>
          </div>
        </div>

        {importError && <div style={{ fontSize: '12px', color: '#B85252', marginBottom: '12px' }}>{importError}</div>}

        {importedRecipe && (
          <div style={{
            background: 'var(--warm-white)', border: '1px solid var(--parchment)',
            borderRadius: 'var(--radius-md)', padding: '14px', marginTop: '12px'
          }}>
            {importedRecipe.image_url && (
              <img src={importedRecipe.image_url} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
            )}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--ink)', marginBottom: '4px' }}>{importedRecipe.title}</div>
            {importedRecipe.source_name && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{importedRecipe.source_name}</div>}
          </div>
        )}
      </div>

      <div style={{ paddingTop: '24px' }}>
        <ProgressDots step={4} />
        <button
          onClick={importedRecipe ? saveFirstRecipe : () => setStep(5)}
          style={{
            width: '100%', padding: '15px', background: 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)',
            fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginBottom: '12px'
          }}
        >{importedRecipe ? 'Save to Cookbook' : 'Skip for now'}</button>
        {importedRecipe && (
          <button onClick={() => setStep(5)} style={{
            width: '100%', padding: '8px', background: 'none', border: 'none',
            fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer'
          }}>I'll do this later</button>
        )}
      </div>
    </div>
  )

  // ── STEP 5: YOU'RE IN ──
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)', display: 'flex',
      flexDirection: 'column', maxWidth: '480px', margin: '0 auto'
    }}>
      {/* Illustration area — warm kitchen scene */}
      <div style={{
        background: 'linear-gradient(160deg, var(--clay) 0%, var(--ember) 55%, var(--parchment) 100%)',
        height: '52vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, position: 'relative', overflow: 'hidden'
      }}>
        <svg width="280" height="220" viewBox="0 0 280 220" fill="none">
          {/* Counter surface */}
          <rect x="0" y="158" width="280" height="62" fill="rgba(255,255,255,0.12)" />
          <line x1="0" y1="158" x2="280" y2="158" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />

          {/* Cutting board */}
          <rect x="28" y="136" width="82" height="44" rx="5" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          {/* Knife on board */}
          <path d="M42 148 L96 156" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
          <path d="M41 148 Q39 145 41 143 L96 150 L96 156 Z" fill="rgba(255,255,255,0.28)" />
          {/* Herbs on board */}
          <path d="M60 148 Q63 139 61 132" stroke="#7A8C6E" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85" />
          <ellipse cx="61" cy="131" rx="7" ry="4.5" fill="#7A8C6E" opacity="0.75" transform="rotate(-15 61 131)" />
          <path d="M72 150 Q75 141 73 134" stroke="#7A8C6E" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85" />
          <ellipse cx="73" cy="133" rx="7" ry="4.5" fill="#7A8C6E" opacity="0.75" transform="rotate(-10 73 133)" />

          {/* Small jar */}
          <rect x="116" y="142" width="22" height="26" rx="4" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
          <rect x="113" y="138" width="28" height="6" rx="3" fill="rgba(255,255,255,0.28)" />

          {/* Pot */}
          <ellipse cx="196" cy="145" rx="36" ry="10" fill="rgba(255,255,255,0.2)" />
          <path d="M160 142 Q160 176 196 182 Q232 176 232 142" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
          <ellipse cx="196" cy="142" rx="36" ry="9" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
          {/* Pot handles */}
          <path d="M160 142 Q150 142 150 148 Q150 154 160 154" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
          <path d="M232 142 Q242 142 242 148 Q242 154 232 154" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />

          {/* Steam — animated via CSS */}
          <path className="steam1" d="M178 134 Q174 124 178 114" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" strokeLinecap="round" fill="none">
            <animateTransform attributeName="transform" type="translate" values="0,0; 2,-8; 0,0" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0.15;0.45" dur="2.4s" repeatCount="indefinite" />
          </path>
          <path d="M196 131 Q192 121 196 111" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round" fill="none">
            <animateTransform attributeName="transform" type="translate" values="0,0; -2,-8; 0,0" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.55;0.2;0.55" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M214 134 Q210 124 214 114" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" strokeLinecap="round" fill="none">
            <animateTransform attributeName="transform" type="translate" values="0,0; 1,-8; 0,0" dur="2.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0.15;0.45" dur="2.8s" repeatCount="indefinite" />
          </path>

          {/* Nom wordmark */}
          <text x="28" y="108" fontFamily="serif" fontSize="36" fontWeight="bold" fill="rgba(255,255,255,0.88)" letterSpacing="-1.5">nom</text>
        </svg>
      </div>

      {/* Text + CTA */}
      <div style={{ flex: 1, padding: '32px 28px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '700',
            color: 'var(--ink)', lineHeight: '1.15', marginBottom: '10px'
          }}>Your Cookbook<br />is open.</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6' }}>
            Now go find something delicious.
          </div>
        </div>
        <div>
          <ProgressDots step={5} />
          <button onClick={finishOnboarding} style={{
            width: '100%', padding: '15px', background: 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)',
            fontSize: '15px', fontWeight: '700', cursor: 'pointer'
          }}>Take me in</button>
        </div>
      </div>
    </div>
  )
}