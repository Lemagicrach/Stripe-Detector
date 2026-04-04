# Corvidet

Stripe revenue leak detection and monitoring for small SaaS teams.

Corvidet connects to a Stripe account, syncs subscription data, calculates core revenue metrics, detects a small set of concrete revenue leak patterns, and exposes that data through authenticated API routes and a Next.js dashboard. This branch is a serious MVP foundation, not a finished production system.

## Current Status

The repository is beyond scaffold stage: authentication, Stripe Connect, sync, metrics snapshots, leak detection, alerts, and insights are implemented in the current branch. At the same time, several route groups and dashboard areas are still placeholders or partial integrations.

Use this README as a branch-accurate status document, not a product promise.

## Feature Status

### Implemented

- Supabase authentication with session refresh middleware and auth callback handling
- Stripe Connect OAuth flow with encrypted token storage
- Authenticated Stripe sync trigger at `/api/sync-stripe-session`
- Daily metrics snapshot persistence for MRR, ARR, churn, NRR, ARPU, and related fields
- Revenue leak detection for:
  - failed payments
  - expiring cards
  - pending cancellations
  - zero-revenue subscriptions
- Authenticated API routes for metrics, alerts, insights, churn summary, connection status, and leak actions
- Lightweight revenue signal generation tied to sync results
- Stripe billing helpers for checkout and customer portal
- AI-assisted endpoints for analysis and copilot chat when `ANTHROPIC_API_KEY` is configured
- Health check endpoint for environment validation

### In Progress

- Dashboard coverage for all implemented APIs
- Recovery tracking and related reporting flows
- Revenue signal automation beyond sync-generated signals
- Background / cron-based operational jobs beyond the currently implemented sync-all path
- Benchmarks, scenarios, notifications, and email reporting routes
- Production hardening around retries, observability, and stricter type coverage

### Planned

- More robust alerting and notification delivery
- Richer trend analysis and benchmarking
- More complete recovery attribution workflows
- Safer operational automation for scheduled syncs and reports
- Broader AI workflows once the underlying product data model is more complete

## Product Summary

Corvidet is positioned as a revenue operations layer for founders using Stripe as their source of truth. The current MVP is strongest at:

- syncing Stripe subscription data into internal metrics snapshots
- surfacing a short list of concrete, explainable revenue risks
- giving authenticated users an API-first foundation for alerts, insights, and sync operations

It is not yet a full revenue intelligence platform with mature forecasting, fully automated notifications, or comprehensive recovery operations.

## Architecture Overview

### Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 App Router, TypeScript, React 19 |
| Styling | Tailwind CSS 4 |
| Auth + Database | Supabase (Auth, Postgres, RLS) |
| Payments + Source Data | Stripe + Stripe Connect OAuth |
| AI | Anthropic API |
| Email | Resend |

### Request / Data Flow

1. Users authenticate with Supabase.
2. Users connect a Stripe account through Stripe Connect OAuth.
3. OAuth access tokens are encrypted before being stored in `stripe_connections`.
4. `/api/sync-stripe-session` uses the stored Stripe connection to pull live Stripe data.
5. Sync persists `metrics_snapshots`, refreshes `revenue_leaks`, and generates simple `revenue_signals`.
6. `/api/metrics`, `/api/alerts`, and `/api/insights` expose derived data for the dashboard or other clients.

### Key Directories

```text
src/
├── app/
│   ├── api/                  # Route handlers
│   ├── auth/callback/        # Supabase auth callback
│   ├── dashboard/            # Protected UI
│   ├── login/                # Auth entry page
│   └── page.tsx              # Marketing landing page
├── lib/
│   ├── supabase/             # Browser/server/middleware clients
│   ├── encryption.ts         # AES-256-GCM helpers
│   ├── stripe-metrics.ts     # Stripe -> metrics snapshot logic
│   ├── revenue-leaks.ts      # Leak detection logic
│   ├── revenue-signals.ts    # MVP signal generation
│   ├── alerts.ts             # Alert shaping
│   ├── insights.ts           # Insights shaping
│   ├── server-clients.ts     # Stripe + Supabase admin clients
│   └── server-error.ts       # Standard API error responses
├── proxy.ts                  # Session refresh / auth guard entrypoint
└── supabase/migrations/      # Database schema
```

## Core Implemented Capabilities

### Authenticated Stripe Sync

The main operational heartbeat is [`/api/sync-stripe-session`](src/app/api/sync-stripe-session/route.ts). It:

- authenticates the current user
- finds the active Stripe connection
- syncs live Stripe subscription data
- upserts the current metrics snapshot
- refreshes open revenue leaks
- generates a small set of persisted revenue signals
- updates `last_sync_at`
- returns a structured summary

### Revenue Metrics

The repo currently calculates and stores:

- MRR
- ARR
- active customers
- churn rate
- NRR
- ARPU
- new MRR
- churned MRR

These values are derived in [`src/lib/stripe-metrics.ts`](src/lib/stripe-metrics.ts) and persisted to `metrics_snapshots`.

### Revenue Leak Detection

Current leak detection is intentionally narrow and explainable. It detects:

- failed payments
- expiring cards
- scheduled cancellations
- active subscriptions producing zero revenue

