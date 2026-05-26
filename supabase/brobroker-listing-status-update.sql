-- Allow intake-created listings to be saved as database-backed drafts.
-- Run this if you already ran supabase/brobroker-manual-setup.sql before Draft status existed.

alter table public.assets
  drop constraint if exists assets_status_check;

alter table public.assets
  add constraint assets_status_check
  check (status in ('Draft', 'Active', 'Pre-Market', 'Under Offer', 'Coming Soon'));
