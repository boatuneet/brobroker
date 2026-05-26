Date: 2026-05-26
Relevancy: Current project overview for the BroBroker prototype, its setup, and the main product workflows.

# BroBroker

BroBroker is a private broker workspace for high-value assets. It helps brokers manage listings, buyer memory, matching, document readiness, owner context, and buyer-safe intelligence across yachts, collector cars, and luxury real estate.

The current build is a Next.js 16 prototype with Supabase-backed persistence for listings and buyers, plus seeded demo data for product exploration.

## Core Workflows

- Segment-aware broker workspace for yachts, cars, and real estate.
- Listing intake, editing, media galleries, location previews, and listing intelligence pages.
- Bulk yacht CSV import with image copy into Supabase Storage.
- Buyer memory profiles with criteria, relationship context, rejected assets, and generated matches.
- Matching workspace that ranks current listings against saved buyer profiles and ad-hoc briefs.
- Knowledge Vault that regenerates source-linked workspace memory from current stored records.
- Owner context, verification, deal rooms, reports, and voice-to-CRM prototype flows.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, Database, and Storage
- Vitest

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file with Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Setup

The Supabase schema is documented in:

```bash
supabase/brobroker-manual-setup.sql
```

Apply it to a Supabase project before using persisted auth, listings, buyers, storage uploads, or imported yacht data.

## Useful Scripts

```bash
npm run dev
npm run lint
npm test
npx tsc --noEmit
```

## Notes

This is an active prototype. Some records are seeded locally in code while newer listings and buyers are stored in Supabase and merged into the workspace at runtime.