Leak logic lives in [`src/lib/revenue-leaks.ts`](src/lib/revenue-leaks.ts).

### Alerts and Insights

The current branch includes:

- `/api/alerts` for an authenticated, normalized alert feed backed by leaks and signals
- `/api/insights` for a grounded summary of recoverable revenue, top risks, trend summary, and recommended actions

These routes are MVP-honest and derived from persisted metrics, leaks, and signals rather than opaque analytics.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

Use the variables below as a starting point. Features that depend on optional providers can remain disabled if their keys are omitted.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_CLIENT_ID=
STRIPE_CONNECT_REDIRECT_URI=http://localhost:3000/api/stripe/connect
STRIPE_WEBHOOK_SECRET=
STRIPE_BILLING_WEBHOOK_SECRET=
STRIPE_GROWTH_PRICE_ID=
STRIPE_BUSINESS_PRICE_ID=

# AI
ANTHROPIC_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Security / ops
ENCRYPTION_KEY=
CRON_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Notes:

- `ENCRYPTION_KEY` must be 64 hex characters.
- If `ANTHROPIC_API_KEY` is missing, AI routes will not work.
- If Stripe price IDs are missing, subscription checkout for paid plans will not work.
- If Resend variables are missing, email-related flows should be treated as incomplete.

Example key generation:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Configure external services

#### Supabase

- Create a Supabase project.
- Set redirect URLs for auth callback, for example:
  - `http://localhost:3000/auth/callback`
- Apply the schema from `supabase/migrations/`.

If you use the Supabase CLI locally:

```bash
npx supabase db push
```

If not, run the SQL in `supabase/migrations/001_initial_schema.sql` manually.

#### Stripe

- Create a Stripe Connect application.
- Add the OAuth redirect URI:
  - `http://localhost:3000/api/stripe/connect`
- Configure webhook endpoints if you want billing or connect webhook flows to run.

### 4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Environment Variables

### Required for the core MVP

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_CLIENT_ID`
- `STRIPE_CONNECT_REDIRECT_URI`
- `ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`

### Required for specific implemented features

- `STRIPE_WEBHOOK_SECRET`: Stripe Connect webhook verification
- `STRIPE_BILLING_WEBHOOK_SECRET`: Stripe billing webhook verification
- `STRIPE_GROWTH_PRICE_ID`: checkout for the Growth plan
- `STRIPE_BUSINESS_PRICE_ID`: checkout for the Business plan
- `ANTHROPIC_API_KEY`: AI analyze / copilot routes
- `RESEND_API_KEY`: email sending helpers
- `RESEND_FROM_EMAIL`: custom sender address
- `CRON_SECRET`: authenticated cron endpoints

## API Surface Overview

This repo contains a mix of implemented routes and placeholder routes.

### Implemented or Meaningfully Wired

- `api/stripe/connect`
- `api/stripe/sync`
- `api/sync-stripe-session`
- `api/metrics`
- `api/leaks/actions`
- `api/leaks/connections`
- `api/leaks/run-scan`
- `api/alerts`
- `api/insights`
- `api/churn/analyze`
- `api/user/connection-status`
- `api/create-checkout`
- `api/create-portal`
- `api/ai/analyze`
- `api/ai/copilot`
- `api/health`
- `api/cron/sync-all`

### Present but Still Partial or Stubbed

- parts of `api/cron/*`
- `api/recoveries/*`
- `api/leaks/notifications`
- `api/leaks/email-report`
- `api/leaks/stream`
- `api/churn/intervene`
- `api/scenarios/create`
- `api/benchmarks/*`
- `api/usage/current`
- `api/user/profile`
- `api/admin/data-mode`

The route tree is broader than the truly finished feature set. Read the implementation before assuming a route group is production-ready.

## Data Model Overview

Key tables in the shipped schema:

| Table | Purpose |
|---|---|
| `user_profiles` | Profile, plan tier, Stripe billing customer mapping |
| `stripe_connections` | Connected Stripe accounts and encrypted OAuth tokens |
| `metrics_snapshots` | Daily revenue metrics per connection |
| `revenue_leaks` | Detected leak records with severity and recoverable revenue |
| `revenue_signals` | Lightweight persisted signals / alerts |
| `recovery_events` | Intended recovery event log, currently not fully aligned with all route usage |
| `usage_events` | Product and operational event logging |

All tables use Supabase Row Level Security. The service-role client is used only in trusted server contexts such as sync, billing, and webhook flows.

## Contributor Notes

- Prefer reading `src/app/api` and `src/lib` over relying on historical docs.
- The route tree includes future-facing scaffolding; not every endpoint is complete.
- The current MVP is API-first and backend-heavier than the dashboard suggests.
- If you are extending the product, keep new README claims tied to actual code in the branch.

## Reality Check

What this branch is today:

- a credible MVP backend for Stripe sync, metrics, leak detection, alerts, and insights
- a partially wired dashboard and billing/auth shell
- a base for further automation, notifications, reporting, and AI workflows

What it is not yet:

- a polished production deployment
- a complete recovery operations platform
- a finished cron-driven monitoring system
- a mature forecasting or anomaly detection product
