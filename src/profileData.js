// Data for a profile's Activity tab, shared by your profile and a friend's.

// The only profile fields the app reads. Never select('*') on profiles: the table
// also holds private columns (email, sign-up answers) that only Admin may see.
export const PROFILE_FIELDS = 'id, full_name, username, avatar_url, is_private'

// Cooks and Want to Make saves, newest first, plus like and comment counts for each.
export async function fetchActivity(supabase, userId, profile) {
  const [{ data: cooks }, { data: saves }] = await Promise.all([
    supabase.from('cooks').select('*, recipes(*)').eq('user_id', userId)
      .order('cooked_at', { ascending: false }).limit(30),
    // Bulk-imported recipes are left out of Activity, like the Feed (imports are silent)
    supabase.from('recipes').select('*').eq('user_id', userId)
      .eq('status', 'want_to_make').is('imported_from', null).order('created_at', { ascending: false }).limit(30),
  ])

  const cookItems = (cooks || []).filter(c => c.recipes).map(c => ({ ...c, profiles: profile, _type: 'cook', _date: c.cooked_at }))
  const saveItems = (saves || []).map(r => ({ ...r, _type: 'save', _date: r.created_at }))
  const items = [...cookItems, ...saveItems].sort((a, b) => new Date(b._date) - new Date(a._date))

  const cookIds = (cooks || []).map(c => c.id)
  const saveIds = (saves || []).map(r => r.id)
  const none = Promise.resolve({ data: [] })
  const [{ data: cookLikes }, { data: cookComments }, { data: saveLikes }, { data: saveComments }] = await Promise.all([
    cookIds.length ? supabase.from('likes').select('target_id').eq('target_type', 'cook').in('target_id', cookIds) : none,
    cookIds.length ? supabase.from('comments').select('target_id').eq('target_type', 'cook').in('target_id', cookIds) : none,
    saveIds.length ? supabase.from('likes').select('target_id').eq('target_type', 'save').in('target_id', saveIds) : none,
    saveIds.length ? supabase.from('comments').select('target_id').eq('target_type', 'save').in('target_id', saveIds) : none,
  ])

  const count = (rows, id) => rows?.filter(r => r.target_id === id).length || 0
  const engagement = {}
  cookIds.forEach(id => { engagement[`cook-${id}`] = { likes: count(cookLikes, id), comments: count(cookComments, id) } })
  saveIds.forEach(id => { engagement[`save-${id}`] = { likes: count(saveLikes, id), comments: count(saveComments, id) } })

  return { items, engagement }
}

// Recently cooked: their latest cooks, one per recipe
export function recentByRecipe(cooks, limit = 5) {
  const seen = new Set()
  return (cooks || []).filter(c => {
    if (!c.recipes || seen.has(c.recipe_id)) return false
    seen.add(c.recipe_id)
    return true
  }).slice(0, limit)
}
