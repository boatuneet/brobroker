# BroBroker Knowledge Vault

The Knowledge Vault is a generated broker-memory layer. It compiles operational records into readable, source-linked pages, but it is not the source of truth.

Source-of-truth records stay in the normal product tables:

- `assets`
- `buyers`
- `sellers`
- `broker_tasks`
- `verification_cases`
- `match_results`
- `seller_report_inputs`
- `deal_rooms`
- `audit_events`

Generated vault pages can be regenerated when those records change. The optional Supabase add-on in `supabase/brobroker-knowledge-vault.sql` creates tables for future persisted pages, source lineage, and lint findings:

- `knowledge_pages`
- `knowledge_sources`
- `knowledge_lint_findings`

Each persisted page should keep source links so brokers can see where generated claims came from, identify stale or contradictory facts, and require broker review before any external sharing.
