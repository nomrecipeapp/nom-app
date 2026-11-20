-- Tag who you cooked with + "Log it too" (1.0.4, Nov 20, 2026). Run once in the Supabase SQL Editor.
-- Safe to run again: everything checks before creating.
--
-- How it works:
--   - Whoever logged a cook can tag people they follow (or people who follow them,
--     so a "Log it too" can tag the friend back).
--   - The tag shows right away to everyone who can see the cook. Tagged people can remove themselves.
--   - Tagged people can see the cook they're tagged in and its recipe, even if the cook's
--     owner is private and they don't follow them (so "Log it too" always works).
--   - No tags between people who have blocked each other.

-- 1. The tags: one row per person tagged in a cook
create table if not exists public.cook_tags (
  cook_id uuid not null references public.cooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tagged_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cook_id, user_id),
  check (user_id <> tagged_by)
);
create index if not exists cook_tags_user_idx on public.cook_tags (user_id);
alter table public.cook_tags enable row level security;

-- 2. Helpers that skip the table rules on purpose (so the rules below don't loop into each other)
create or replace function public.is_tagged_in_cook(p_cook_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cook_tags where cook_id = p_cook_id and user_id = auth.uid());
$$;

create or replace function public.is_tagged_in_recipe(p_recipe_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cook_tags t join public.cooks c on c.id = t.cook_id
    where c.recipe_id = p_recipe_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.owns_cook(p_cook_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cooks where id = p_cook_id and user_id = auth.uid());
$$;

create or replace function public.follow_either_way(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.follows
    where status = 'approved'
      and ((follower_id = a and following_id = b) or (follower_id = b and following_id = a))
  );
$$;

revoke all on function public.is_tagged_in_cook(uuid) from public;
revoke all on function public.is_tagged_in_recipe(uuid) from public;
revoke all on function public.owns_cook(uuid) from public;
revoke all on function public.follow_either_way(uuid, uuid) from public;
grant execute on function public.is_tagged_in_cook(uuid) to authenticated;
grant execute on function public.is_tagged_in_recipe(uuid) to authenticated;
grant execute on function public.owns_cook(uuid) to authenticated;
grant execute on function public.follow_either_way(uuid, uuid) to authenticated;

-- 3. Rules for cook_tags
drop policy if exists "See tags on cooks you can see" on public.cook_tags;
create policy "See tags on cooks you can see" on public.cook_tags
  for select to authenticated using (
    user_id = auth.uid() or tagged_by = auth.uid()
    or exists (select 1 from public.cooks c where c.id = cook_tags.cook_id)  -- uses the cooks rules, so tags follow the cook
  );

drop policy if exists "Tag friends on your own cooks" on public.cook_tags;
create policy "Tag friends on your own cooks" on public.cook_tags
  for insert to authenticated with check (
    tagged_by = auth.uid()
    and public.owns_cook(cook_id)
    and public.follow_either_way(auth.uid(), user_id)
    and not public.is_blocked_between(auth.uid(), user_id)
  );

drop policy if exists "Untag from your cook, or remove yourself" on public.cook_tags;
create policy "Untag from your cook, or remove yourself" on public.cook_tags
  for delete to authenticated using (tagged_by = auth.uid() or user_id = auth.uid());

-- 4. Tagged people can open the cook and its recipe (needed when the owner is private)
drop policy if exists "Tagged people can see the cook" on public.cooks;
create policy "Tagged people can see the cook" on public.cooks
  for select to authenticated using (public.is_tagged_in_cook(id));

drop policy if exists "Tagged people can see the recipe" on public.recipes;
create policy "Tagged people can see the recipe" on public.recipes
  for select to authenticated using (public.is_tagged_in_recipe(id));

-- 5. Notifications: allow the new 'cook_tag' type, if the table limits which types it takes
do $$
declare
  c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    if c.def not ilike '%cook_tag%' then
      execute format('alter table public.notifications drop constraint %I', c.conname);
      raise notice 'Removed % (%) so cook_tag notifications can be saved', c.conname, c.def;
    end if;
  end loop;
end $$;

-- Check: should list the table with 0 rows and no errors
select count(*) as cook_tags_rows from public.cook_tags;
