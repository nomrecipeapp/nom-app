-- Report + Block (Apple guideline 1.2). Run once in the Supabase SQL Editor.

-- 1. Reports: one row per report a user files
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'cook', 'save', 'profile')),
  target_id text not null,
  reason text not null,
  note text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "Users can file reports" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());
create policy "Users can see their own reports" on public.reports
  for select to authenticated using (reporter_id = auth.uid());

-- 2. Blocks: who blocked whom
create table public.blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "Users can see who they blocked" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "Users can block" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "Users can unblock" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- 3. Is there a block between two people, in either direction?
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- 4. Everyone I blocked or who blocked me (the app hides these people)
create or replace function public.my_block_list()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;

-- 5. Blocking someone removes follows in both directions
create or replace function public.remove_follows_on_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;
create trigger on_block_remove_follows
  after insert on public.blocks
  for each row execute function public.remove_follows_on_block();

-- 6. No follow requests between people who have blocked each other
create policy "No follows between blocked users" on public.follows
  as restrictive for insert to authenticated
  with check (not public.is_blocked_between(follower_id, following_id));
