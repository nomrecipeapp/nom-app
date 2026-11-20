-- Nov 20, 2026: sign-up extras
-- heard_about: answer to "How did you hear about Nom?" (friend, tiktok, instagram,
--   app_store, google, reddit, or "other: <what they typed>")
-- terms_accepted_at: when they ticked "I agree to the Terms and Conditions"
-- Both are blank for people who signed up before this change.

alter table public.profiles add column if not exists heard_about text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
