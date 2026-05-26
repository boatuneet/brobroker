## 1. Knowledge Model

- [x] 1.1 Define typed knowledge vault page, section, source, relation, and health-check models.
- [x] 1.2 Implement a segment-aware compiler that generates pages from existing demo and stored app data.
- [x] 1.3 Add unit coverage for source counts, open gaps, and segment filtering.

## 2. Broker Workspace UI

- [x] 2.1 Add a Knowledge Vault route and sidebar/mobile navigation entry.
- [x] 2.2 Build a searchable vault index with category filters, health metrics, and selected-page detail.
- [x] 2.3 Render source references, related entities, page sections, confidence, freshness, and open gaps cleanly.

## 3. Persistence Path

- [x] 3.1 Add Supabase manual SQL for knowledge pages, sources, and lint findings with indexes and RLS.
- [x] 3.2 Document that generated vault pages are a compiled layer over operational tables, not a replacement source of truth.

## 4. Verification

- [x] 4.1 Run lint, tests, and production build.
- [x] 4.2 Smoke-check the Knowledge Vault in browser at desktop and mobile sizes.
