-- Nom 1.0.3. Run once in the Supabase SQL Editor, BEFORE the matching code goes live.
-- Safe to run again: every step checks first.
--
-- What this adds:
--   1. cooks.shared_to_feed: the "Share to feed" switch on Log a Cook (on by default,
--      so every existing cook keeps showing exactly like today)
--   2. device_tokens: each iPhone's push address, so Nom can send push notifications.
--      People can only see, add or remove their own phone's address.
--
-- Nothing here changes what members see.

-- ───────────────────────── 1. Share to feed ─────────────────────────
alter table public.cooks
  add column if not exists shared_to_feed boolean not null default true;

-- ───────────────────────── 2. Push notification addresses ─────────────────────────
create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_id_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "Own device tokens: read" on public.device_tokens;
create policy "Own device tokens: read" on public.device_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "Own device tokens: add" on public.device_tokens;
create policy "Own device tokens: add" on public.device_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "Own device tokens: update" on public.device_tokens;
create policy "Own device tokens: update" on public.device_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Own device tokens: remove" on public.device_tokens;
create policy "Own device tokens: remove" on public.device_tokens
  for delete using (auth.uid() = user_id);

-- A phone that changes hands (someone signs out, someone else signs in) keeps one address.
-- This lets the new person claim it, even though the old row belongs to someone else.
create or replace function public.claim_device_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.device_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, 'ios'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.claim_device_token(text, text) from public, anon;
grant execute on function public.claim_device_token(text, text) to authenticated;

-- Quick check: should print 1 and 1
select
  (select count(*) from information_schema.columns where table_name = 'cooks' and column_name = 'shared_to_feed') as share_column,
  (select count(*) from information_schema.tables where table_name = 'device_tokens') as tokens_table;
