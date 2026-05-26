## ADDED Requirements

### Requirement: Buyer Memory Profile
The system SHALL maintain a buyer memory profile with budget, preferred brands/models, size range, location, lifestyle preferences, must-haves, deal breakers, objections, rejected assets, urgency, decision timeline, relationship notes, and communication style.

#### Scenario: Broker reviews buyer memory
- **WHEN** a broker opens a buyer profile
- **THEN** the system displays the buyer's current criteria, preferences, rejected assets with reasons, urgency, relationship notes, and recommended next action

#### Scenario: New preference is captured
- **WHEN** a broker records that a buyer wants a modern light interior and EU VAT-paid yacht before summer
- **THEN** the system updates the buyer memory and uses those preferences in future matching and follow-up drafts

### Requirement: Seller Memory Profile
The system SHALL maintain seller or owner memory with motivation, communication expectations, listing goals, pricing sensitivity, feedback history, reporting cadence, and next owner update due date.

#### Scenario: Broker opens seller context
- **WHEN** a broker opens a listing owner's profile
- **THEN** the system shows seller motivation, expectations, prior feedback, pricing concerns, and upcoming owner update needs

### Requirement: Relationship Continuity
The system SHALL use buyer and seller memory to make generated communication feel specific, consistent, and personally aware without exposing broker-only notes to external clients.

#### Scenario: Follow-up uses remembered context
- **WHEN** the system drafts a follow-up for a buyer who rejected an older interior
- **THEN** the draft references newer interior options and avoids recommending assets that repeat the rejected pattern

#### Scenario: Buyer-safe communication is generated
- **WHEN** a broker generates buyer-facing communication from memory
- **THEN** the system excludes internal notes, sensitive seller context, and risk labels from the buyer-facing output

### Requirement: Memory-Derived Next Actions
The system SHALL recommend next actions from memory, deal status, due dates, and recent conversations.

#### Scenario: Buyer has stale momentum
- **WHEN** a serious buyer has no follow-up after a viewing or call
- **THEN** the system recommends a next action with a reason and a suggested draft or task
