import { supabase } from './supabase'

// Report + Block helpers (Apple guideline 1.2).
// Tables: reports, blocks. Functions: my_block_list(). See supabase/sql/2026-10-14-reports-and-blocks.sql

export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam' },
  { key: 'offensive', label: 'Offensive or inappropriate' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'other', label: 'Something else' },
]

// People I blocked or who blocked me, plus things I've reported.
// Fails soft: if anything errors, nothing extra is hidden.
export async function getHiddenContent(userId) {
  try {
    const [blocksRes, reportsRes] = await Promise.all([
      supabase.rpc('my_block_list'),
      supabase.from('reports').select('target_type, target_id').eq('reporter_id', userId),
    ])
    const blockedIds = new Set(
      (blocksRes.data || []).map(row => (typeof row === 'string' ? row : row?.my_block_list)).filter(Boolean)
    )
    const reported = new Set((reportsRes.data || []).map(r => `${r.target_type}:${r.target_id}`))
    return { blockedIds, reported }
  } catch (e) {
    console.error('Could not load hidden content:', e)
    return { blockedIds: new Set(), reported: new Set() }
  }
}

export function isHidden(hidden, type, id, userId) {
  if (!hidden) return false
  if (userId && hidden.blockedIds.has(userId)) return true
  return hidden.reported.has(`${type}:${id}`)
}

export async function submitReport({ reporterId, targetType, targetId, reportedUserId, reason, note }) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: String(targetId),
    reported_user_id: reportedUserId || null,
    reason,
    note: note?.trim() || null,
  })
  return error
}

export async function blockUser(blockerId, blockedId) {
  const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId })
  // Already blocked counts as success
  if (error && error.code === '23505') return null
  return error
}

export async function unblockUser(blockerId, blockedId) {
  const { error } = await supabase.from('blocks').delete()
    .eq('blocker_id', blockerId).eq('blocked_id', blockedId)
  return error
}

export async function hasBlocked(blockerId, blockedId) {
  const { data } = await supabase.from('blocks').select('blocked_id')
    .eq('blocker_id', blockerId).eq('blocked_id', blockedId).maybeSingle()
  return !!data
}

export async function listBlocked(blockerId) {
  const { data: rows } = await supabase.from('blocks').select('blocked_id, created_at')
    .eq('blocker_id', blockerId).order('created_at', { ascending: false })
  if (!rows || rows.length === 0) return []
  const { data: profiles } = await supabase.from('profiles')
    .select('id, full_name, username, avatar_url').in('id', rows.map(r => r.blocked_id))
  return rows.map(r => profiles?.find(p => p.id === r.blocked_id) || { id: r.blocked_id })
}
