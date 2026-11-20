-- Shareable recipe and cook links (1.0.4, Nov 20, 2026).
-- The preview page at nomrecipeapp.com/r/<recipe id> and /c/<cook id> is seen by people
-- who aren't signed in, and since the profiles privacy fix they can't read anything.
-- This function hands out only the few safe fields the preview page shows:
-- photo, title, first name, avatar, verdict, cook note, how many times they made it,
-- and the original site's name and link. Never ingredients or steps.
-- Private accounts get { "private": true } and nothing else, even if a friend reshares.
-- Safe to run any time; it only adds a function.

create or replace function public.share_preview(p_kind text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.recipes%rowtype;
  c public.cooks%rowtype;
  p public.profiles%rowtype;
  v_verdict text;
  v_times int;
begin
  if p_kind = 'cook' then
    select * into c from public.cooks where id = p_id;
    if not found then return null; end if;
    select * into r from public.recipes where id = c.recipe_id;
  elsif p_kind = 'recipe' then
    select * into r from public.recipes where id = p_id;
    if not found then return null; end if;
  else
    return null;
  end if;

  select * into p from public.profiles where id = coalesce(c.user_id, r.user_id);
  if not found then return null; end if;
  if coalesce(p.is_private, false) then
    return jsonb_build_object('kind', p_kind, 'private', true);
  end if;

  -- How many times the owner made this recipe, and their latest verdict
  select count(*) into v_times from public.cooks where recipe_id = r.id and user_id = p.id;
  if p_kind = 'cook' then
    v_verdict := c.verdict;
  else
    select verdict into v_verdict from public.cooks
      where recipe_id = r.id and user_id = p.id and verdict is not null
      order by cooked_at desc nulls last limit 1;
  end if;

  return jsonb_build_object(
    'kind', p_kind,
    'private', false,
    'title', r.title,
    'image', coalesce(case when p_kind = 'cook' then to_jsonb(c.photo_urls) ->> 0 end, r.image_url),
    'source_name', r.source_name,
    'source_url', case when r.source_url ~* '^https?://' then r.source_url end,
    'name', coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), p.username),
    'username', p.username,
    'avatar', p.avatar_url,
    'verdict', v_verdict,
    'note', case when p_kind = 'cook' then left(c.notes, 280) end,
    'cooked_at', case when p_kind = 'cook' then c.cooked_at end,
    'times', v_times
  );
end;
$$;

revoke all on function public.share_preview(text, uuid) from public;
grant execute on function public.share_preview(text, uuid) to anon, authenticated;
