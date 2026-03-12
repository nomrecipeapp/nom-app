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

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1)

  // Step 2 — account
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [userId, setUserId] = useState(null)

  // Step 3 — find cooks
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [requested, setRequested] = useState({})

  // Step 4 — first recipe
  const [recipeUrl, setRecipeUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importedRecipe, setImportedRecipe] = useState(null)
  const [importError, setImportError] = useState(null)

  async function handleCreateAccount() {
    setAuthLoading(true)
    setAuthError(null)

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setAuthError(error.message); setAuthLoading(false); return }

    const user = data?.user
    if (!user) { setAuthError('Something went wrong. Please try again.'); setAuthLoading(false); return }

    // Create profile
    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      onboarding_complete: false
    })

    setUserId(user.id)
    setAuthLoading(false)
    setStep(3)
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
    setRequested(prev => ({ ...prev, [targetId]: true }))
  }

  async function importRecipe() {
    if (!recipeUrl.trim()) return
    setImporting(true)
    setImportError(null)
    try {
      const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(recipeUrl)}`)
      const json = await res.json()
      const meta = json.data
      setImportedRecipe({
        title: meta?.title || 'Untitled Recipe',
        source_url: recipeUrl,
        source_name: meta?.publisher || new URL(recipeUrl).hostname.replace('www.', ''),
        image_url: meta?.image?.url || null,
      })
    } catch {
      setImportError('Couldn\'t fetch that URL. Try another link.')
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
      if (userId) {
        await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId)
      }
    } catch (e) {
      console.log('Profile update error:', e)
    }
    onComplete()
  }

  // ── STEP 1: WELCOME ──
  if (step === 1) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '480px',
      margin: '0 auto'
    }}>
      {/* Hero illustration */}
      <div style={{
        background: 'linear-gradient(160deg, var(--clay) 0%, var(--ember) 60%, var(--parchment) 100%)',
        height: '45vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
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

      {/* Content */}
      <div style={{ flex: 1, padding: '32px 28px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '40px',
            fontWeight: '700',
            color: 'var(--clay)',
            letterSpacing: '-1.5px',
            marginBottom: '12px'
          }}>Nom</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: '700',
            color: 'var(--ink)',
            lineHeight: '1.2',
            marginBottom: '12px'
          }}>What's cookin'<br />good lookin'?</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6' }}>
            Finally, a place for all the recipes you've been meaning to cook.
          </div>
        </div>

        <div>
          <ProgressDots step={1} />
          <button onClick={() => setStep(2)} style={{
            width: '100%', padding: '15px',
            background: 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
            cursor: 'pointer', marginBottom: '10px'
          }}>Let's go</button>
          <button onClick={() => onComplete('login')} style={{
            width: '100%', padding: '10px',
            background: 'none', border: 'none',
            fontFamily: 'var(--font-body)', fontSize: '13px',
            color: 'var(--muted)', cursor: 'pointer'
          }}>I already have an account</button>
        </div>
      </div>
    </div>
  )

  // ── STEP 2: CREATE ACCOUNT ──
  if (step === 2) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '480px',
      margin: '0 auto',
      padding: '48px 28px 40px'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px', fontWeight: '700',
          color: 'var(--ink)', marginBottom: '4px'
        }}>Create your account</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '28px' }}>
          Your Cookbook starts here.
        </div>

        {/* Name */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--charcoal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Your name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Alex"
            style={{
              width: '100%', padding: '13px 16px',
              border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
              background: 'var(--parchment)', fontFamily: 'var(--font-body)',
              fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Email */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--charcoal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%', padding: '13px 16px',
              border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
              background: 'var(--parchment)', fontFamily: 'var(--font-body)',
              fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--charcoal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: '100%', padding: '13px 16px',
              border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
              background: 'var(--parchment)', fontFamily: 'var(--font-body)',
              fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {authError && (
          <div style={{
            background: '#FDE8E8', border: '1px solid #F5C0C0',
            borderRadius: 'var(--radius-md)', padding: '12px 16px',
            fontSize: '13px', color: '#B85252', marginBottom: '16px'
          }}>{authError}</div>
        )}
      </div>

      <div>
        <ProgressDots step={2} />
        <button
          onClick={handleCreateAccount}
          disabled={authLoading || !fullName || !email || !password}
          style={{
            width: '100%', padding: '15px',
            background: (authLoading || !fullName || !email || !password) ? 'var(--tan)' : 'var(--clay)',
            color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
            cursor: (authLoading || !fullName || !email || !password) ? 'not-allowed' : 'pointer',
            marginBottom: '10px'
          }}
        >{authLoading ? 'Creating account...' : 'Create Account'}</button>
        <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', lineHeight: '1.5' }}>
          By continuing you agree to our Terms & Privacy Policy
        </div>
      </div>
    </div>
  )

  // ── STEP 3: FIND FELLOW COOKS ──
  if (step === 3) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '480px',
      margin: '0 auto',
      padding: '48px 28px 40px'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px', fontWeight: '700',
          color: 'var(--ink)', lineHeight: '1.2', marginBottom: '4px'
        }}>Find fellow<br />friendly cooks.</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
          Nom is private by default — send a request to cook together.
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--parchment)', borderRadius: 'var(--radius-md)',
          padding: '12px 16px', marginBottom: '16px',
          border: '1.5px solid var(--tan)'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="var(--muted)" strokeWidth="1.8"/>
            <path d="M16.5 16.5L21 21" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => searchUsers(e.target.value)}
            placeholder="Search by name or username"
            style={{
              flex: 1, border: 'none', background: 'none',
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--ink)', outline: 'none'
            }}
          />
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {searchResults.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--parchment)', borderRadius: 'var(--radius-md)',
              padding: '12px 14px'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--clay), var(--ember))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700',
                color: 'var(--cream)', flexShrink: 0
              }}>
                {(u.full_name || u.username || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{u.full_name || u.username}</div>
                {u.username && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>@{u.username}</div>}
              </div>
              <button
                onClick={() => !requested[u.id] && sendFollowRequest(u.id)}
                style={{
                  padding: '7px 14px',
                  background: requested[u.id] ? '#EEF4E5' : 'var(--clay)',
                  color: requested[u.id] ? 'var(--forest)' : 'var(--cream)',
                  border: 'none', borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600',
                  cursor: requested[u.id] ? 'default' : 'pointer'
                }}
              >{requested[u.id] ? 'Sent ✓' : '+ Request'}</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <ProgressDots step={3} />
        <button onClick={() => setStep(4)} style={{
          width: '100%', padding: '15px',
          background: 'var(--clay)', color: 'var(--cream)',
          border: 'none', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
          cursor: 'pointer', marginBottom: '10px'
        }}>Continue</button>
        <button onClick={() => setStep(4)} style={{
          width: '100%', padding: '10px',
          background: 'none', border: 'none',
          fontFamily: 'var(--font-body)', fontSize: '13px',
          color: 'var(--muted)', cursor: 'pointer'
        }}>Skip for now</button>
      </div>
    </div>
  )

  // ── STEP 4: FIRST RECIPE ──
  if (step === 4) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '480px',
      margin: '0 auto',
      padding: '48px 28px 40px'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px', fontWeight: '700',
          color: 'var(--ink)', lineHeight: '1.2', marginBottom: '4px'
        }}>Ready to chef<br />it up?</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
          Save your first recipe to your Cookbook.
        </div>

        {/* URL paste */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--charcoal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Paste a link</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              value={recipeUrl}
              onChange={e => { setRecipeUrl(e.target.value); setImportedRecipe(null); setImportError(null) }}
              placeholder="https://nytcooking.com/recipe..."
              style={{
                flex: 1, padding: '13px 16px',
                border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
                background: 'var(--parchment)', fontFamily: 'var(--font-body)',
                fontSize: '13px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box'
              }}
            />
            <button
              onClick={importRecipe}
              disabled={importing || !recipeUrl.trim()}
              style={{
                padding: '13px 16px',
                background: importing || !recipeUrl.trim() ? 'var(--tan)' : 'var(--clay)',
                color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600',
                cursor: importing || !recipeUrl.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >{importing ? '...' : 'Import'}</button>
          </div>
        </div>

        {importError && (
          <div style={{ fontSize: '12px', color: '#B85252', marginBottom: '12px' }}>{importError}</div>
        )}

        {/* Imported preview */}
        {importedRecipe && (
          <div style={{
            background: 'var(--warm-white)', border: '1px solid var(--parchment)',
            borderRadius: 'var(--radius-md)', padding: '14px',
            marginBottom: '16px', marginTop: '12px'
          }}>
            {importedRecipe.image_url && (
              <img src={importedRecipe.image_url} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
            )}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--ink)', marginBottom: '4px' }}>{importedRecipe.title}</div>
            {importedRecipe.source_name && (
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{importedRecipe.source_name}</div>
            )}
          </div>
        )}
      </div>

      <div>
        <ProgressDots step={4} />
        {importedRecipe ? (
          <button onClick={saveFirstRecipe} style={{
            width: '100%', padding: '15px',
            background: 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
            cursor: 'pointer', marginBottom: '10px'
          }}>Save Recipe</button>
        ) : (
          <button onClick={() => setStep(5)} style={{
            width: '100%', padding: '15px',
            background: 'var(--clay)', color: 'var(--cream)',
            border: 'none', borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
            cursor: 'pointer', marginBottom: '10px'
          }}>Save Recipe</button>
        )}
        <button onClick={() => setStep(5)} style={{
          width: '100%', padding: '10px',
          background: 'none', border: 'none',
          fontFamily: 'var(--font-body)', fontSize: '13px',
          color: 'var(--muted)', cursor: 'pointer'
        }}>I'll do it later</button>
      </div>
    </div>
  )

  // ── STEP 5: YOU'RE IN ──
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--clay) 0%, var(--rust) 50%, var(--ink) 100%)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '480px',
      margin: '0 auto',
      padding: '60px 28px 40px'
    }}>
      {/* Kitchen scene */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="240" height="180" viewBox="0 0 240 180" fill="none">
          <rect x="0" y="120" width="240" height="60" fill="rgba(255,255,255,0.1)"/>
          <line x1="0" y1="120" x2="240" y2="120" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
          <rect x="25" y="100" width="75" height="45" rx="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
          <line x1="35" y1="112" x2="90" y2="112" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
          <line x1="35" y1="120" x2="80" y2="120" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
          <line x1="35" y1="128" x2="85" y2="128" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
          <ellipse cx="168" cy="108" rx="32" ry="9" fill="rgba(255,255,255,0.18)"/>
          <path d="M136 105 Q136 138 168 143 Q200 138 200 105" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
          <ellipse cx="168" cy="105" rx="32" ry="8" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
          <path d="M136 105 Q125 105 125 112 Q125 119 136 119" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none"/>
          <path d="M200 105 Q211 105 211 112 Q211 119 200 119" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none"/>
          <path d="M153 97 Q149 88 153 79" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M168 95 Q164 86 168 77" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M183 97 Q179 88 183 79" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <text x="95" y="75" fontFamily="serif" fontSize="26" fontWeight="bold" fill="rgba(255,255,255,0.85)" letterSpacing="-1">nom</text>
        </svg>
      </div>

      {/* Content */}
      <div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px', fontWeight: '700',
          color: 'rgba(255,255,255,0.95)', lineHeight: '1.15',
          marginBottom: '10px'
        }}>Your Cookbook<br />is open.</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', marginBottom: '32px' }}>
          Now go find something delicious.
        </div>

        <ProgressDots step={5} />

        <button onClick={finishOnboarding} style={{
          width: '100%', padding: '15px',
          background: 'rgba(255,255,255,0.95)', color: 'var(--clay)',
          border: 'none', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700',
          cursor: 'pointer'
        }}>Take me in</button>
      </div>
    </div>
  )
}