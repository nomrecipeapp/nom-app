-- Daily import cap for AI imports (link, photo, TikTok/Instagram), counted over a rolling 24 hours:
--   40 a day during a user's first 7 days, then 10 a day.
-- Saving a friend's recipe and adding manually never count.
-- Run once in the Supabase SQL Editor BEFORE the matching code goes live.
-- To change the numbers later, edit import_cap() below and run just that part again.

create table if not exists public.import_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists import_usage_user_time on public.import_usage (user_id, created_at desc);

-- Locked down: no policies, so the app can't read or change this table directly.
-- Only the functions below touch it.
alter table public.import_usage enable row level security;

-- The rule in one place: 40 a day in your first week, 10 a day after.
create or replace function public.import_cap(uid uuid, out daily_cap int, out first_week boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when u.created_at > now() - interval '7 days' then 40 else 10 end,
    u.created_at > now() - interval '7 days'
  from auth.users u where u.id = uid
$$;

-- Read-only: how many imports the signed-in user has left, and when the next one opens up.
-- The app calls this to show "2 imports left today" and the limit card.
create or replace function public.import_status()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c record;
  used int;
  oldest timestamptz;
begin
  if uid is null then return null; end if;
  select * into c from public.import_cap(uid);
  select count(*), min(created_at) into used, oldest
  from public.import_usage
  where user_id = uid and created_at > now() - interval '24 hours';
  return json_build_object(
    'used', used,
    'cap', c.daily_cap,
    'remaining', greatest(c.daily_cap - used, 0),
    'first_week', c.first_week,
    -- When the oldest import in the window drops off, one more opens up
    'reset_at', case when used >= c.daily_cap then oldest + interval '24 hours' end
  );
end;
$$;

-- Called by the import endpoints right before they use the AI.
-- Counts this import if the user has room; returns the same shape as import_status plus "allowed".
create or replace function public.claim_import(p_kind text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c record;
  used int;
  oldest timestamptz;
begin
  if uid is null then
    return json_build_object('allowed', false);
  end if;

  -- One import check at a time per user, so double taps can't sneak past the cap
  perform pg_advisory_xact_lock(hashtext(uid::text));

  select * into c from public.import_cap(uid);
  select count(*), min(created_at) into used, oldest
  from public.import_usage
  where user_id = uid and created_at > now() - interval '24 hours';

  if used >= c.daily_cap then
    return json_build_object('allowed', false, 'used', used, 'cap', c.daily_cap, 'remaining', 0,
      'first_week', c.first_week, 'reset_at', oldest + interval '24 hours');
  end if;

  insert into public.import_usage (user_id, kind) values (uid, left(p_kind, 20));
  return json_build_object('allowed', true, 'used', used + 1, 'cap', c.daily_cap,
    'remaining', c.daily_cap - used - 1, 'first_week', c.first_week);
end;
$$;

revoke all on function public.import_cap(uuid) from public, anon, authenticated;
revoke all on function public.import_status() from public, anon;
revoke all on function public.claim_import(text) from public, anon;
grant execute on function public.import_status() to authenticated;
grant execute on function public.claim_import(text) to authenticated;
