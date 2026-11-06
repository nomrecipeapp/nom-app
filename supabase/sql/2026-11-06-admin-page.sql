-- Nom Admin page (nomrecipeapp.com/admin). Run once in the Supabase SQL Editor,
-- BEFORE the matching code goes live. Safe to run again: every step checks first.
--
-- What this adds:
--   1. admins: who may open the Admin page (just Syd)
--   2. admin_settings: monthly budget, fixed costs, friend invites on/off, codes per new user
--   3. waitlist.invited_at and invites.source ('admin' = sent by Syd, 'friend' = a member's code)
--   4. Real AI cost per import (token counts saved after each import)
--   5. Budget check: 75% alert, and at 100% friend invites pause on their own
--   6. Friend invite rules: paused codes stop working, new members get N codes
--   7. Read-only functions the Admin page uses (each one checks you're an admin)
--
-- Nothing here changes what members see, unless friend invites are paused.

-- ───────────────────────── 0. Safety check ─────────────────────────
-- The invite pause relies on row security being on for the invites table.
-- If it's off, stop here before changing anything (tell Claude).
do $$ begin
  if not (select relrowsecurity from pg_class where oid = 'public.invites'::regclass) then
    raise exception 'STOP: row security is off on the invites table. Nothing was changed. Tell Claude.';
  end if;
end $$;

-- ───────────────────────── 1. Admins ─────────────────────────

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Locked: no policies, so nobody can read or change this table from the app.
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Every admin function starts with this. Stops anyone who isn't on the admins list.
create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.require_admin() from public, anon, authenticated;

-- ───────────────────────── 2. Settings (one row) ─────────────────────────

create table if not exists public.admin_settings (
  id int primary key default 1 check (id = 1),
  monthly_budget numeric(10,2) not null default 50 check (monthly_budget > 0),
  fixed_costs numeric(10,2) not null default 45 check (fixed_costs >= 0),
  friend_invites_on boolean not null default true,
  paused_reason text,                      -- 'budget' when Nom paused invites on its own
  codes_per_new_user int not null default 3 check (codes_per_new_user between 0 and 10),
  updated_at timestamptz not null default now()
);
insert into public.admin_settings (id) values (1) on conflict (id) do nothing;
alter table public.admin_settings enable row level security;

-- ───────────────────────── 3. Waitlist + invites ─────────────────────────

alter table public.waitlist add column if not exists invited_at timestamptz;

alter table public.invites add column if not exists source text not null default 'friend';
do $$ begin
  alter table public.invites add constraint invites_source_check check (source in ('friend', 'admin'));
exception when duplicate_object then null; end $$;
-- Codes made by the send-invite function before today have no creator
update public.invites set source = 'admin' where created_by is null and source = 'friend';

-- ───────────────────────── 4. Real AI cost per import ─────────────────────────

alter table public.import_usage add column if not exists model text;
alter table public.import_usage add column if not exists input_tokens int;
alter table public.import_usage add column if not exists output_tokens int;
alter table public.import_usage add column if not exists cost_usd numeric(10,5);

-- Price per million tokens. Add a line here if Nom ever switches models.
create or replace function public.ai_cost(p_model text, p_in int, p_out int)
returns numeric language sql immutable set search_path = '' as $$
  select round((
    coalesce(p_in, 0)  * case when p_model like 'claude-haiku%' then 1 when p_model like 'claude-opus%' then 5 else 3 end
  + coalesce(p_out, 0) * case when p_model like 'claude-haiku%' then 5 when p_model like 'claude-opus%' then 25 else 15 end
  ) / 1000000.0, 5);
$$;

-- Same as before, plus usage_id so the import can report its cost afterwards.
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
  new_id bigint;
begin
  if uid is null then
    return json_build_object('allowed', false);
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  select * into c from public.import_cap(uid);
  select count(*), min(created_at) into used, oldest
  from public.import_usage
  where user_id = uid and created_at > now() - interval '24 hours';

  if used >= c.daily_cap then
    return json_build_object('allowed', false, 'used', used, 'cap', c.daily_cap, 'remaining', 0,
      'first_week', c.first_week, 'reset_at', oldest + interval '24 hours');
  end if;

  insert into public.import_usage (user_id, kind) values (uid, left(p_kind, 20)) returning id into new_id;
  return json_build_object('allowed', true, 'used', used + 1, 'cap', c.daily_cap,
    'remaining', c.daily_cap - used - 1, 'first_week', c.first_week, 'usage_id', new_id);
end;
$$;
revoke all on function public.claim_import(text) from public, anon;
grant execute on function public.claim_import(text) to authenticated;

-- ───────────────────────── 5. Budget check ─────────────────────────

-- One row each time spending crosses 75% or 100% in a month.
-- A Database Webhook on this table sends the alert email (budget-alert function).
create table if not exists public.budget_alerts (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  level int not null check (level in (75, 100)),
  spent numeric(10,2) not null,
  budget numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (month, level)
);
alter table public.budget_alerts enable row level security;

create or replace function public.month_ai_spend()
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(cost_usd), 0)
  from public.import_usage
  where created_at >= date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago';
$$;
revoke all on function public.month_ai_spend() from public, anon, authenticated;

create or replace function public.check_budget()
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.admin_settings;
  spent numeric := public.month_ai_spend();
  this_month date := date_trunc('month', now() at time zone 'America/Chicago')::date;
  hit100 int;
begin
  select * into s from public.admin_settings where id = 1;
  if s is null then return; end if;

  if spent >= s.monthly_budget * 0.75 then
    insert into public.budget_alerts (month, level, spent, budget)
    values (this_month, 75, spent, s.monthly_budget)
    on conflict (month, level) do nothing;
  end if;

  if spent >= s.monthly_budget then
    insert into public.budget_alerts (month, level, spent, budget)
    values (this_month, 100, spent, s.monthly_budget)
    on conflict (month, level) do nothing;
    get diagnostics hit100 = row_count;
    -- Pause once, when 100% is first crossed this month. If Syd turns invites back on, it stays on.
    if hit100 > 0 then
      update public.admin_settings
      set friend_invites_on = false, paused_reason = 'budget', updated_at = now()
      where id = 1;
    end if;
  end if;
end;
$$;
revoke all on function public.check_budget() from public, anon, authenticated;

-- Called by the import endpoints after the AI answers. Only fills in the caller's own row, once.
create or replace function public.record_import_cost(p_usage_id bigint, p_model text, p_input_tokens int, p_output_tokens int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.import_usage
  set model = left(p_model, 60),
      input_tokens = greatest(p_input_tokens, 0),
      output_tokens = greatest(p_output_tokens, 0),
      cost_usd = public.ai_cost(p_model, greatest(p_input_tokens, 0), greatest(p_output_tokens, 0))
  where id = p_usage_id and user_id = auth.uid() and cost_usd is null;
  if found then perform public.check_budget(); end if;
end;
$$;
revoke all on function public.record_import_cost(bigint, text, int, int) from public, anon;
grant execute on function public.record_import_cost(bigint, text, int, int) to authenticated;

-- ───────────────────────── 6. Friend invite rules ─────────────────────────

create or replace function public.friend_invites_allowed(p_creator uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select friend_invites_on from public.admin_settings where id = 1), true)
      or exists (select 1 from public.admins where user_id = p_creator);
$$;
grant execute on function public.friend_invites_allowed(uuid) to anon, authenticated;

-- While paused, members' unused codes can't be looked up at sign-up, so they don't work.
-- Codes Syd sends, and codes made by an admin account, always work.
-- Members still see their own codes in Settings.
drop policy if exists "Friend codes pause with invites" on public.invites;
create policy "Friend codes pause with invites" on public.invites
  as restrictive for select to anon, authenticated
  using (source = 'admin' or created_by = auth.uid() or public.friend_invites_allowed(created_by));

create or replace function public.new_invite_code()
returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 1 + floor(random() * 36)::int, 1), '')
  from generate_series(1, 8);
