import { supabase, API_BASE } from './supabase'

// POST to one of our api/ routes with the signed-in user's session token,
// so the server can check the caller is a Nom user.
export async function apiPost(path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
}
