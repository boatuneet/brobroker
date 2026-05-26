## Why

BroBroker already captures rich broker memory across listings, buyers, owners, tasks, verification, reports, and deal rooms, but that knowledge is scattered across workflow screens. A workspace-level Knowledge Vault will compile those records into durable, interlinked wiki-style pages so brokers can understand what the system knows, what changed, what is missing, and why recommendations are being made.

## What Changes

- Add a broker-facing Knowledge Vault workspace that generates readable wiki-style pages from existing app data.
- Provide page categories for buyers, listings, sellers, deal rooms, market notes, open gaps, and source logs.
- Show source references, related entities, confidence, generated summaries, contradictions/gaps, and next actions.
- Add navigation to the vault without replacing existing operational screens.
- Add Supabase SQL for persisted generated knowledge pages and source links so future versions can store compiled pages, source lineage, lint results, and approval state.
- Keep Supabase domain tables as the source of truth; the vault is a generated knowledge layer over those tables.

## Capabilities

### New Capabilities
- `workspace-knowledge-vault`: Generated workspace knowledge pages, indexes, source references, and health checks for broker memory.

### Modified Capabilities

## Impact

- New route and app-shell navigation item for the Knowledge Vault.
- New library module to compile existing listings, buyers, sellers, tasks, matches, verification cases, reports, conversations, deal rooms, and audit events into vault pages.
- New UI component for browsing/searching generated vault pages.
- New Supabase SQL add-on for `knowledge_pages`, `knowledge_sources`, and `knowledge_lint_findings` with RLS policies.
- No breaking changes to existing listing, buyer, verification, matching, report, or deal-room tables.
