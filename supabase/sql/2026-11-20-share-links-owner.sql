-- Shareable links, part 2 (Nov 20, 2026): owners of private accounts can share their own things.
-- Run this after 2026-11-20-share-links.sql.
--
-- New accounts start Private (which in Nom means "follow requests need my approval"), so
-- hiding every private account's links would make sharing mostly blank cards.
-- Now: when you tap Share on your OWN recipe or cook, the app stamps link_shared_at on that
-- one item, and its link shows the full preview. A friend resharing a private person's
-- recipe still gets the plain card, because only the owner can stamp their own rows
-- (the existing "edit your own recipes and cooks" rules).
-- Safe to run any time: adds two empty columns and updates the function.

alter table public.recipes add column if not exists link_shared_at timestamptz;
alter table public.cooks add column if not exists link_shared_at timestamptz;

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
  -- Private accounts stay hidden, unless the owner tapped Share on this exact recipe or cook
  if coalesce(p.is_private, false)
     and (case when p_kind = 'cook' then c.link_shared_at else r.link_shared_at end) is null then
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
