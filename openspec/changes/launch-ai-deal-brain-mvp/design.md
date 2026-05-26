## Context

The repository is currently an empty Git workspace with OpenSpec initialized. The source brief defines an "AI Deal Brain for high-ticket brokers" and recommends starting with yacht brokers as the first wedge.

The first implementation should be a 7-day clickable product prototype that feels like a broker operating system, not a marketing site or generic CRM. It must demonstrate asset intelligence, broker memory, voice-to-CRM capture, follow-up drafting, buyer matching, verified buyer gating, seller updates, and a private buyer deal room using realistic sample yacht data.

Primary stakeholders are high-ticket brokers, brokerage owners, sellers/owners who expect strong communication, and serious buyers who expect a premium private buying experience.

## Goals / Non-Goals

**Goals:**

- Create a polished broker-facing MVP that can be used in validation calls with 3-5 yacht or luxury brokers.
- Make the product thesis visible in the first screen: memory, matching, trust, and next-best action.
- Use realistic seeded sample data so the product can be evaluated without production integrations.
- Keep AI, verification, and messaging flows human-approved and mockable for the prototype.
- Define domain boundaries cleanly enough that real CRM, messaging, AI, and KYC/KYB vendors can be added later.

**Non-Goals:**

- Do not build a universal asset marketplace.
- Do not build regulated KYC/AML data infrastructure from scratch.
- Do not send autonomous buyer or seller communications in the first version.
- Do not support every luxury asset vertical equally at launch.
- Do not implement full multi-tenant billing, production auth, or CRM sync before the validation prototype proves the workflow.

## Decisions

### Decision: Start With A Next.js TypeScript Web App

Use a Next.js TypeScript app for the first implementation so the broker workspace, private deal room routes, mock API boundaries, and future server-side integration points can live in one coherent project.

Alternatives considered:

- Static HTML prototype: faster, but too shallow for workflow validation and stateful matching interactions.
- Vite single-page app: lightweight, but less aligned with future deal-room routing and API integration surfaces.
- Full backend-first build: too much infrastructure before validating broker workflow demand.

### Decision: Seed Realistic Yacht Data Before Adding Persistence

Represent listings, buyers, sellers, conversations, tasks, verification checks, generated drafts, reports, and deal rooms as typed local fixtures first. Add a database only after the main workflows and information architecture are validated.

Alternatives considered:

- Database from day one: useful later, but slows down the first clickable prototype.
- Hard-coded UI copy only: fast visually, but weak for validating matching, memory, and report-generation workflows.

### Decision: Use Deterministic AI Facades For The Prototype

Implement AI-like outputs behind service interfaces using deterministic sample generators first. The UI should behave as if an AI assistant extracted notes, drafted follow-ups, matched buyers, and generated reports, while keeping the integration point ready for a real AI provider.

Alternatives considered:

- Call a live AI model immediately: useful for realism, but introduces API keys, latency, cost, prompt instability, and demo risk.
- Manual-only static examples: simpler, but does not validate the actual broker workflow.

### Decision: Mock Verification Vendor Signals

The verified buyer gate should orchestrate mock verification signals for identity, company, sanctions/PEP/watchlist, proof-of-funds readiness, contact consistency, and inquiry quality. The product must explain status and recommended action without claiming to perform regulated checks itself.

Alternatives considered:

- Build direct vendor integrations in the MVP: not needed for early workflow validation.
- Omit verification: weakens one of the strongest trust and prioritization wedges.

### Decision: Treat The Dashboard As The Daily Operating System

The broker's first screen should prioritize hot buyers, overdue follow-ups, verification status, missing documents, new matches, owner updates, and next-best actions. Feature demos should be reachable from operational context rather than hidden in isolated pages.

Alternatives considered:

- Listing-first CRM layout: familiar, but undersells the "AI chief of staff" thesis.
- Chat-first interface: expressive, but too ambiguous for repeated broker operations.

### Decision: Keep Buyer Deal Rooms Read-Only And Broker-Controlled

Private buyer deal rooms should display broker-approved shortlists, comparisons, documents, itinerary, and scoped Q&A. Buyers must not see sensitive seller notes, internal risk labels, or unapproved AI reasoning.

Alternatives considered:

- Fully interactive buyer portal: richer, but risks exposing sensitive information before access control is mature.
- PDF-only export: easier, but fails to show the premium client experience.

## Risks / Trade-offs

- [Risk] The app feels like a generic CRM instead of an AI Deal Brain. -> Mitigation: make memory, matching, trust, and next actions the primary navigation and dashboard emphasis.
- [Risk] Mock AI outputs feel fake during broker validation. -> Mitigation: use realistic yacht-specific sample data, specific rationale, and editable human-approved drafts.
- [Risk] Verification language creates compliance confusion. -> Mitigation: label prototype checks as vendor-orchestrated signals and avoid claiming final regulated decisions.
- [Risk] Scope becomes too broad across all asset categories. -> Mitigation: implement yacht brokerage first and keep other verticals as future positioning, not first-build UI.
- [Risk] Deal room exposes internal notes or risk labels. -> Mitigation: separate buyer-safe fields from broker-only fields in the data model and UI.

## Migration Plan

1. Scaffold the web app and seed the yacht brokerage demo data.
2. Build the broker workspace shell and daily dashboard.
3. Implement the core workflows against local typed data and deterministic service facades.
4. Add validation-ready interaction states, approval controls, and editable AI drafts.
5. Add future integration boundaries for AI, verification vendors, CRM, calendar, and messaging without wiring production providers.

Rollback is simple during the prototype phase: revert the feature branch or replace the seeded demo data and service facades without data migration.

## Open Questions

- Should the first validation prototype use a specific brokerage brand name or remain white-labeled?
- Should the first demo inventory focus only on motor yachts or include sailing yachts and chase boats?
- Which communication channels matter most for validation: email, WhatsApp, SMS, or call summaries?
- Should the first buyer deal room be public-link-with-passcode, authenticated, or purely simulated?
- Which AI provider and verification vendor stack should be evaluated after the prototype validates demand?
