-- Bring your recipes (bulk import), 1.0.4.
-- Two parts. Run them at different times.

-- ════════════════════════════════════════════════════════════════════
-- PART 1: run now, before testing the bulk-import branch.
-- Only adds two empty columns, so the live app keeps working exactly as before.
-- ════════════════════════════════════════════════════════════════════

-- Where a bulk-imported recipe came from ('paprika', 'links'). Empty for everything
-- saved the normal way. The Feed and Activity skip recipes that have it, so imports stay silent.
alter table public.recipes add column if not exists imported_from text;

-- Why an imported recipe might need a look ('no_steps', 'too_few_steps', 'no_ingredients', ...).
-- Shows in the Cookbook's Needs a look filter. Cleared when the recipe is edited and saved.
alter table public.recipes add column if not exists needs_look text;


-- ════════════════════════════════════════════════════════════════════
-- PART 2: run on release day (when the 1.0.4 code goes to main), NOT before.
-- Changes the daily limit for AI imports to 40 a day, every day
-- (today: 40 in someone's first week, then 10). Files never count.
-- ════════════════════════════════════════════════════════════════════

-- create or replace function public.import_cap(uid uuid, out daily_cap int, out first_week boolean)
-- language sql
-- stable
-- security definer
-- set search_path = public
-- as $$
--   select 40, u.created_at > now() - interval '7 days'
--   from auth.users u where u.id = uid
-- $$;
