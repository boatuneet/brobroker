-- Onboarding completion, durable per broker (replaces the per-browser cookie
-- as the source of truth; the cookie remains a fast-path cache).
--
-- profiles is the ACTIVE profile table (name/avatar live here) — the older
-- broker_profiles table is dormant in code, so the flag belongs on profiles.
--
-- Idempotent: safe to paste into the Supabase SQL editor more than once.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'When the broker completed or skipped the /welcome onboarding flow.';
