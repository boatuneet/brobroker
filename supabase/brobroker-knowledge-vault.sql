-- BroBroker Knowledge Vault add-on
-- Run this after supabase/brobroker-manual-setup.sql when you want to persist
-- generated workspace wiki pages.
-- Supabase editor tip: clear any old selection, then select all of this file
-- and run it once. If only a trailing line like `);` is selected, Supabase will
-- execute only that fragment and report `syntax error at or near ")"`.
--
-- Important model boundary:
-- - assets, buyers, sellers, tasks, reports, rooms, and audit events remain the
--   operational source of truth.
-- - knowledge_pages are compiled/generated views over those source records.
-- - knowledge_sources preserves lineage so a page can be regenerated, reviewed,
--   or rejected without corrupting source-of-truth records.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.knowledge_pages (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  segment text not null check (segment in ('Yacht', 'Car', 'Real Estate')),
  slug text not null,
  title text not null,
  category text not null check (
    category in (
      'Overview',
      'Listing',
      'Buyer',
      'Owner',
      'Deal Room',
      'Market Note',
      'Open Gaps',
      'Source Log'
    )
  ),
  summary text not null default '',
  visibility text not null default 'broker' check (
    visibility in ('broker', 'buyer_safe', 'owner_sensitive')
  ),
  status text not null default 'Generated' check (
    status in ('Generated', 'Needs Review', 'Approved', 'Archived')
  ),
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  tags text[] not null default '{}',
  open_gaps text[] not null default '{}',
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

create table if not exists public.knowledge_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  knowledge_page_id text not null references public.knowledge_pages(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'listing',
      'buyer',
      'owner',
      'document',
      'task',
      'match',
      'verification',
      'report',
      'deal-room',
      'conversation',
      'draft',
      'audit'
    )
  ),
  source_id text not null,
  source_label text not null,
  source_table text,
  excerpt text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_lint_findings (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  knowledge_page_id text references public.knowledge_pages(id) on delete cascade,
  severity text not null check (severity in ('Info', 'Warning', 'Critical')),
  finding_type text not null check (
    finding_type in ('Missing Source', 'Contradiction', 'Stale Fact', 'Low Confidence', 'Visibility Risk')
  ),
  title text not null,
  detail text not null,
  status text not null default 'Open' check (status in ('Open', 'Resolved', 'Ignored')),
  resolved_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists set_knowledge_pages_updated_at on public.knowledge_pages;
create trigger set_knowledge_pages_updated_at
before update on public.knowledge_pages
for each row execute function public.set_updated_at();

alter table public.knowledge_pages enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_lint_findings enable row level security;

grant select, insert, update, delete on public.knowledge_pages to authenticated;
grant select, insert, update, delete on public.knowledge_sources to authenticated;
grant select, insert, update, delete on public.knowledge_lint_findings to authenticated;

drop policy if exists "Authenticated brokers can read knowledge_pages" on public.knowledge_pages;
create policy "Authenticated brokers can read knowledge_pages"
on public.knowledge_pages
for select
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can insert knowledge_pages" on public.knowledge_pages;
create policy "Authenticated brokers can insert knowledge_pages"
on public.knowledge_pages
for insert
to authenticated
with check (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can update knowledge_pages" on public.knowledge_pages;
create policy "Authenticated brokers can update knowledge_pages"
on public.knowledge_pages
for update
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id)
with check (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can delete knowledge_pages" on public.knowledge_pages;
create policy "Authenticated brokers can delete knowledge_pages"
on public.knowledge_pages
for delete
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can read knowledge_sources" on public.knowledge_sources;
create policy "Authenticated brokers can read knowledge_sources"
on public.knowledge_sources
for select
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can insert knowledge_sources" on public.knowledge_sources;
create policy "Authenticated brokers can insert knowledge_sources"
on public.knowledge_sources
for insert
to authenticated
with check (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can update knowledge_sources" on public.knowledge_sources;
create policy "Authenticated brokers can update knowledge_sources"
on public.knowledge_sources
for update
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id)
with check (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can delete knowledge_sources" on public.knowledge_sources;
create policy "Authenticated brokers can delete knowledge_sources"
on public.knowledge_sources
for delete
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can read knowledge_lint_findings" on public.knowledge_lint_findings;
create policy "Authenticated brokers can read knowledge_lint_findings"
on public.knowledge_lint_findings
for select
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can insert knowledge_lint_findings" on public.knowledge_lint_findings;
create policy "Authenticated brokers can insert knowledge_lint_findings"
on public.knowledge_lint_findings
for insert
to authenticated
with check (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can update knowledge_lint_findings" on public.knowledge_lint_findings;
create policy "Authenticated brokers can update knowledge_lint_findings"
on public.knowledge_lint_findings
for update
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id)
with check (owner_user_id is null or (select auth.uid()) = owner_user_id);

drop policy if exists "Authenticated brokers can delete knowledge_lint_findings" on public.knowledge_lint_findings;
create policy "Authenticated brokers can delete knowledge_lint_findings"
on public.knowledge_lint_findings
for delete
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id);

create index if not exists knowledge_pages_owner_segment_idx
on public.knowledge_pages(owner_user_id, segment, category);

create unique index if not exists knowledge_pages_owner_segment_slug_idx
on public.knowledge_pages(coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid), segment, slug);

create index if not exists knowledge_pages_status_idx
on public.knowledge_pages(status, generated_at desc);

create index if not exists knowledge_sources_page_idx
on public.knowledge_sources(knowledge_page_id);

create index if not exists knowledge_sources_source_idx
on public.knowledge_sources(source_type, source_id);

create index if not exists knowledge_lint_findings_page_idx
on public.knowledge_lint_findings(knowledge_page_id, status, severity);
