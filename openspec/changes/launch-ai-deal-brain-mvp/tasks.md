## 1. Project Foundation

- [x] 1.1 Scaffold a Next.js TypeScript app in the repository with linting and a local development script.
- [x] 1.2 Add the base UI stack for responsive layouts, icons, forms, tabs, badges, tables, and modal/dialog states.
- [x] 1.3 Define the yacht brokerage domain types for listings, documents, buyers, sellers, conversations, tasks, matches, verification cases, drafts, reports, deal rooms, and audit events.
- [x] 1.4 Seed realistic demo data for at least 10 yacht listings, 6 buyers, 3 sellers, recent conversations, verification cases, match results, follow-up drafts, and owner update inputs.
- [x] 1.5 Create deterministic service facades for AI-style extraction, drafting, matching, seller reporting, verification scoring, and deal-room Q&A.

## 2. Broker Workspace Shell

- [x] 2.1 Build the main broker app shell with navigation for Dashboard, Listings, Buyers, Matching, Verification, Reports, and Deal Rooms.
- [x] 2.2 Build the daily dashboard with hot buyers, stale leads, overdue follow-ups, new asset matches, deals at risk, owner updates, missing documents, and verification status.
- [x] 2.3 Add a prioritized next-best-action panel with due dates, reasons, related buyer/listing links, and action entry points.
- [x] 2.4 Add responsive desktop and mobile layouts that keep operational density without overlapping text or controls.

## 3. Asset Intelligence

- [x] 3.1 Build a listing index with searchable yacht cards/table rows showing price, size, year, location, VAT status, fit signals, and document completeness.
- [x] 3.2 Build the listing brain detail view with specs, documents, media references, owner notes, refit history, comps, FAQs, objections, and missing information.
- [x] 3.3 Implement source-aware broker answer examples for listing questions, including an explicit missing-information state.
- [x] 3.4 Implement listing pitch and comparison panels using the deterministic AI facade.
- [x] 3.5 Record buyer objections against listings and surface them in both listing intelligence and buyer memory views.

## 4. Client Memory

- [x] 4.1 Build buyer profile pages with budget, preferences, must-haves, deal breakers, rejected assets, urgency, relationship notes, and communication style.
- [x] 4.2 Build seller/owner profile context with motivation, communication expectations, pricing sensitivity, feedback history, reporting cadence, and next owner update.
- [x] 4.3 Implement memory-derived next actions for stale buyers, post-viewing follow-ups, owner update needs, and missing criteria.
- [x] 4.4 Ensure buyer-facing generated content excludes broker-only notes, seller-sensitive context, and internal risk labels.

## 5. Voice-To-CRM And Follow-Up Workflows

- [x] 5.1 Build a voice-to-CRM mock input flow where a broker can paste or type a natural call summary.
- [x] 5.2 Parse the sample call summary into buyer preferences, tasks, linked listings, urgency flags, and pipeline updates.
- [x] 5.3 Generate editable follow-up drafts for inquiry replies, post-call follow-ups, viewing recaps, and negotiation updates.
- [x] 5.4 Add broker approval states for generated drafts and record approval/edit audit events.

## 6. Matching And Shortlists

- [x] 6.1 Build a client brief matcher where brokers can enter natural-language yacht requirements.
- [x] 6.2 Parse briefs into structured criteria such as model, size, year, cabins, budget, interior style, VAT status, location, and urgency.
- [x] 6.3 Generate ranked exact matches, close matches, and smart substitutes with fit scores and rationale.
- [x] 6.4 Show missing criteria, trade-offs, comparison table, broker talking points, and suggested outreach message.
- [x] 6.5 Implement hidden opportunity discovery for buyers who match a new or updated listing.

## 7. Verification And Trust Gate

- [x] 7.1 Build a verification inbox for inquiry cases with status, requested access, linked buyer/listing, and recommended broker action.
- [x] 7.2 Implement mock verification scoring for Verified, Needs Review, and High Risk using identity, company, contact, proof-of-funds readiness, AML-style signals, and inquiry quality.
- [x] 7.3 Build access-gate warnings before sensitive documents, private viewing, seller introduction, or deal-room activation.
- [x] 7.4 Add verification audit trail entries for status changes, broker decisions, timestamps, and changed signals.

## 8. Seller Reports And Buyer Deal Rooms

- [x] 8.1 Build editable seller update reports with inquiries, lead quality, viewing activity, objections, market movement, suggested actions, and next-week plan.
- [x] 8.2 Build deal room creation from a buyer shortlist with selected listings, buyer-safe rationale, comparison table, approved documents, itinerary, and broker contact context.
- [x] 8.3 Build the buyer-facing private deal room route with responsive shortlist presentation and buyer-safe next steps.
- [x] 8.4 Implement scoped deal-room Q&A that answers from approved content and creates broker follow-up tasks for missing or restricted questions.
- [x] 8.5 Show deal-room access status, verification status, broker approval status, and last-updated timestamp to the broker.

## 9. Validation Polish And QA

- [x] 9.1 Add polished empty, loading, approval, warning, and error states for all prototype workflows.
- [x] 9.2 Add focused unit tests for parsing, matching, verification scoring, buyer-safe filtering, and deterministic draft generation.
- [x] 9.3 Run linting, type checking, and tests.
- [x] 9.4 Start the dev server and verify the main workflows in a browser across desktop and mobile viewports.
- [x] 9.5 Capture validation notes and unresolved product questions for the next OpenSpec change.
