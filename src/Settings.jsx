import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

export default function Settings({ session, onBack }) {
  const [profile, setProfile] = useState({ full_name: '', username: '', email: '' })
  const [loading, setLoading] = useState(true)

  // Edit modal state
  const [editField, setEditField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editValue2, setEditValue2] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const [editSuccess, setEditSuccess] = useState(null)

  // Avatar
  const avatarInputRef = useRef(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, username, avatar_url')
      .eq('id', session.user.id)
      .single()
    if (data) {
      setProfile({ ...data, email: session.user.email || '' })
    }
    setLoading(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', session.user.id)
      setProfile(p => ({ ...p, avatar_url: data.publicUrl }))
    } catch (err) {
      console.error('Avatar upload failed:', err)
    }
    setAvatarUploading(false)
    e.target.value = ''
  }

  function openEdit(field) {
    setEditField(field)
    setEditError(null)
    setEditSuccess(null)
    setEditValue2('')
    if (field === 'name') setEditValue(profile.full_name || '')
    else if (field === 'username') setEditValue(profile.username || '')
    else if (field === 'email') setEditValue(profile.email || '')
    else if (field === 'password') setEditValue('')
  }

  function closeEdit() {
    setEditField(null)
    setEditError(null)
    setEditSuccess(null)
    setEditValue('')
    setEditValue2('')
  }

  async function saveEdit() {
    setEditSaving(true)
    setEditError(null)
    try {
      if (editField === 'name') {
        if (!editValue.trim()) { setEditError('Name cannot be empty.'); setEditSaving(false); return }
        await supabase.from('profiles').update({ full_name: editValue.trim() }).eq('id', session.user.id)
        setProfile(p => ({ ...p, full_name: editValue.trim() }))
        setEditSuccess('Name updated.')
      } else if (editField === 'username') {
        if (!editValue.trim()) { setEditError('Username cannot be empty.'); setEditSaving(false); return }
        const clean = editValue.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
        const { data: existing } = await supabase
          .from('profiles').select('id').eq('username', clean).neq('id', session.user.id).maybeSingle()
        if (existing) { setEditError('That username is already taken.'); setEditSaving(false); return }
        await supabase.from('profiles').update({ username: clean }).eq('id', session.user.id)
        setProfile(p => ({ ...p, username: clean }))
        setEditSuccess('Username updated.')
      } else if (editField === 'email') {
        if (!editValue.trim()) { setEditError('Email cannot be empty.'); setEditSaving(false); return }
        const { error } = await supabase.auth.updateUser({ email: editValue.trim() })
        if (error) { setEditError(error.message); setEditSaving(false); return }
        setProfile(p => ({ ...p, email: editValue.trim() }))
        setEditSuccess('Check your new email to confirm the change.')
      } else if (editField === 'password') {
        if (editValue.length < 8) { setEditError('Password must be at least 8 characters.'); setEditSaving(false); return }
        if (editValue !== editValue2) { setEditError('Passwords do not match.'); setEditSaving(false); return }
        const { error } = await supabase.auth.updateUser({ password: editValue })
        if (error) { setEditError(error.message); setEditSaving(false); return }
        setEditSuccess('Password updated.')
      }
    } catch (err) {
      setEditError(err.message || 'Something went wrong.')
    }
    setEditSaving(false)
  }

  async function handleLogOut() {
    await supabase.auth.signOut()
  }

  async function handleDeleteAccount() {
    if (deleteText !== 'delete') return
    setDeleting(true)
    await supabase.auth.signOut()
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px',
    border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)',
    background: 'var(--cream)', fontFamily: 'var(--font-body)',
    fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box'
  }

  const editFieldLabels = {
    name: 'Full Name',
    username: 'Username',
    email: 'Email Address',
    password: 'Password',
  }

  function SettingsRow({ iconBg, icon, label, value, onTap, danger }) {
    return (
      <button
        onClick={onTap}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 20px', background: 'none', border: 'none', cursor: 'pointer', gap: '12px', textAlign: 'left',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--parchment)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: danger ? '#C05050' : 'var(--ink)' }}>{label}</div>
            {value && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{value}</div>}
          </div>
        </div>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ opacity: danger ? 0.5 : 0.3, flexShrink: 0 }}>
          <path d="M1 1l4 4-4 4" stroke={danger ? '#C05050' : 'var(--ink)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    )
  }

  function SectionHeader({ label }) {
    return (
      <div style={{ padding: '14px 20px 6px', fontSize: '9px', fontWeight: '700', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
    )
  }

  function Divider() {
    return <div style={{ height: '6px', background: '#F0E8D8' }} />
  }

  return (
    <>
      {/* Edit field modal */}
      {editField && (
        <div onClick={closeEdit} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--cream)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 24px 40px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>Update {editFieldLabels[editField]}</div>
              <button onClick={closeEdit} style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--parchment)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: 'var(--charcoal)', fontWeight: '600' }}>×</button>
            </div>

            {editField === 'password' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>New Password</label>
                  <input type="password" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="At least 8 characters" autoFocus style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>Confirm Password</label>
                  <input type="password" value={editValue2} onChange={e => setEditValue2(e.target.value)} placeholder="Repeat new password" style={inputStyle} />
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '6px' }}>{editFieldLabels[editField]}</label>
                <input
                  type={editField === 'email' ? 'email' : 'text'}
                  value={editValue}
                  onChange={e => {
                    let val = e.target.value
                    if (editField === 'username') val = val.toLowerCase().replace(/[^a-z0-9_]/g, '')
                    setEditValue(val)
                  }}
                  autoFocus
                  style={inputStyle}
                />
                {editField === 'username' && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Letters, numbers, and underscores only</div>}
              </div>
            )}

            {editError && <div style={{ background: '#FDE8E8', border: '1px solid #F5C0C0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#B85252', marginTop: '12px' }}>{editError}</div>}
            {editSuccess && <div style={{ background: '#EEF4E5', border: '1px solid #7A8C6E', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: '#4A5E42', marginTop: '12px' }}>{editSuccess}</div>}

            {!editSuccess ? (
              <button onClick={saveEdit} disabled={editSaving} style={{ width: '100%', marginTop: '16px', padding: '14px', background: editSaving ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: editSaving ? 'not-allowed' : 'pointer' }}>{editSaving ? 'Saving...' : `Save ${editFieldLabels[editField]}`}</button>
            ) : (
              <button onClick={closeEdit} style={{ width: '100%', marginTop: '16px', padding: '14px', background: 'var(--parchment)', color: 'var(--charcoal)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Done</button>
            )}
          </div>
        </div>
      )}

      {/* Delete account confirmation modal */}
      {showDeleteConfirm && (
        <div onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--cream)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 24px 40px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: '#C05050', marginBottom: '8px' }}>Delete your account</div>
            <div style={{ fontSize: '13px', color: 'var(--charcoal)', lineHeight: '1.6', marginBottom: '20px' }}>
              This will permanently delete your Cookbook, cook history, and all your notes. <strong>This cannot be undone.</strong>
            </div>
            <div style={{ background: '#FFF5F5', border: '1px solid #F0C8C8', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#A05050', marginBottom: '8px' }}>Type <strong>delete</strong> to confirm</div>
              <input type="text" value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="delete" autoFocus style={{ ...inputStyle, border: '1.5px solid #F0C8C8' }} />
            </div>
            <button onClick={handleDeleteAccount} disabled={deleteText !== 'delete' || deleting} style={{ width: '100%', padding: '14px', background: deleteText === 'delete' ? '#C05050' : 'var(--parchment)', color: deleteText === 'delete' ? 'white' : 'var(--muted)', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: deleteText === 'delete' ? 'pointer' : 'not-allowed', marginBottom: '10px', transition: 'all 0.15s' }}>{deleting ? 'Deleting...' : 'Delete My Account'}</button>
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }} style={{ width: '100%', padding: '12px', background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Main settings screen */}
      <div style={{ minHeight: '100vh', background: '#F0E8D8', paddingBottom: '100px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ height: '54px' }} />

          {/* Identity block */}
          <div style={{ background: 'var(--cream)', display: 'flex', alignItems: 'center', gap: '14px', padding: '20px 20px 16px', borderBottom: '1px solid var(--parchment)' }}>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            <div style={{ position: 'relative', flexShrink: 0 }} onClick={() => avatarInputRef.current?.click()}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} />
              ) : (
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clay), var(--ember))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--cream)', cursor: 'pointer' }}>
                  {(profile.full_name || profile.username || session.user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px', borderRadius: '50%', background: 'var(--ink)', border: '2px solid var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUploading
                  ? <div style={{ width: '8px', height: '8px', border: '1.5px solid rgba(255,255,255,0.4)', borderTop: '1.5px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M5.5 1.5l2 2-4 4H1.5v-2l4-4z" stroke="#FAF6EF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700', color: 'var(--ink)', marginBottom: '2px' }}>{profile.full_name || 'Your Name'}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{profile.username ? `@${profile.username}` : 'No username set'} · Tap photo to change</div>
            </div>
          </div>

          {/* Account */}
          <div style={{ background: 'var(--cream)', marginTop: '6px' }}>
            <SectionHeader label="Account" />
            <SettingsRow iconBg="#F2E0D1" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="3" stroke="#C4713A" strokeWidth="1.3"/><path d="M1 13c0-3 2.5-4.5 6-4.5s6 1.5 6 4.5" stroke="#C4713A" strokeWidth="1.3" strokeLinecap="round"/></svg>} label="Name" value={profile.full_name || '—'} onTap={() => openEdit('name')} />
            <SettingsRow iconBg="#F2E0D1" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="#C4713A" strokeWidth="1.3"/><path d="M1 5l6 4 6-4" stroke="#C4713A" strokeWidth="1.3" strokeLinecap="round"/></svg>} label="Email" value={profile.email || '—'} onTap={() => openEdit('email')} />
            <SettingsRow iconBg="#F2E0D1" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="6" rx="1.5" stroke="#C4713A" strokeWidth="1.3"/><path d="M5 6V4a2 2 0 014 0v2" stroke="#C4713A" strokeWidth="1.3" strokeLinecap="round"/><circle cx="7" cy="9" r="1" fill="#C4713A"/></svg>} label="Password" value="••••••••" onTap={() => openEdit('password')} />
            <SettingsRow iconBg="#F2E0D1" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#C4713A" strokeWidth="1.3"/><path d="M4.5 7h5M7 4.5v5" stroke="#C4713A" strokeWidth="1.3" strokeLinecap="round"/></svg>} label="Username" value={profile.username ? `@${profile.username}` : '—'} onTap={() => openEdit('username')} />
          </div>

          <Divider />

          {/* Privacy */}
          <div style={{ background: 'var(--cream)' }}>
            <SectionHeader label="Privacy" />
            <SettingsRow iconBg="#E2EBD8" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.5 3H12l-2.7 2 1 3.3L7 7.5 3.7 9.3l1-3.3L2 4h3.5L7 1z" stroke="#4A5E42" strokeWidth="1.2" strokeLinejoin="round"/></svg>} label="Want to Make" value="Private" onTap={() => {}} />
            <SettingsRow iconBg="#E2EBD8" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="#4A5E42" strokeWidth="1.3"/><path d="M2 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="#4A5E42" strokeWidth="1.3" strokeLinecap="round"/></svg>} label="Profile visibility" value="Anyone can request" onTap={() => {}} />
          </div>

          <Divider />

          {/* Account actions */}
          <div style={{ background: 'var(--cream)' }}>
            <SectionHeader label="Account Actions" />
            <SettingsRow iconBg="#E8E6E2" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2H5a1 1 0 00-1 1v1h6V3a1 1 0 00-1-1zM2 4h10M3 4l.7 7.3A1 1 0 004.7 12h4.6a1 1 0 001-.7L11 4" stroke="#3A3630" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>} label="Log out" onTap={handleLogOut} />
            <SettingsRow iconBg="#FCE8E8" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#C05050" strokeWidth="1.3"/><path d="M7 4.5v3" stroke="#C05050" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="9.5" r="0.75" fill="#C05050"/></svg>} label="Delete account" onTap={() => setShowDeleteConfirm(true)} danger />
          </div>

          <div style={{ padding: '20px', textAlign: 'center', fontSize: '10px', color: '#C0B8A8' }}>Nom v1.0 · Made with care</div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}