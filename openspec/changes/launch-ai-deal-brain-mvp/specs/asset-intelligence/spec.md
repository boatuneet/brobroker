## ADDED Requirements

### Requirement: Listing Knowledge Base
The system SHALL maintain a living knowledge base for each yacht listing with structured specs, document references, media references, ownership notes, refit history, tax/VAT status, location, comps, FAQs, objections, and broker-only notes.

#### Scenario: Broker opens a listing brain
- **WHEN** a broker opens a yacht listing
- **THEN** the system displays the listing's core facts, documents, media, owner notes, comps, known objections, and missing information in one workspace

#### Scenario: Broker adds new listing intelligence
- **WHEN** a broker adds a survey note, owner update, or document note to a listing
- **THEN** the system stores it against the listing and makes it available to future answers, pitches, comparisons, and missing-info checks

### Requirement: Source-Aware Broker Answers
The system SHALL generate broker-ready answers from approved listing knowledge and SHALL identify when an answer is based on missing, uncertain, or unapproved information.

#### Scenario: Broker asks an answerable listing question
- **WHEN** a broker asks "What should I highlight for a buyer who wants low maintenance?"
- **THEN** the system returns a concise answer that references relevant listing facts such as refit history, engine hours, warranty, service records, or maintenance notes

#### Scenario: Broker asks about missing information
- **WHEN** a broker asks about a detail that is not available in the listing knowledge base
- **THEN** the system states that the information is missing and suggests a follow-up action to obtain it

### Requirement: Objection And Weakness Tracking
The system SHALL track listing weaknesses, buyer objections, and broker talking points so the broker can prepare accurate communication.

#### Scenario: Buyer rejects a listing
- **WHEN** a buyer rejects a listing because of interior age, price, location, missing VAT status, or another reason
- **THEN** the system records the objection and exposes it in the listing brain and buyer memory

#### Scenario: Broker prepares a pitch
- **WHEN** a broker requests a 30-second pitch for a listing
- **THEN** the system includes strengths, likely objections, and an honest positioning angle suitable for a high-ticket buyer

### Requirement: Listing Comparison Support
The system SHALL compare a listing against another listing or competitive set using structured facts, buyer priorities, and relevant trade-offs.

#### Scenario: Broker compares two yachts
- **WHEN** a broker compares the current yacht to another yacht shown last week
- **THEN** the system returns a comparison across fit, price, condition, interior style, availability, location, documentation, and likely objections
