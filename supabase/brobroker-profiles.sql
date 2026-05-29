-- BroBroker profile + avatar schema
--
-- Adds a `profiles` row per auth user (full_name + avatar_url) plus an
-- `avatars` storage bucket. Both gated by row-level security so a broker can
-- only read/write their own profile and upload to their own avatar path.
--
-- Run this once against your Supabase project (Studio → SQL editor) before
-- using the Profile editor. Safe to re-run — uses IF NOT EXISTS / DROP ... IF
-- EXISTS for policies.

-- ============================================================
-- 1. profiles table
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- Updated-at trigger so the column stays honest without app effort.
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

-- Read your own profile.
drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

-- Insert your own profile row.
drop policy if exists "Owner can insert profile" on public.profiles;
create policy "Owner can insert profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Update your own profile row.
drop policy if exists "Owner can update profile" on public.profiles;
create policy "Owner can update profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a blank profile row when a new auth user signs up so the
-- client doesn't have to handle "no row yet" branches.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill rows for any users created before the trigger existed.
insert into public.profiles (id)
select u.id from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ============================================================
-- 2. avatars storage bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Avatar files live under <user-id>/<filename>. Owner only writes.
-- Public read is fine — avatars are typically embedded by URL in the UI and
-- the bucket is marked public above.

drop policy if exists "Avatars: public read" on storage.objects;
create policy "Avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Avatars: owner can upload" on storage.objects;
create policy "Avatars: owner can upload"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatars: owner can update" on storage.objects;
create policy "Avatars: owner can update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatars: owner can delete" on storage.objects;
create policy "Avatars: owner can delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
