## ADDED Requirements

### Requirement: Private Deal Room Creation
The system SHALL allow a broker to create a private buyer deal room for a serious buyer with selected listings, comparison rationale, approved documents, itinerary details, financing or service links, and broker contact context.

#### Scenario: Broker creates deal room
- **WHEN** a broker creates a deal room for a verified or broker-approved buyer
- **THEN** the system creates a buyer-facing page containing only broker-approved listings, documents, comparisons, and next steps

### Requirement: Buyer-Safe Shortlist Presentation
The system SHALL present shortlisted assets with buyer-safe rationale, comparison table, photos/media references, key specs, trade-offs, and next-step calls to action.

#### Scenario: Buyer opens shortlist
- **WHEN** a buyer opens the private deal room
- **THEN** the system shows the recommended assets, why each fits, key trade-offs, and broker-approved next actions without exposing internal notes

### Requirement: Scoped Deal Room Q&A
The system SHALL answer buyer questions only from broker-approved listing knowledge and SHALL avoid broker-only notes, seller-sensitive details, risk labels, or unapproved claims.

#### Scenario: Buyer asks approved question
- **WHEN** a buyer asks about cabins, refit history, location, or availability that exists in approved listing knowledge
- **THEN** the system returns an answer based on approved deal room content

#### Scenario: Buyer asks restricted question
- **WHEN** a buyer asks for information that is missing, seller-sensitive, or broker-only
- **THEN** the system says the broker will confirm the detail and creates a broker follow-up task

### Requirement: Deal Room Access Control
The system SHALL show deal room access status, verification status, broker approval status, and last updated timestamp to the broker.

#### Scenario: Verification is incomplete
- **WHEN** a broker attempts to activate a deal room for a buyer with Needs Review or High Risk verification status
- **THEN** the system warns the broker and requires explicit broker approval before activating access
