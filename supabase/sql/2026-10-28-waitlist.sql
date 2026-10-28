-- Invite waitlist: people without a code can leave their email. Run once in the Supabase SQL Editor.
-- Anyone (signed in or not) can add an email. Nobody can read the list from the app;
-- view it in the Supabase Table Editor.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254 and email like '%@%'),
  source text not null default 'app',
  created_at timestamptz not null default now()
);

-- One row per email, ignoring capital letters
create unique index waitlist_email_unique on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

create policy "Anyone can join the waitlist" on public.waitlist
  for insert to anon, authenticated with check (true);
