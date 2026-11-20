// Sign in with Apple (iPhone app only; the website keeps email and password).
//
// How it works:
//   1. Apple's own sheet asks for Face ID and, the first time only, shares a name and email.
//   2. Apple hands back a signed "identity token". Supabase checks it and signs the person in
//      (creating the account the first time). Same email as an existing member = same account.
//   3. Brand-new people still need an invite code: Onboarding shows "Almost there" when the
//      account has no profile yet.
//
// Apple only shares the name on the very first sign-in, so we save it on the account
// (user_metadata.full_name) right away for the "Almost there" screen.
//
// Deleting an account: Apple wants apps to cut the Apple link too. askAppleForCode() shows the
// sheet once more and returns a fresh one-time code that delete-account trades in to revoke it.

import { Capacitor } from '@capacitor/core'
import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { supabase } from './supabase'

const CLIENT_ID = 'com.nomrecipeapp.nom'
// Not used on iPhone (Apple's native sheet has no redirect), but the plugin requires one
const REDIRECT_URI = 'https://www.nomrecipeapp.com'

export const appleSignInAvailable = () => Capacitor.getPlatform() === 'ios'

// True when this account can sign in with Apple
export function isAppleAccount(user) {
  const providers = user?.app_metadata?.providers || []
  return providers.includes('apple') || (user?.identities || []).some(i => i.provider === 'apple')
}

// The most recent one-time code from Apple, so a just-created empty account
// (no invite code) can be deleted and its Apple link revoked in one go.
let lastAppleCode = null
export const takeLastAppleCode = () => { const c = lastAppleCode; lastAppleCode = null; return c }

// The name Apple shared just now, in case "Almost there" opens before it's saved on the account
let lastAppleName = ''
export const lastNameFromApple = () => lastAppleName

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(text) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
}

// Apple's "user cancelled" error is code 1001. Closing the sheet isn't a problem to report.
const isCancel = (e) => /1001|cancel/i.test(String(e?.message || e || ''))

async function askApple(nonce) {
  const { response } = await SignInWithApple.authorize({
    clientId: CLIENT_ID,
    redirectURI: REDIRECT_URI,
    scopes: 'email name',
    ...(nonce ? { nonce } : {}),
  })
  return response
}

// Returns { ok: true, isNew } or { cancelled: true } or { error: 'friendly message' }
export async function signInWithApple() {
  let response
  const rawNonce = randomNonce()
  try {
    response = await askApple(await sha256Hex(rawNonce))
  } catch (e) {
    if (isCancel(e)) return { cancelled: true }
    console.error('Apple sign-in sheet failed:', e)
    return { error: "Couldn't reach Apple. Please try again." }
  }
  if (!response?.identityToken) return { error: "Couldn't reach Apple. Please try again." }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: response.identityToken,
    nonce: rawNonce,
  })
  if (error) {
    console.error('Apple sign-in with Supabase failed:', error.message)
    const m = (error.message || '').toLowerCase()
    if (m.includes('fetch') || m.includes('network')) return { error: "Can't reach Nom right now. Check your connection and try again." }
    return { error: 'Something went wrong signing in with Apple. Please try again.' }
  }
  lastAppleCode = response.authorizationCode || null

  // First sign-in only: keep the name Apple shared
  const fullName = [response.givenName, response.familyName].filter(Boolean).join(' ').trim()
  if (fullName) lastAppleName = fullName
  if (fullName && !data?.user?.user_metadata?.full_name) {
    const { error: nameError } = await supabase.auth.updateUser({ data: { full_name: fullName } })
    if (nameError) console.error('Saving Apple name failed:', nameError.message)
  }
  return { ok: true, user: data?.user || null }
}

// For Delete account: a fresh one-time code so Apple's link can be revoked.
// Returns { code } or { cancelled: true } or { error }
export async function askAppleForCode() {
  try {
    const response = await askApple()
    return response?.authorizationCode ? { code: response.authorizationCode } : { error: 'no code' }
  } catch (e) {
    if (isCancel(e)) return { cancelled: true }
    console.error('Apple confirm sheet failed:', e)
    return { error: String(e?.message || e) }
  }
}

// Removes a just-made Apple account that never got a profile (no invite code),
// revoking the Apple link, then signs out. Best effort: signs out no matter what.
export async function discardEmptyAppleAccount() {
  const code = takeLastAppleCode()
  try {
    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      // emptyOnly: the server refuses if this account already has a Nom profile
      body: { emptyOnly: true, ...(code ? { appleAuthorizationCode: code } : {}) },
    })
    if (error) console.error('Removing empty Apple account failed:', error)
  } catch (e) {
    console.error('Removing empty Apple account failed:', e)
  }
  // local: the account is already gone, so there's nothing to sign out of on the server
  await supabase.auth.signOut({ scope: 'local' })
}
