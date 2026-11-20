-- Admin metrics, Nov 20 update: adds the How did you hear about Nom? answers
-- and how many people ticked the Terms box at sign-up.
-- Run once in the Supabase SQL Editor, AFTER 2026-11-20-signup-heard-about-terms.sql.
-- Read-only: it only looks at data, never changes it. Replaces admin_metrics (same name, same rules).

create or replace function public.admin_metrics()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  result json;
begin
  perform public.require_admin();

  select json_build_object(
    -- What each member did this week and in the last 30 days (same "active" rule as the Overview)
    'activity', (select coalesce(json_agg(a), '[]'::json) from (
      select p.id,
        (select count(*) from public.recipes r where r.user_id = p.id and r.created_at > now() - interval '7 days') as recipes_7d,
        (select count(*) from public.cooks c where c.user_id = p.id and c.cooked_at > now() - interval '7 days') as cooks_7d,
        (select count(*) from public.import_usage i where i.user_id = p.id and i.created_at > now() - interval '7 days') as imports_7d,
        (select count(*) from public.recipes r where r.user_id = p.id and r.created_at > now() - interval '30 days') as recipes_30d,
        (select count(*) from public.cooks c where c.user_id = p.id and c.cooked_at > now() - interval '30 days') as cooks_30d,
        (select count(*) from public.import_usage i where i.user_id = p.id and i.created_at > now() - interval '30 days') as imports_30d
      from public.profiles p) a),

    -- Latest 60 saves
    'recent_recipes', (select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
      select r.id, r.title::text as title, r.source_url::text as source_url, r.created_at,
        coalesce(p.full_name, p.username)::text as who
      from public.recipes r left join public.profiles p on p.id = r.user_id
      order by r.created_at desc limit 60) x),

    -- Latest 60 cooks
    'recent_cooks', (select coalesce(json_agg(x order by x.cooked_at desc), '[]'::json) from (
      select c.id, c.verdict::text as verdict, c.cooked_at, r.title::text as title,
        coalesce(p.full_name, p.username)::text as who
      from public.cooks c
      left join public.recipes r on r.id = c.recipe_id
      left join public.profiles p on p.id = c.user_id
      order by c.cooked_at desc limit 60) x),

    -- Verdict split across every cook
    'verdicts', (select coalesce(json_object_agg(v, n), '{}'::json) from (
      select coalesce(c.verdict::text, 'none') v, count(*) n from public.cooks c group by 1) x),

    -- Most-saved recipes (saves of the same recipe share a canonical_id)
    'top_recipes', (select coalesce(json_agg(x), '[]'::json) from (
      select (array_agg(r.title::text order by r.created_at))[1] as title,
        count(distinct r.user_id) as savers,
        (select count(*) from public.cooks c where c.recipe_id = any(array_agg(r.id))) as cooks
      from public.recipes r
      group by coalesce(r.canonical_id::text, r.id::text)
      having count(distinct r.user_id) > 1
      order by count(distinct r.user_id) desc, max(r.created_at) desc
      limit 10) x),

    -- How did you hear about Nom? answers (asked at sign-up from Nov 20, 2026)
    'heard_about', (select coalesce(json_agg(x order by x.joined_at desc), '[]'::json) from (
      select p.id, coalesce(p.full_name, p.username)::text as who, p.heard_about::text as heard_about, u.created_at as joined_at
      from public.profiles p join auth.users u on u.id = p.id
      where p.heard_about is not null) x),
    'asked_since', (select min(u.created_at) from public.profiles p join auth.users u on u.id = p.id where p.terms_accepted_at is not null),
    'terms_accepted', (select count(*) from public.profiles where terms_accepted_at is not null)
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;
