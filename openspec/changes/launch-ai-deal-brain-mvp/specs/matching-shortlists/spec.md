## ADDED Requirements

### Requirement: Client Brief Parsing
The system SHALL convert a natural-language client brief into structured criteria such as budget, yacht size, brand/model preferences, year, cabins, interior style, VAT status, location, availability, must-haves, deal breakers, and urgency.

#### Scenario: Broker enters a yacht brief
- **WHEN** a broker enters "Princess F55, 2018+, light interior, 3 cabins, EU VAT paid, under EUR1.4M"
- **THEN** the system extracts structured criteria for model, year, interior style, cabins, VAT status, and budget

### Requirement: Ranked Match Generation
The system SHALL generate ranked exact matches, close matches, and smart substitutes from available listings using buyer criteria, memory signals, listing intelligence, urgency, and known objections.

#### Scenario: Exact matches exist
- **WHEN** inventory contains listings that satisfy the buyer's required criteria
- **THEN** the system ranks those listings as exact matches with fit scores and rationale

#### Scenario: No exact matches exist
- **WHEN** inventory does not contain an exact match
- **THEN** the system returns close matches and smart substitutes with the trade-offs explained

### Requirement: Match Rationale And Missing Criteria
The system SHALL explain why each listing is recommended, which criteria it satisfies, which criteria are missing or uncertain, and what the broker should verify before sending it.

#### Scenario: Listing has missing VAT status
- **WHEN** a listing otherwise fits but has unknown VAT status
- **THEN** the system flags VAT status as missing and includes a verification task before buyer outreach

### Requirement: Competitive Set Builder
The system SHALL create a competitive shortlist with comparison table, fit score, trade-offs, talking points, and suggested outreach message.

#### Scenario: Broker builds shortlist
- **WHEN** a broker selects a buyer and asks for a competitive set
- **THEN** the system returns a ranked shortlist with exact matches, near matches, substitutes, comparison criteria, and a personalized outreach draft

### Requirement: Hidden Opportunity Discovery
The system SHALL identify buyers who may fit a new or updated listing based on memory, objections, timing, and listing changes.

#### Scenario: New listing arrives
- **WHEN** a new yacht is added with a recent refit and light interior
- **THEN** the system identifies buyers whose memories indicate preference for modern interiors, recent refits, and similar price range
