-- Buyer questions submitted from the public shared-room page.
-- Idempotent: safe to re-run.
--
-- Insert path: only via the /api/room-question route using the service-role
-- key (bypasses RLS). Anonymous buyers hit the API, the API validates the
-- room exists and inserts here. No anon RLS insert policy exists on purpose;
-- if you swap the API to a signed-in-user client you'll need to add one.
--
-- Read/update path: authed brokers, scoped to rooms they own.

create table if not exists public.deal_room_questions (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id text not null,
  question text not null,
  auto_answer text,
  status text not null default 'open' check (status in ('open', 'answered')),
  broker_answer text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz
);

create index if not exists deal_room_questions_room_idx
  on public.deal_room_questions(room_id);

alter table public.deal_room_questions enable row level security;

grant select, update on public.deal_room_questions to authenticated;

drop policy if exists "Broker can read questions for owned rooms"
  on public.deal_room_questions;
create policy "Broker can read questions for owned rooms"
on public.deal_room_questions
for select
to authenticated
using (
  exists (
    select 1 from public.deal_rooms dr
    where dr.id = room_id
      and dr.owner_user_id = (select auth.uid())
  )
);

drop policy if exists "Broker can update questions for owned rooms"
  on public.deal_room_questions;
create policy "Broker can update questions for owned rooms"
on public.deal_room_questions
for update
to authenticated
using (
  exists (
    select 1 from public.deal_rooms dr
    where dr.id = room_id
      and dr.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.deal_rooms dr
    where dr.id = room_id
      and dr.owner_user_id = (select auth.uid())
  )
);
