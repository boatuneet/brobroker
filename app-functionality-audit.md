# BroBroker App Functionality Audit

Date: Sunday, May 24, 2026  
Status: Updated after the implementation pass that restored demo data, added local persistence, added Supabase SQL, broadened the app to high-ticket assets, and closed the remaining prototype-sized workflow gaps.

## Summary

The app is now back on track for a validation demo. The previous audit's largest blockers were empty runtime data, yacht-only presentation, and local-only workflow state. Those are now substantially addressed:

- [x] Seeded validation data is restored: 10 mixed listings, 6 buyers, 3 sellers, conversations, tasks, verification cases, matches, drafts, seller reports, deal rooms, and audit events.
- [x] The app now demonstrates yachts, cars, and real estate rather than reading as yacht-only.
- [x] Workflow output persists locally across refreshes for voice captures, matching briefs, buyer/listing drafts, objections, owner notes, verification decisions, seller report approvals, deal-room drafts, deal-room share settings, and restricted Q&A follow-ups.
- [x] Supabase setup SQL exists for manual execution at `supabase/brobroker-manual-setup.sql`.
- [x] The main screens are populated and demoable out of the box.
- [x] Verification remains mock/scored rather than vendor-backed, per the current product constraint.

## Verification Run

- [x] Ran `npm run lint`.
- [x] Ran `npm run test` and passed 8/8 tests.
- [x] Ran `npm run build`.
- [x] Build now includes `/search` and populated dynamic paths for listings, buyers, sellers, and deal rooms.
- [x] Smoke checked populated dashboard, listings, buyers, and `room-helena-design-set` on `http://localhost:3000`.

## Global App Shell

### Intended Functionality

- [x] Provide a broker operating system shell, not a marketing site.
- [x] Give direct navigation to dashboard, listings, buyers, voice CRM, matching, verification, reports, and deal rooms.
- [x] Work on desktop and mobile.
- [x] Reinforce the universal high-ticket broker product idea.

### Current Functionality

- [x] App shell exists with desktop sidebar and mobile horizontal nav.
- [x] Metadata now says high-ticket brokers across premium assets instead of yacht brokers only.
- [x] Login/signup shell also uses universal "asset" language.
- [x] Routes exist for all primary MVP feature areas.
- [x] New global search route exists at `/search`.

### Remaining

- [ ] Navigation does not show `/search` as a dedicated sidebar item; it is reached from dashboard search.

## Dashboard (`/dashboard`)

### Intended Functionality

- [x] Show hot buyers.
- [x] Show stale leads and overdue follow-ups.
- [x] Show new asset matches and hidden opportunities.
- [x] Show deals at risk and verification status.
- [x] Show owners needing updates.
- [x] Show calls needing summaries.
- [x] Show missing documents.
- [x] Show next-best actions with due dates, reasons, and workflow entry points.

### Current Functionality

- [x] Dashboard is populated by seeded buyers, tasks, matches, reports, verification cases, deal rooms, conversations, and listings.
- [x] Global search form now goes to `/search` instead of only `/buyers`.
- [x] Task action buttons now persist "Done" state locally and mirror a workflow event to Supabase when configured.
- [x] Metrics and workflow health now reflect the restored validation dataset.

### Remaining

- [ ] Dashboard task completion is local/Supabase workflow-event mirrored, not yet a true database update to `broker_tasks`.

## Global Search (`/search`)

### Intended Functionality

- [x] Search buyers, listings, owner notes, tasks, document gaps, tags, and broker memory from one place.

### Current Functionality

- [x] Searches listings across asset type, builder, model, location, highlights, missing info, and owner notes.
- [x] Searches buyers across name, company, stage, urgency, tags, preferences, and relationship notes.
- [x] Searches sellers across motivation, communication expectations, pricing sensitivity, and feedback history.
- [x] Searches broker tasks across title, kind, priority, status, and reason.

### Remaining

