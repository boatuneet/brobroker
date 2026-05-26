-- BroBroker manual Supabase setup
-- Run this in the Supabase SQL editor after Auth is configured.
--
-- Prototype security model:
-- - App routes require login.
-- - Tables are RLS-enabled.
-- - Rows inserted by the app default to owner_user_id = auth.uid().
-- - Seed/demo rows may leave owner_user_id null so the signed-in prototype
--   broker can read them. Before production, make owner_user_id NOT NULL and
--   add organization/tenant membership policies.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.broker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  brokerage_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  asset_type text not null check (asset_type in ('Yacht', 'Car', 'Real Estate')),
  name text not null,
  builder text not null,
  model text not null,
  year integer,
  price_eur numeric(14,2) not null,
  metric_value numeric,
  metric_label text,
  location text not null,
  vat_status text check (vat_status in ('EU VAT Paid', 'Not Paid', 'Unknown', 'Commercial')),
  status text check (status in ('Draft', 'Active', 'Pre-Market', 'Under Offer', 'Coming Soon')),
  seller_id text,
  spec_summary text,
  documents jsonb not null default '[]'::jsonb,
  comps jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  missing_info text[] not null default '{}',
  owner_notes text[] not null default '{}',
  broker_only_notes text[] not null default '{}',
  market_signals text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyers (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  company text,
  country text,
  budget_min_eur numeric(14,2),
  budget_max_eur numeric(14,2),
  stage text,
  urgency text,
  verification_case_id text,
  next_action_due_at date,
  tags text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  rejected_assets jsonb not null default '[]'::jsonb,
  relationship_notes text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sellers (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  asset_ids text[] not null default '{}',
  motivation text,
  communication_expectation text,
  pricing_sensitivity text,
  feedback_history text[] not null default '{}',
  reporting_cadence text,
  next_owner_update_due_at date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  buyer_id text references public.buyers(id) on delete set null,
  seller_id text references public.sellers(id) on delete set null,
  asset_id text references public.assets(id) on delete set null,
  channel text not null,
  summary text not null,
  sentiment text check (sentiment in ('Positive', 'Neutral', 'Concerned')),
  occurred_at timestamptz not null default now(),
  needs_summary boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.broker_tasks (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null,
  kind text not null,
  priority text check (priority in ('Critical', 'High', 'Medium', 'Low')),
  status text check (status in ('Open', 'In Progress', 'Waiting', 'Done')),
  due_at date,
  reason text,
  action_label text,
  buyer_id text references public.buyers(id) on delete set null,
  seller_id text references public.sellers(id) on delete set null,
  asset_id text references public.assets(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_cases (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  buyer_id text references public.buyers(id) on delete cascade,
  asset_id text references public.assets(id) on delete set null,
  requested_access text not null,
  status text not null check (status in ('Verified', 'Needs Review', 'High Risk')),
  score integer not null default 0 check (score >= 0 and score <= 100),
  recommended_action text,
  signals jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_results (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  buyer_id text references public.buyers(id) on delete cascade,
  asset_id text references public.assets(id) on delete cascade,
  category text check (category in ('Exact Match', 'Close Match', 'Smart Substitute')),
  fit_score integer not null default 0 check (fit_score >= 0 and fit_score <= 100),
  rationale text,
  criteria_met text[] not null default '{}',
  missing_criteria text[] not null default '{}',
  talking_points text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follow_up_drafts (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  buyer_id text references public.buyers(id) on delete set null,
  seller_id text references public.sellers(id) on delete set null,
  asset_id text references public.assets(id) on delete set null,
  kind text,
  channel text not null,
  status text not null check (status in ('Draft', 'Edited', 'Approved')),
  subject text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_report_inputs (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  seller_id text references public.sellers(id) on delete cascade,
  asset_id text references public.assets(id) on delete cascade,
  period text not null,
  inquiries integer not null default 0,
  qualified_leads integer not null default 0,
  viewings integer not null default 0,
  common_objections text[] not null default '{}',
  market_movement text[] not null default '{}',
  next_week_plan text[] not null default '{}',
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_rooms (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  buyer_id text references public.buyers(id) on delete cascade,
  title text not null,
  status text not null check (status in ('Draft', 'Active', 'Paused')),
  verification_status text not null check (verification_status in ('Verified', 'Needs Review', 'High Risk')),
  broker_approval_status text not null check (broker_approval_status in ('Not Requested', 'Pending', 'Approved')),
  asset_ids text[] not null default '{}',
  itinerary text[] not null default '{}',
  approved_document_ids text[] not null default '{}',
  share_token uuid not null default extensions.gen_random_uuid(),
  passcode_hash text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  actor text not null check (actor in ('System', 'Broker')),
  label text not null,
  detail text not null,
  entity_type text,
  entity_id text,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_events (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  kind text not null,
  record_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_chunks (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  entity_type text not null,
  entity_id text not null,
  visibility text not null default 'broker' check (visibility in ('broker', 'buyer_safe', 'seller_sensitive')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'broker_profiles',
    'assets',
    'buyers',
    'sellers',
    'conversations',
    'broker_tasks',
    'verification_cases',
    'match_results',
    'follow_up_drafts',
    'seller_report_inputs',
    'deal_rooms',
    'memory_chunks'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'broker_profiles',
    'assets',
    'buyers',
    'sellers',
    'conversations',
    'broker_tasks',
    'verification_cases',
    'match_results',
    'follow_up_drafts',
    'seller_report_inputs',
    'deal_rooms',
    'audit_events',
    'workflow_events',
    'memory_chunks'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

drop policy if exists "Users can manage own profile" on public.broker_profiles;
create policy "Users can manage own profile"
on public.broker_profiles
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assets',
    'buyers',
    'sellers',
    'conversations',
    'broker_tasks',
    'verification_cases',
    'match_results',
    'follow_up_drafts',
    'seller_report_inputs',
    'deal_rooms',
    'audit_events',
    'workflow_events',
    'memory_chunks'
  ]
  loop
    execute format('drop policy if exists "Authenticated brokers can read %1$I" on public.%1$I', table_name);
    execute format(
      'create policy "Authenticated brokers can read %1$I" on public.%1$I for select to authenticated using (owner_user_id is null or (select auth.uid()) = owner_user_id)',
      table_name
    );

    execute format('drop policy if exists "Authenticated brokers can insert %1$I" on public.%1$I', table_name);
    execute format(
      'create policy "Authenticated brokers can insert %1$I" on public.%1$I for insert to authenticated with check (owner_user_id is null or (select auth.uid()) = owner_user_id)',
      table_name
    );

    execute format('drop policy if exists "Authenticated brokers can update %1$I" on public.%1$I', table_name);
    execute format(
      'create policy "Authenticated brokers can update %1$I" on public.%1$I for update to authenticated using (owner_user_id is null or (select auth.uid()) = owner_user_id) with check (owner_user_id is null or (select auth.uid()) = owner_user_id)',
      table_name
    );

    execute format('drop policy if exists "Authenticated brokers can delete %1$I" on public.%1$I', table_name);
    execute format(
      'create policy "Authenticated brokers can delete %1$I" on public.%1$I for delete to authenticated using (owner_user_id is null or (select auth.uid()) = owner_user_id)',
      table_name
    );
  end loop;
end $$;

create index if not exists assets_asset_type_idx on public.assets(asset_type);
create index if not exists assets_status_idx on public.assets(status);
create index if not exists assets_seller_id_idx on public.assets(seller_id);
create index if not exists buyers_stage_idx on public.buyers(stage);
create index if not exists buyers_next_action_idx on public.buyers(next_action_due_at);
create index if not exists broker_tasks_due_idx on public.broker_tasks(due_at, status);
create index if not exists verification_cases_status_idx on public.verification_cases(status);
create index if not exists deal_rooms_buyer_idx on public.deal_rooms(buyer_id);
create index if not exists audit_events_entity_idx on public.audit_events(entity_type, entity_id);
create index if not exists workflow_events_kind_idx on public.workflow_events(kind, created_at desc);
create index if not exists memory_chunks_entity_idx on public.memory_chunks(entity_type, entity_id);
create index if not exists memory_chunks_embedding_idx on public.memory_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'broker-documents',
  'broker-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated brokers can read broker documents" on storage.objects;
create policy "Authenticated brokers can read broker documents"
on storage.objects
for select
to authenticated
using (bucket_id = 'broker-documents');

drop policy if exists "Authenticated brokers can upload broker documents" on storage.objects;
create policy "Authenticated brokers can upload broker documents"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'broker-documents');

drop policy if exists "Authenticated brokers can update own broker documents" on storage.objects;
create policy "Authenticated brokers can update own broker documents"
on storage.objects
for update
to authenticated
using (bucket_id = 'broker-documents')
with check (bucket_id = 'broker-documents');

drop policy if exists "Authenticated brokers can delete own broker documents" on storage.objects;
create policy "Authenticated brokers can delete own broker documents"
on storage.objects
for delete
to authenticated
using (bucket_id = 'broker-documents');
