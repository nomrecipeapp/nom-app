import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function Profile({ session }) {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    getProfile()
  }, [session])

  async function getProfile() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setUsername(data.username || '')
      setFullName(data.full_name || '')
    }
    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        username,
        full_name: fullName,
        updated_at: new Date().toISOString()
      })

    if (error) setMessage({ type: 'error', text: error.message })
    else {
      setMessage({ type: 'success', text: 'Profile saved.' })
      setEditing(false)
    }
    setSaving(false)
  }

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : session.user.email[0].toUpperCase()

  if (loading) return null

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      padding: '24px'
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--parchment)'
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--clay)',
            letterSpacing: '-1px'
          }}>Nom</div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--muted)',
              border: '1.5px solid var(--tan)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >Log out</button>
        </div>

        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clay), var(--ember))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--cream)'
          }}>{initials}</div>

          {fullName && (
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: '500',
              color: 'var(--ink)',
              marginBottom: '4px'
            }}>{fullName}</div>
          )}

          {username && (
            <div style={{
              fontSize: '13px',
              color: 'var(--muted)',
            }}>@{username}</div>
          )}

          <div style={{
            fontSize: '12px',
            color: 'var(--tan)',
            marginTop: '4px'
          }}>{session.user.email}</div>
        </div>

        {/* Profile Card */}
        <div style={{
          background: 'var(--warm-white)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--parchment)',
          padding: '28px',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)'
            }}>Your Profile</div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '6px 14px',
                  background: 'var(--parchment)',
                  color: 'var(--charcoal)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >Edit</button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--charcoal)',
                marginBottom: '6px',
                letterSpacing: '0.04em'
              }}>Full name</label>
              {editing ? (
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your name"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1.5px solid var(--tan)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--cream)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--ink)',
                    outline: 'none'
                  }}
                />
              ) : (
                <div style={{ fontSize: '14px', color: fullName ? 'var(--ink)' : 'var(--tan)' }}>
                  {fullName || 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--charcoal)',
                marginBottom: '6px',
                letterSpacing: '0.04em'
              }}>Username</label>
              {editing ? (
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '14px',
                    color: 'var(--muted)'
                  }}>@</span>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 26px',
                      border: '1.5px solid var(--tan)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--cream)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      outline: 'none'
                    }}
                  />
                </div>
              ) : (
                <div style={{ fontSize: '14px', color: username ? 'var(--ink)' : 'var(--tan)' }}>
                  {username ? `@${username}` : 'Not set'}
                </div>
              )}
            </div>
          </div>

          {editing && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: saving ? 'var(--tan)' : 'var(--clay)',
                  color: 'var(--cream)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >{saving ? 'Saving...' : 'Save'}</button>
              <button
                onClick={() => { setEditing(false); setMessage(null); getProfile() }}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  color: 'var(--muted)',
                  border: '1.5px solid var(--tan)',
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >Cancel</button>
            </div>
          )}

          {message && (
            <div style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: message.type === 'error' ? '#FDE8E8' : '#EEF4E5',
              border: `1px solid ${message.type === 'error' ? '#F5C0C0' : 'var(--sage)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: message.type === 'error' ? '#B85252' : 'var(--forest)'
            }}>{message.text}</div>
          )}
        </div>

      </div>
    </div>
  )
}