- [ ] Session-created local buyer/listing drafts are displayed in their intake panels, but they are not included in server-rendered global search until Supabase-backed reads are wired.

## Listings Index (`/listings`)

### Intended Functionality

- [x] Search current asset inventory.
- [x] Show listing cards/table rows with price, specs, location, status, fit signals, document completeness, and missing information.
- [x] Support a living asset intelligence surface for the broker.
- [x] Work as a starting point for asset brains and owner context.
- [x] Provide a lightweight add-listing flow.

### Current Functionality

- [x] Shows 10 seeded mixed listings across yachts, cars, and real estate.
- [x] Cards now use richer asset media placeholders instead of boat-only icons.
- [x] Listing table uses universal spec summaries rather than always forcing feet/cabins.
- [x] Manual listing draft panel persists session-created listing drafts to localStorage and mirrors workflow events to Supabase when configured.
- [x] Search works across current seeded inventory.

### Remaining

- [ ] Session-created listing drafts are not yet promoted into full dynamic listing-brain routes until Supabase-backed CRUD is wired.

## Listing Brain Detail (`/listings/[id]`)

### Intended Functionality

- [x] Show core listing facts, documents, media references, owner notes, refit/service history, comps, FAQs, objections, and missing information.
- [x] Provide source-aware broker answers.
- [x] Identify missing, uncertain, or unapproved information.
- [x] Generate broker-ready pitch and buyer-safe angle.
- [x] Compare listing against competitive alternatives.
- [x] Record buyer objections.
- [x] Link to owner context.

### Current Functionality

- [x] All seeded listing brain routes are reachable.
- [x] Listing brain includes a media strip, facts, documents, owner context, missing info, Q&A examples, pitch, competitive set, top buyers, and objection memory.
- [x] Objection recorder persists session objections locally and mirrors `listing_objection_recorded` workflow events when Supabase is configured.
- [x] Buyer-safe/internal separation is represented in pitch and Q&A behavior.

### Remaining

- [ ] Objections are not yet written back into the server-rendered `buyers` or `assets` tables until Supabase CRUD is connected.

## Buyers Index (`/buyers`)

### Intended Functionality

- [x] Show buyer memory across active buyers.
- [x] Search by criteria, country, tags, stage, urgency, brands, locations, preferences, and must-haves.
- [x] Show budget, stage, urgency, next action, verification status, communication style, and top fit.
- [x] Lead to detailed buyer memory profiles.
- [x] Provide lightweight add-buyer flow.

### Current Functionality

- [x] Shows 6 seeded buyers out of the box.
- [x] Buyer cards and continuity table are populated.
- [x] Manual buyer memory draft panel persists local buyer drafts.
- [x] Voice CRM and Matching both save session buyer memory drafts to the same local persistence key.
- [x] Supabase workflow mirroring exists for saved session buyers.

### Remaining

- [ ] Session buyer drafts are not yet promoted into full `/buyers/[id]` routes until database-backed creation is wired.

## Buyer Memory Detail (`/buyers/[id]`)

### Intended Functionality

- [x] Show budget, brands/models, locations, lifestyle preferences, must-haves, deal breakers, objections, rejected assets, urgency, timeline, relationship notes, communication style, and stage.
- [x] Show next actions derived from memory and due dates.
- [x] Show matching recommendations and missing criteria.
- [x] Show recent conversations and follow-up drafts.
- [x] Generate buyer-safe communication that excludes broker-only notes, seller-sensitive context, and internal risk labels.
- [x] Show verification readiness.

### Current Functionality

- [x] Buyer detail routes are reachable for seeded buyers.
- [x] Buyer-safe brief and broker guardrail sections are present.
- [x] Next actions, matches, conversations, drafts, rejected assets, and verification context render from seeded data.

### Remaining

- [ ] Session-created buyer drafts do not yet have full detail pages.

## Seller / Owner Context (`/sellers/[id]`)

### Intended Functionality

