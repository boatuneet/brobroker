-- BroBroker analytics migration (June 2026)
--
-- Adds two columns the dashboard analytics need:
--   1. public.buyers.source         — where the lead came from (referral,
--                                     website, voice_note, marketplace,
--                                     email, social, other). Powers the
--                                     "Deal sources" donut on the dashboard.
--   2. public.broker_tasks.completed_at — when the task moved to Done.
--                                     Powers the "Completed this month"
--                                     counter on the dashboard.
--
-- Idempotent — safe to run more than once. Existing rows get a NULL value
-- which the app treats as "Unknown source" / "Not yet completed".

begin;

-- ────────────────────────────────────────────────────────────────────────
-- Buyers: source attribution
-- ────────────────────────────────────────────────────────────────────────
alter table public.buyers
  add column if not exists source text;

-- Constrain the values to a stable, finite set the UI knows how to render.
-- Tightening later (e.g. tying to a lookup table) is straightforward, but
-- a CHECK constraint keeps the values clean today.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.buyers'::regclass
      and conname  = 'buyers_source_check'
  ) then
    alter table public.buyers
      add constraint buyers_source_check
      check (
        source is null
        or source in (
          'referral',
          'website',
          'voice_note',
          'marketplace',
          'email',
          'social',
          'other'
        )
      );
  end if;
end$$;

create index if not exists buyers_owner_source_idx
  on public.buyers (owner_user_id, source);

-- ────────────────────────────────────────────────────────────────────────
-- Broker tasks: completed_at
-- ────────────────────────────────────────────────────────────────────────
alter table public.broker_tasks
  add column if not exists completed_at timestamptz;

-- Index helps the "completed this month" aggregation stay fast as the
-- task table grows.
create index if not exists broker_tasks_owner_completed_at_idx
  on public.broker_tasks (owner_user_id, completed_at)
  where completed_at is not null;

-- Optional convenience: keep `status` and `completed_at` in agreement.
-- If a row is set to Done the trigger stamps completed_at; if a row leaves
-- Done the trigger clears it. Brokers/services can still set completed_at
-- explicitly when wiring API mutations.
create or replace function public.broker_tasks_sync_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Done' and (old.status is distinct from 'Done') then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status is distinct from 'Done' and old.status = 'Done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists broker_tasks_sync_completed_at on public.broker_tasks;
create trigger broker_tasks_sync_completed_at
  before update on public.broker_tasks
  for each row
  execute function public.broker_tasks_sync_completed_at();

commit;
