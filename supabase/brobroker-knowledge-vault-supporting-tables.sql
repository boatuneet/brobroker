-- BroBroker Knowledge Vault supporting tables
-- Run this after brobroker-knowledge-vault-core.sql succeeds.
-- Run the whole file in a fresh Supabase SQL query.

create table if not exists public.knowledge_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  knowledge_page_id text not null references public.knowledge_pages(id) on delete cascade,
  source_type text not null,
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
  severity text not null default 'Info',
  finding_type text not null,
  title text not null,
  detail text not null,
  status text not null default 'Open',
  resolved_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_lint_findings enable row level security;

grant select, insert, update, delete on public.knowledge_sources to authenticated;
grant select, insert, update, delete on public.knowledge_lint_findings to authenticated;

drop policy if exists "Authenticated brokers can read knowledge_sources" on public.knowledge_sources;
create policy "Authenticated brokers can read knowledge_sources"
on public.knowledge_sources
for select
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can insert knowledge_sources" on public.knowledge_sources;
create policy "Authenticated brokers can insert knowledge_sources"
on public.knowledge_sources
for insert
to authenticated
with check (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can update knowledge_sources" on public.knowledge_sources;
create policy "Authenticated brokers can update knowledge_sources"
on public.knowledge_sources
for update
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid())
with check (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can delete knowledge_sources" on public.knowledge_sources;
create policy "Authenticated brokers can delete knowledge_sources"
on public.knowledge_sources
for delete
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can read knowledge_lint_findings" on public.knowledge_lint_findings;
create policy "Authenticated brokers can read knowledge_lint_findings"
on public.knowledge_lint_findings
for select
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can insert knowledge_lint_findings" on public.knowledge_lint_findings;
create policy "Authenticated brokers can insert knowledge_lint_findings"
on public.knowledge_lint_findings
for insert
to authenticated
with check (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can update knowledge_lint_findings" on public.knowledge_lint_findings;
create policy "Authenticated brokers can update knowledge_lint_findings"
on public.knowledge_lint_findings
for update
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid())
with check (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Authenticated brokers can delete knowledge_lint_findings" on public.knowledge_lint_findings;
create policy "Authenticated brokers can delete knowledge_lint_findings"
on public.knowledge_lint_findings
for delete
to authenticated
using (owner_user_id is null or owner_user_id = auth.uid());

create index if not exists knowledge_sources_page_idx
on public.knowledge_sources(knowledge_page_id);

create index if not exists knowledge_sources_source_idx
on public.knowledge_sources(source_type, source_id);

create index if not exists knowledge_lint_findings_page_idx
on public.knowledge_lint_findings(knowledge_page_id, status, severity);
