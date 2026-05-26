-- BroBroker Knowledge Vault core setup
-- Run this whole file in a fresh Supabase SQL query.
-- Do not highlight a single line before pressing Run, or Supabase will execute
-- only that selected fragment.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.knowledge_pages (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  segment text not null,
  slug text not null,
  title text not null,
  category text not null,
  summary text not null default '',
  visibility text not null default 'broker',
  status text not null default 'Generated',
  confidence integer not null default 0,
  tags text[] not null default array[]::text[],
  open_gaps text[] not null default array[]::text[],
  sections jsonb not null default '[]'::jsonb,
  relations jsonb not null default '[]'::jsonb,
  source_hash text,
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_pages enable row level security;

grant select, insert, update, delete on public.knowledge_pages to authenticated;

drop policy if exists "Authenticated brokers can read knowledge_pages" on public.knowledge_pages;
create policy "Authenticated brokers can read knowledge_pages"
on public.knowledge_pages
for select
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can insert knowledge_pages" on public.knowledge_pages;
create policy "Authenticated brokers can insert knowledge_pages"
on public.knowledge_pages
for insert
to authenticated
with check (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can update knowledge_pages" on public.knowledge_pages;
create policy "Authenticated brokers can update knowledge_pages"
on public.knowledge_pages
for update
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid())
with check (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can delete knowledge_pages" on public.knowledge_pages;
create policy "Authenticated brokers can delete knowledge_pages"
on public.knowledge_pages
for delete
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid());

create index if not exists knowledge_pages_owner_segment_idx
on public.knowledge_pages(owner_user_id, segment, category);

create index if not exists knowledge_pages_owner_segment_slug_idx
on public.knowledge_pages(owner_user_id, segment, slug);

create index if not exists knowledge_pages_status_idx
on public.knowledge_pages(status, generated_at desc);
