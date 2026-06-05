-- BroBroker · Requirement sets
-- ---------------------------------------------------------------------------
-- Multiple matching "asks" per buyer. A buyer's on-record ask is the implicit
-- "Primary" set (no row); additional named sets live here so matching isn't
-- locked to a single brief.
--
-- buyer_id is plain text (no FK) so BOTH demo/seed buyers and stored buyers can
-- carry sets. RLS scopes every row to the signed-in broker. Run once after the
-- core manual setup (it reuses public.set_updated_at()).
-- ---------------------------------------------------------------------------

create table if not exists public.requirement_sets (
  id text primary key,
  owner_user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  buyer_id text not null,
  label text not null,
  budget_min_eur bigint not null default 0,
  budget_max_eur bigint not null default 0,
  size_min_ft integer not null default 0,
  size_max_ft integer not null default 0,
  preferred_brands jsonb not null default '[]'::jsonb,
  preferred_locations jsonb not null default '[]'::jsonb,
  must_haves jsonb not null default '[]'::jsonb,
  deal_breakers jsonb not null default '[]'::jsonb,
  urgency text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requirement_sets_owner_buyer_idx
  on public.requirement_sets (owner_user_id, buyer_id);

-- Keep updated_at fresh (reuses the shared trigger function from the core setup).
drop trigger if exists set_requirement_sets_updated_at on public.requirement_sets;
create trigger set_requirement_sets_updated_at
  before update on public.requirement_sets
  for each row execute function public.set_updated_at();

alter table public.requirement_sets enable row level security;
grant select, insert, update, delete on public.requirement_sets to authenticated;

drop policy if exists "Users manage own requirement sets" on public.requirement_sets;
create policy "Users manage own requirement sets"
on public.requirement_sets
for all
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);