$$;

-- The app gives each new member 3 codes. This trims or tops that up to the setting
-- (0 while friend invites are paused). Only runs when a member makes their own codes.
create or replace function public.match_codes_per_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
  want int;
  have int;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  select case when friend_invites_on then codes_per_new_user else 0 end
    into want from public.admin_settings where id = 1;
  if want is null then return null; end if;

  for r in
    select distinct n.created_by from new_rows n
    where n.source = 'friend' and n.created_by is not null and n.created_by = auth.uid()
      and not exists (select 1 from public.admins a where a.user_id = n.created_by)
  loop
    select count(*) into have from public.invites
    where created_by = r.created_by and source = 'friend';
    if have > want then
      delete from public.invites where id in (
        select id from public.invites
        where created_by = r.created_by and source = 'friend' and used_by is null
        order by created_at desc limit have - want);
    elsif have < want then
      insert into public.invites (code, created_by, source)
      select public.new_invite_code(), r.created_by, 'friend' from generate_series(1, want - have);
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists invites_match_codes_per_new_user on public.invites;
create trigger invites_match_codes_per_new_user
  after insert on public.invites
  referencing new table as new_rows
  for each statement execute function public.match_codes_per_new_user();

-- ───────────────────────── 7. Admin page functions ─────────────────────────

-- Big numbers + settings + last 30 days, in one call
create or replace function public.admin_overview()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  s public.admin_settings;
  month_start timestamptz := date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago';
  result json;