- [x] Show seller motivation.
- [x] Show communication expectations.
- [x] Show listing goals and portfolio.
- [x] Show pricing sensitivity.
- [x] Show feedback history.
- [x] Show reporting cadence and next owner update.
- [x] Show owner-specific next actions.
- [x] Show prepared owner update material.
- [x] Allow broker to add owner memory notes.

### Current Functionality

- [x] Seller routes are reachable for all 3 seeded sellers.
- [x] Seller screens show portfolio, owner expectations, feedback history, reports, cadence, conversations, and tasks.
- [x] Manual owner note panel persists local owner-memory notes and mirrors workflow events when Supabase is configured.

### Remaining

- [ ] There is no separate full seller creation form yet; seller creation is expected to come with database-backed onboarding/CRUD.

## Voice-To-CRM (`/voice-crm`)

### Intended Functionality

- [x] Broker pastes, types, or records a natural call summary.
- [x] System extracts buyer preferences, tasks, urgency, linked assets, and pipeline updates.
- [x] System updates buyer memory.
- [x] System creates follow-up tasks.
- [x] System generates editable follow-up drafts.
- [x] Broker can approve drafts.
- [x] Edits and approvals are recorded as audit events.
- [x] Nothing is sent externally without broker approval.

### Current Functionality

- [x] Paste/type UI exists.
- [x] Dictation button uses the browser Web Speech API when available and falls back to typed/pasted input.
- [x] Parser links seeded listings when criteria match.
- [x] Parsed captures persist as saved CRM runs.
- [x] Parsed captures also save session buyer memory drafts.
- [x] Draft edits/approvals persist locally.
- [x] Parse and approval events mirror to Supabase `workflow_events` when SQL is run and env is configured.

### Remaining

- [ ] No external CRM/email/WhatsApp send integration yet.
- [ ] Browser speech recognition depends on browser support and permissions.

## Matching And Shortlists (`/matching`)

### Intended Functionality

- [x] Broker enters natural-language buyer requirements.
- [x] System extracts structured criteria.
- [x] System generates ranked exact matches, close matches, and smart substitutes.
- [x] System shows fit score, rationale, criteria met, missing criteria, trade-offs, comparison table, talking points, and suggested outreach.
- [x] System discovers hidden buyer opportunities for new or updated listings.
- [x] Matching output should persist.

### Current Functionality

- [x] Matching runs against populated mixed inventory.
- [x] Parser was broadened with car/property brands and locations.
- [x] Saved shortlist runs persist locally and mirror workflow events to Supabase when configured.
- [x] Matching saves a session buyer-memory draft.
- [x] Hidden opportunity discovery works against seeded buyers and listings.

### Remaining

- [ ] Matching logic is still deterministic/mock rather than AI-ranked.
- [ ] Some structured criteria names remain inherited from the yacht wedge internally.

## Verification Trust Gate (`/verification`)

### Intended Functionality

- [x] Show verification inbox for serious inquiries.
- [x] Classify buyers as Verified, Needs Review, or High Risk.
- [x] Use identity, company, contact, proof-of-funds, AML-style, inquiry quality, location consistency, and fraud-style signals.
- [x] Show access gates before sensitive documents, viewings, seller introductions, or deal-room activation.
- [x] Let broker approve access, request more information, or hold access.
- [x] Record audit-friendly broker decisions and status changes.

### Current Functionality

- [x] Verification inbox is populated with seeded cases.
- [x] Deterministic scoring/service facade works.
- [x] Broker decisions persist locally and mirror `verification_broker_decision` workflow events to Supabase when configured.
- [x] Access gates warn before sensitive sharing.

### Remaining

- [ ] No real KYC/KYB/AML/vendor integration, as expected for now.
- [ ] No serious-inquiry creation flow yet; seeded cases and broker decisions cover the validation demo.

## Seller Reports (`/reports`)

### Intended Functionality

