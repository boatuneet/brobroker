## Context

BroBroker currently stores and displays domain records across separate workflow screens: assets/listings, buyers, sellers, tasks, verification cases, matches, reports, deal rooms, conversations, audit events, and memory chunks. The product idea is already "broker memory", but the app does not yet expose a compiled, inspectable knowledge layer that connects those records into a persistent wiki-like view.

The first implementation should work immediately from existing demo and stored records, then leave a Supabase path for persisting generated pages, source lineage, and lint findings. This keeps the prototype useful before a full LLM ingest pipeline exists.

## Goals / Non-Goals

**Goals:**
- Add a Knowledge Vault route that generates workspace-level wiki pages from current broker records.
- Make the vault segment-aware so a yacht broker, car broker, or real-estate broker sees only the active workspace context.
- Represent pages as typed data with category, summary, body sections, source references, related entities, confidence, freshness, and gaps.
- Surface health checks such as missing facts, contradiction risks, stale pages, and source coverage.
- Provide SQL for future persistence of generated pages and source mappings with RLS.

**Non-Goals:**
- Do not replace operational tables with markdown files.
- Do not add a live LLM generation dependency in this change.
- Do not implement embeddings, vector retrieval, or external document ingestion yet.
- Do not expose broker-only wiki content to buyers, sellers, or public deal-room guests.

## Decisions

- **Generate first, persist later.** The initial UI compiles pages from existing in-app data at request time. Supabase tables are added as an optional manual setup path for future persistence. This avoids blocking the feature on an LLM pipeline while giving us an architecture-compatible destination.
- **Workspace vault over per-customer vaults.** Each buyer/listing/seller gets a page inside the selected broker workspace. This preserves cross-entity reasoning, which is the real value of the LLM Wiki pattern.
- **Source references are structured.** Every generated page includes references to source records by type and id. This makes claims auditable and prepares us for persisted source lineage.
- **Markdown-inspired, UI-native rendering.** Pages are represented as structured sections and rendered as clean cards instead of raw markdown in the first version. This keeps the app polished and avoids adding a markdown parser dependency.
- **Human-sensitive by default.** Pages may include broker-only or seller-sensitive notes in the broker app, but the SQL model includes visibility and approval fields so future sharing can be controlled.

## Risks / Trade-offs

- **Generated summaries can feel too deterministic without a real LLM.** Mitigation: frame the first version as a compiled vault and keep source links/gaps visible; add LLM-backed ingestion later.
- **A vault can duplicate information from existing screens.** Mitigation: focus on synthesis, source lineage, cross-links, and gaps rather than editing every underlying record.
- **Incorrect generated claims could compound if persisted.** Mitigation: store source references, confidence, status, generated_at, and lint findings; require approval before future external sharing.
- **More navigation can clutter the sidebar.** Mitigation: use a concise "Knowledge" item with a book/search icon and keep the vault as an analysis workspace.