begin
  perform public.require_admin();
  select * into s from public.admin_settings where id = 1;

  select json_build_object(
    'settings', row_to_json(s),
    'users', (select count(*) from public.profiles),
    'users_onboarded', (select count(*) from public.profiles where onboarding_complete),
    'new_users_7d', (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.created_at > now() - interval '7 days'),
    'active_7d', (select count(distinct uid) from (
        select user_id uid from public.recipes where created_at > now() - interval '7 days'
        union all select user_id from public.cooks where cooked_at > now() - interval '7 days'
        union all select user_id from public.import_usage where created_at > now() - interval '7 days') a),
    'active_30d', (select count(distinct uid) from (
        select user_id uid from public.recipes where created_at > now() - interval '30 days'
        union all select user_id from public.cooks where cooked_at > now() - interval '30 days'
        union all select user_id from public.import_usage where created_at > now() - interval '30 days') a),
    'recipes', (select count(*) from public.recipes),
    'cooks', (select count(*) from public.cooks),
    'waiting', (select count(*) from public.waitlist w
                where w.invited_at is null
                  and not exists (select 1 from public.profiles p where lower(p.email) = lower(w.email))),
    'month_spend', public.month_ai_spend(),
    'month_imports', (select count(*) from public.import_usage where created_at >= month_start),
    'month_unpriced', (select count(*) from public.import_usage where created_at >= month_start and cost_usd is null),
    'all_time_spend', (select coalesce(sum(cost_usd), 0) from public.import_usage),
    'avg_import_cost', (select avg(cost_usd) from public.import_usage where cost_usd is not null),
    'alerts_this_month', (select coalesce(json_agg(level order by level), '[]'::json)
                          from public.budget_alerts where month = month_start::date),
    'daily', (select json_agg(d order by d.day) from (
        select g.day::date as day,
          (select count(*) from auth.users u where u.created_at >= g.day and u.created_at < g.day + interval '1 day') as signups,
          (select count(*) from public.import_usage i where i.created_at >= g.day and i.created_at < g.day + interval '1 day') as imports,
          (select coalesce(sum(cost_usd), 0) from public.import_usage i where i.created_at >= g.day and i.created_at < g.day + interval '1 day') as cost
        from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') g(day)
      ) d)
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_waitlist()
returns table (id uuid, email text, source text, created_at timestamptz, invited_at timestamptz, has_account boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
    select w.id, w.email, w.source, w.created_at, w.invited_at,
      exists (select 1 from public.profiles p where lower(p.email) = lower(w.email))
    from public.waitlist w
    order by w.created_at desc;
end;
$$;

create or replace function public.admin_users()
returns table (
  id uuid, full_name text, username text, email text, joined_at timestamptz, onboarded boolean,
  recipes bigint, cooks bigint, imports_30d bigint, cost_month numeric, cost_all numeric,
  last_active timestamptz, invited_by uuid, invited_by_name text, invite_source text,
  codes_left bigint, codes_used bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago';
begin
  perform public.require_admin();
  return query
    select p.id, p.full_name::text, p.username::text, p.email::text, u.created_at, coalesce(p.onboarding_complete, false),
      (select count(*) from public.recipes r where r.user_id = p.id),
      (select count(*) from public.cooks c where c.user_id = p.id),
      (select count(*) from public.import_usage i where i.user_id = p.id and i.created_at > now() - interval '30 days'),
      (select coalesce(sum(i.cost_usd), 0) from public.import_usage i where i.user_id = p.id and i.created_at >= month_start),
      (select coalesce(sum(i.cost_usd), 0) from public.import_usage i where i.user_id = p.id),
      greatest(
        (select max(r.created_at) from public.recipes r where r.user_id = p.id),
        (select max(c.cooked_at) from public.cooks c where c.user_id = p.id),
        (select max(i.created_at) from public.import_usage i where i.user_id = p.id)),
      inv.created_by,
      coalesce(ip.full_name, ip.username)::text,
      inv.source,
      (select count(*) from public.invites x where x.created_by = p.id and x.used_by is null),
      (select count(*) from public.invites x where x.created_by = p.id and x.used_by is not null)
    from public.profiles p
    join auth.users u on u.id = p.id
    left join lateral (select i2.created_by, i2.source from public.invites i2 where i2.used_by = p.id limit 1) inv on true
    left join public.profiles ip on ip.id = inv.created_by
    order by u.created_at desc;
end;
$$;

-- Change settings from the Admin page. Only the fields you send change.
create or replace function public.admin_update_settings(p jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  s public.admin_settings;
begin
  perform public.require_admin();
  update public.admin_settings set
    monthly_budget     = coalesce((p->>'monthly_budget')::numeric, monthly_budget),
    fixed_costs        = coalesce((p->>'fixed_costs')::numeric, fixed_costs),
    codes_per_new_user = coalesce((p->>'codes_per_new_user')::int, codes_per_new_user),
    friend_invites_on  = coalesce((p->>'friend_invites_on')::boolean, friend_invites_on),
    paused_reason      = case when p ? 'friend_invites_on' then null else paused_reason end,
    updated_at = now()
  where id = 1
  returning * into s;
  -- A lower budget might already be crossed
  if p ? 'monthly_budget' then perform public.check_budget(); end if;
  select * into s from public.admin_settings where id = 1;
  return row_to_json(s);
end;
$$;

-- Lock all admin functions to signed-in accounts (and they check is_admin inside)
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_waitlist() from public, anon;
revoke all on function public.admin_users() from public, anon;
revoke all on function public.admin_update_settings(jsonb) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_waitlist() to authenticated;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_update_settings(jsonb) to authenticated;
