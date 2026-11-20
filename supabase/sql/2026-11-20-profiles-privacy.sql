-- Profiles privacy (Nov 20, 2026).
-- Found: the "Users can search all profiles" rule let ANYONE (even people not signed in,
-- using the public app key) read every column of every profile, emails included, and
-- "Anyone can insert own profile" let anyone create profile rows.
-- Two steps, because the strict lock would break 1.0.3, which reads whole profiles.

-- ════════════════════════════════════════════════════════════════════
-- STEP 1: run now. Nothing on people's phones breaks.
-- ════════════════════════════════════════════════════════════════════

-- Only signed-in members can look people up (Search, Find friends, profiles)
drop policy if exists "Users can search all profiles" on public.profiles;
drop policy if exists "Members can search profiles" on public.profiles;
create policy "Members can search profiles" on public.profiles
  for select to authenticated using (true);

-- You can only create your own profile, and only once you're signed in (right after sign-up)
drop policy if exists "Anyone can insert own profile" on public.profiles;
drop policy if exists "Members can create their own profile" on public.profiles;
create policy "Members can create their own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Sign-up checks whether a username is free before the account exists.
-- Answers yes or no only, so nobody can read profiles through it.
create or replace function public.username_taken(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(coalesce(p_username, '')))
  )
$$;
revoke all on function public.username_taken(text) from public;
grant execute on function public.username_taken(text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════
-- STEP 2: run 2 to 3 weeks after 1.0.4 is released (with "turn off the old Supabase keys").
-- Locks the private columns so the app can't read them at all. Admin's functions and the
-- email functions still can. 1.0.3 and older would break here, because they read whole profiles.
-- If you ever add a new column to profiles that the app needs to read, add it to the grant list.
-- ════════════════════════════════════════════════════════════════════

-- revoke select on public.profiles from anon, authenticated;
-- grant select (id, username, full_name, avatar_url, is_private, created_at, updated_at, onboarding_complete)
--   on public.profiles to authenticated;
