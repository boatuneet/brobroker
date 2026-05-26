## ADDED Requirements

### Requirement: Voice-To-CRM Capture
The system SHALL convert natural broker call notes into structured buyer or seller profile updates, preferences, tasks, pipeline changes, asset links, urgency flags, and follow-up drafts.

#### Scenario: Broker dictates call summary
- **WHEN** a broker records or types "Daniel wants a 60 to 75 foot yacht, modern light interior, EU VAT paid, ready before summer, budget around 3 million"
- **THEN** the system updates Daniel's buyer profile, creates relevant follow-up tasks, links suitable assets, flags urgency, and drafts a follow-up

### Requirement: Human-Approved Follow-Up Drafting
The system SHALL draft personalized follow-ups for inquiries, calls, viewings, sea trials, negotiations, and seller updates, but SHALL require broker approval before external sending.

#### Scenario: Follow-up is generated after a call
- **WHEN** a broker completes a call summary
- **THEN** the system generates an editable follow-up draft tailored to the buyer's preferences, objections, and next step

#### Scenario: Broker approves draft
- **WHEN** a broker approves an edited follow-up draft
- **THEN** the system marks the draft as approved and records the approval event without claiming the message was automatically sent unless a sending integration exists

### Requirement: Deal Timeline And Next-Best Action
The system SHALL show hot buyers, stale leads, overdue follow-ups, new asset matches, deals at risk, owners needing updates, calls needing summaries, missing documents, and verification status.

#### Scenario: Broker opens daily dashboard
- **WHEN** a broker opens the dashboard
- **THEN** the system shows prioritized next-best actions with due dates, reasons, related buyer or listing, and one-click workflow entry points

### Requirement: Seller Update Reports
The system SHALL generate polished seller or owner update reports with inquiry volume, lead quality, viewing activity, buyer feedback, common objections, market movement, suggested actions, and next-week plan.

#### Scenario: Owner update is due
- **WHEN** an owner update is due for a listing
- **THEN** the system prepares an editable report summarizing activity, feedback, objections, market context, and recommended next actions

### Requirement: Broker Approval And Audit Events
The system SHALL record broker approvals, edits, generated drafts, completed tasks, and workflow status changes for operational traceability.

#### Scenario: Broker edits generated content
- **WHEN** a broker edits a generated follow-up or report
- **THEN** the system preserves the latest approved content and records that a broker changed the generated draft