- [x] Show owner update reports due.
- [x] Generate reports from inquiries, qualified leads, viewings, objections, market movement, suggested actions, and next-week plan.
- [x] Provide editable report draft.
- [x] Allow broker approval.
- [x] Record edit and approval audit events.
- [x] Link report back to seller/owner context.
- [x] Provide export/send simulation.

### Current Functionality

- [x] Reports queue is populated with seeded seller report inputs.
- [x] Editable drafts, source inputs, and audit trail render.
- [x] Report edits and approvals persist locally.
- [x] Export preview panel exists with print/save-PDF browser flow.
- [x] "Stage send" copies/stages the report and records a local/Supabase-mirrored event.

### Remaining

- [ ] No real email send, owner portal publishing, or generated PDF file storage yet.

## Broker Deal Rooms (`/deal-rooms`)

### Intended Functionality

- [x] Let broker create private buyer deal rooms.
- [x] Select a buyer.
- [x] Select listings for the room.
- [x] Include buyer-safe rationale, comparison details, approved documents, itinerary, broker contact, access status, verification status, broker approval status, and last-updated timestamp.
- [x] Warn when verification is incomplete.
- [x] Let broker preview buyer-facing room.
- [x] Simulate share/passcode/access settings.

### Current Functionality

- [x] Seeded deal rooms are visible.
- [x] Broker can curate a generated room from buyer and selected listings.
- [x] "Save room draft" persists local deal-room drafts and mirrors workflow events.
- [x] Share controls now include access mode, passcode, copied private link, local persistence, and Supabase workflow mirroring.
- [x] Preview links open buyer-facing rooms.

### Remaining

- [ ] Real authenticated buyer access/passcode enforcement is not implemented yet.

## Private Buyer Deal Room (`/deal-rooms/[id]`)

### Intended Functionality

- [x] Show buyer-safe shortlist.
- [x] Show rationale, trade-offs, comparison table, approved documents, itinerary, broker contact, and next steps.
- [x] Provide scoped Q&A from approved room content only.
- [x] Restrict seller-sensitive, broker-only, missing, or risk-label questions.
- [x] Create broker follow-up tasks when Q&A is restricted or missing.

### Current Functionality

- [x] Seeded private rooms are available, including `room-helena-design-set`.
- [x] Buyer-facing room uses asset media placeholders and "Asset" language instead of boat-only labels.
- [x] Scoped Q&A answers approved facts and restricts broker-controlled topics.
- [x] Restricted/missing Q&A creates locally persisted broker follow-up tasks and mirrors workflow events when configured.

### Remaining

- [ ] Financing/service links remain conceptual; they are not integrated with external providers.

## Cross-Cutting Data And Persistence

### Intended Functionality

- [x] Seed realistic demo data for validation.
- [x] Store buyer/listing/seller memory.
- [x] Add new notes, objections, tasks, drafts, approvals, reports, verification decisions, and deal rooms in a durable way.
- [x] Keep broker-only, seller-sensitive, and buyer-safe fields separated.
- [x] Prepare database structure for Supabase.

### Current Functionality

- [x] `src/lib/demo-data.ts` now contains realistic seeded validation data.
- [x] Tests now expect populated validation data instead of empty arrays.
- [x] `src/lib/browser-persistence.ts` handles local persistence and Supabase workflow-event mirroring.
- [x] `supabase/brobroker-manual-setup.sql` defines tables, RLS, authenticated grants, storage bucket, workflow events, audit events, and future vector memory.
- [x] UI keeps buyer-safe content separate from broker-only/seller-sensitive content.

### Remaining

- [ ] The app still reads primary data from seeded TypeScript fixtures; full Supabase table reads/writes are the next implementation chunk after the SQL is run.

## Cross-Cutting AI, Verification, And Integrations

### Intended Functionality

- [ ] Use live AI provider for extraction, generation, matching, and Q&A after validation.
- [ ] Use verification vendors for KYC/KYB/AML-style workflows after validation.
- [ ] Integrate CRM, calendar, email, WhatsApp/SMS, document stores, and external financing/service links later.
- [x] Keep all AI output broker-approved.

