# TruckMates Platform

TruckMates is a multi-tenant logistics platform for carriers and fleets. It combines dispatch operations, load lifecycle management, accounting, compliance (IFTA/ELD/DVIR), and reporting in one Next.js + Supabase application.

## Core Modules

- Operations: drivers, trucks, routes, loads, dispatch board
- Finance: invoices, expenses, settlements, factoring, year-end tax reporting
- Compliance: IFTA, trip sheets, ELD, DVIR, maintenance
- CRM: customers, vendors, address book
- Reporting: revenue, profit/loss, driver payments, fuel efficiency, year-end

## Tech Stack

- Next.js 16 (`app/` router, server actions)
- React 19
- TypeScript
- Supabase (Auth + Postgres + RLS)
- Shadcn/Radix UI components
- Sentry + Vercel Analytics

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
npm run dev
```

App runs on `http://localhost:3000`.

## Required Environment Variables

Set these in `.env.local` and production environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (or API key route-backed equivalent)
- `NEXT_PUBLIC_APP_URL`

Feature-specific keys (only if used):

- Stripe
- Resend / email provider
- Sentry DSN
- ELD / telematics provider credentials
- Webhook signing secrets

## Database Setup

Apply SQL migrations/scripts in `supabase/` using Supabase SQL editor or migration workflow.

Minimum requirement: all tables/functions referenced by `app/actions/*` must exist and RLS policies must be enabled for tenant isolation.

## Build & Production

```bash
npm run build
npm run start
```

## Deployment

### Vercel

1. Connect the GitHub repository in Vercel.
2. Configure environment variables in Vercel project settings.
3. Deploy from `main` branch, or run:

```bash
npx vercel --prod
```

### Post-Deploy Checks

- Login and tenant-scoped navigation loads correctly.
- Dispatch, loads, and invoice workflows function end-to-end.
- IFTA/report pages return data without table/column errors.
- Sentry receives server-side exceptions.

## Repository Hygiene

- Keep root documentation minimal (`README.md`, optional `CHANGELOG.md`).
- Put feature docs under `docs/` instead of repository root.
- Do not commit backup files (`*backup*`, `* 2.tsx`, temporary exports).
