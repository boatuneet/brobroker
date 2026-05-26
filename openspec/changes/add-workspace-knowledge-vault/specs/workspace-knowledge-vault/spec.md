## ADDED Requirements

### Requirement: Workspace knowledge pages
The system SHALL compile selected workspace records into generated knowledge pages for the active broker segment.

#### Scenario: Segment-specific vault
- **WHEN** a broker opens the Knowledge Vault while the active segment is Real Estate
- **THEN** the vault shows generated pages from real-estate listings, buyers, sellers, tasks, matches, verification cases, reports, and deal rooms only

#### Scenario: Entity page content
- **WHEN** the vault generates a buyer, listing, seller, or deal-room page
- **THEN** the page includes a concise summary, structured sections, source references, related entity links, confidence, last-updated metadata, and open gaps when available

### Requirement: Source lineage
The system SHALL expose source references for generated knowledge pages so brokers can see which records informed each page.

#### Scenario: Source references shown
- **WHEN** a broker selects a generated page
- **THEN** the page shows source labels grouped by record type and includes record ids for auditability

### Requirement: Knowledge health checks
The system SHALL generate workspace-level health checks that identify missing intelligence, stale records, contradiction risks, and source coverage.

#### Scenario: Missing intelligence rollup
- **WHEN** listings or buyers have missing information
- **THEN** the vault includes an Open Gaps page that groups those missing facts by entity

#### Scenario: Source coverage rollup
- **WHEN** the vault compiles pages from multiple record types
- **THEN** the vault shows counts for total pages, source records, open gaps, and pages with lower confidence

### Requirement: Persistable knowledge model
The system SHALL provide a Supabase-compatible schema for storing generated knowledge pages, source links, and lint findings without replacing operational tables.

#### Scenario: Manual SQL setup
- **WHEN** a broker runs the Knowledge Vault SQL add-on in Supabase
- **THEN** tables for knowledge pages, knowledge sources, and knowledge lint findings are created with RLS policies scoped to the signed-in broker
