-- BroBroker · add first-class description + specifications to listings
-- ---------------------------------------------------------------------------
-- Until now the buyer-facing description and the free-text specs/equipment
-- block lived only inside assets.payload (jsonb). Promoting them to real
-- columns makes them queryable, indexable, and available to the matching and
-- knowledge layers as structured listing intelligence.
--
-- Safe to run multiple times: every statement is guarded with IF NOT EXISTS
-- and the backfill only touches rows where the column is still null.

-- 1) Columns -----------------------------------------------------------------
alter table public.assets
  add column if not exists description text;

alter table public.assets
  add column if not exists specifications text;

-- 2) Backfill existing rows from payload -------------------------------------
-- description: payload.description, else payload.fields.description
update public.assets
set description = coalesce(
  nullif(payload->>'description', ''),
  nullif(payload->'fields'->>'description', '')
)
where description is null
  and coalesce(
    nullif(payload->>'description', ''),
    nullif(payload->'fields'->>'description', '')
  ) is not null;

-- specifications: payload.fields.equipment, else payload.specifications
update public.assets
set specifications = coalesce(
  nullif(payload->'fields'->>'equipment', ''),
  nullif(payload->>'specifications', '')
)
where specifications is null
  and coalesce(
    nullif(payload->'fields'->>'equipment', ''),
    nullif(payload->>'specifications', '')
  ) is not null;

-- 3) Full-text search support (optional but cheap) ---------------------------
-- A GIN index over the combined free text so future keyword/semantic matching
-- and the knowledge layer can search descriptions and specs efficiently.
create index if not exists assets_description_specs_fts_idx
  on public.assets
  using gin (
    to_tsvector(
      'simple',
      coalesce(description, '') || ' ' || coalesce(specifications, '')
    )
  );
