## ADDED Requirements

### Requirement: Verification Case Creation
The system SHALL create a verification case for each serious inquiry before sensitive documents, private access, sea trials, seller introductions, or buyer deal room access are approved.

#### Scenario: Serious inquiry arrives
- **WHEN** a buyer requests sensitive documents or a private viewing
- **THEN** the system creates a verification case linked to the buyer, inquiry, listing, requested access, and required broker decision

### Requirement: Verification Status Classification
The system SHALL classify verification cases as Verified, Needs Review, or High Risk using identity, company, contact, proof-of-funds readiness, inquiry quality, location consistency, sanctions/PEP/watchlist, adverse media, and fraud-signal inputs.

#### Scenario: Buyer looks credible
- **WHEN** required signals are present and no meaningful risk flags exist
- **THEN** the system marks the case as Verified and recommends proceeding with the next broker-approved action

#### Scenario: Buyer data is incomplete
- **WHEN** identity, company, contact, or proof-of-funds readiness data is missing or ambiguous
- **THEN** the system marks the case as Needs Review and recommends the specific information to request

#### Scenario: Buyer appears risky
- **WHEN** high-risk signals or suspicious inquiry patterns exist
- **THEN** the system marks the case as High Risk and recommends holding access with an audit trail

### Requirement: Access Gate Recommendations
The system SHALL use verification status to recommend access decisions while keeping final approval under broker control.

#### Scenario: Broker attempts sensitive access
- **WHEN** a broker tries to share sensitive documents, approve a private viewing, or publish a buyer deal room
- **THEN** the system shows the buyer's verification status, risk explanation, and recommended action before the broker proceeds

### Requirement: Verification Audit Trail
The system SHALL keep an audit-friendly record of verification inputs, status changes, broker decisions, timestamps, and recommended actions.

#### Scenario: Verification status changes
- **WHEN** a verification case changes from Needs Review to Verified
- **THEN** the system records the previous status, new status, changed signals, timestamp, and broker or system actor responsible for the change