### Current Functionality

- [x] Mock AI behavior is deterministic and testable.
- [x] Mock verification scoring exists.
- [x] Browser Web Speech dictation exists where supported.
- [x] UI consistently emphasizes broker approval before external sharing.
- [x] Supabase schema and workflow-event mirroring prepare the integration path.

### Remaining

- [ ] Live AI calls are not wired.
- [ ] Real verification vendor integration is not wired.
- [ ] Real CRM/calendar/email/WhatsApp/SMS integrations are not wired.
- [ ] Document upload UI is not wired to Supabase Storage yet.

## Cross-Cutting Universal Broker Scope

### Intended Functionality

- [x] Product should support high-ticket brokers across yachts, cars, and real estate.
- [x] UI should not accidentally imply this is only for boats.

### Current Functionality

- [x] Seeded data includes yachts, cars, and real estate.
- [x] Metadata, auth shell, dashboard, listing, matching, and deal-room copy are more universal.
- [x] Listing media uses yacht/car/property-aware visual placeholders.
- [x] Tables and deal rooms use "Asset" or "Listing" labels where buyer-facing.

### Remaining

- [ ] Internal type names still include `YachtListing` for compatibility with the original service layer. A deeper rename to `AssetListing` is cleanup work, not a demo blocker.
- [ ] Parser/service internals still contain yacht-era criteria like feet/cabins/VAT, though the UI now supports mixed assets.

## Priority Fixes Status

### P0 - Restore Demo Proof

- [x] Restore realistic seeded demo data.
- [x] Include 10 listings, 6 buyers, 3 sellers, conversations, verification cases, matches, drafts, seller reports, deal rooms, and audit events.
- [x] Update tests so they do not require empty seed arrays.
- [x] Make dashboard, listing brain, buyer memory, verification, reports, and deal rooms show meaningful populated states out of the box.

### P0 - Make Created Workflow Output Persist Somewhere

- [x] Persist Voice CRM parsed captures, tasks/drafts summary, and session buyer memory.
- [x] Persist matching briefs and session buyer memory.
- [x] Persist objection recorder entries.
- [x] Persist manual listing and buyer drafts.
- [x] Persist owner notes.
- [x] Persist deal-room drafts after "Save room draft".
- [x] Persist report approvals and verification broker decisions.
- [x] Persist restricted Q&A follow-up tasks.

### P1 - Align Wedge And Universality

- [x] Immediate demo is now universal high-ticket assets with yachts, cars, and real estate.
- [x] Replace yacht-specific public copy where it weakened universal positioning.
- [x] Add asset-type field and universal spec summaries.
- [ ] Rename `YachtListing` internals to `AssetListing` in a future cleanup.

### P1 - Improve Demonstrability Of Buyer-Safe Controls

- [x] Seed multiple deal rooms with approved documents.
- [x] Add restricted Q&A path that creates persisted broker follow-up tasks.
- [x] Buyer-safe copy keeps owner notes, broker-only notes, verification risk, and seller-sensitive context out of buyer-facing rooms.
- [ ] Add more automated tests around Q&A data leakage.

### P2 - Make The Prototype Feel Less Static

- [x] Add lightweight "Add listing" flow.
- [x] Add lightweight "Add buyer" flow.
- [x] Add manual owner note flow.
- [x] Add richer asset media placeholders.
- [x] Add PDF/export preview for seller reports.
- [x] Add share/passcode/access-status simulation for private rooms.

## Final Read

- [x] We are on track for the original AI Deal Brain idea.
- [x] The app now demonstrates a populated broker operating system rather than a shell.
- [x] The app now supports universal high-ticket broker positioning across yachts, cars, and real estate.
- [x] The app now proves a lightweight version of "perfect memory" through seeded memory plus durable local workflow output.
- [x] The next best move is to run the Supabase SQL, then replace fixture/localStorage reads and writes with real Supabase CRUD.

