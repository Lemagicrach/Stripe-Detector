# CLAUDE.md â€” RevPilot Revenue Leaks Detector

> This file tells Claude Code how to work on this project like a senior SaaS engineer.
> Keep it at the repo root. Claude reads it automatically on every session.

---

## Project Identity

**RevPilot** is a Stripe revenue intelligence SaaS that detects revenue leaks, tracks MRR, and surfaces recovery opportunities for bootstrapped SaaS founders ($3Kâ€“$50K MRR).

- **Stack**: Next.js 16 (App Router, Turbopack), TypeScript, Supabase (Postgres + Auth + RLS), Stripe Connect OAuth, Tailwind CSS
- **Hosting**: Vercel (frontend + serverless), Supabase (database + auth)
- **AI**: Anthropic Claude API (revenue copilot + anomaly detection)
- **Monorepo**: Single `revpilot/` directory, no workspace or turborepo

---

## Architecture

```
src/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ api/               # Next.js Route Handlers (serverless)
â”‚   â”‚   â”œâ”€â”€ stripe/        # Connect OAuth, sync, webhooks
â”‚   â”‚   â”œâ”€â”€ leaks/         # Scan, actions, notifications, SSE stream
â”‚   â”‚   â”œâ”€â”€ ai/            # Copilot (streaming SSE) + analyze
â”‚   â”‚   â”œâ”€â”€ metrics/       # MRR/ARR/churn snapshots
â”‚   â”‚   â”œâ”€â”€ recoveries/    # Timeline + by-type attribution
â”‚   â”‚   â”œâ”€â”€ cron/          # Scheduled jobs (sync-all, detect-leaks, anomaly-scan)
â”‚   â”‚   â”œâ”€â”€ churn/         # Churn analysis + intervention
â”‚   â”‚   â”œâ”€â”€ webhooks/      # Stripe billing + Connect webhooks
â”‚   â”‚   â””â”€â”€ user/          # Connection status, profile
â”‚   â”œâ”€â”€ dashboard/         # Protected pages (layout with Sidebar + Header)
â”‚   â”‚   â”œâ”€â”€ page.tsx       # Main leak scanner (default view)
â”‚   â”‚   â”œâ”€â”€ leaks/         # Revenue Leak Scanner
â”‚   â”‚   â”œâ”€â”€ metrics/       # MRR/ARR charts
â”‚   â”‚   â”œâ”€â”€ churn/         # Churn analysis
â”‚   â”‚   â”œâ”€â”€ recovery/      # Recovery timeline
â”‚   â”‚   â”œâ”€â”€ connect/       # Stripe OAuth connection management
â”‚   â”‚   â”œâ”€â”€ scenarios/     # What-if scenarios
â”‚   â”‚   â”œâ”€â”€ alerts/        # Alert configuration
â”‚   â”‚   â”œâ”€â”€ benchmarks/    # Industry benchmarks
â”‚   â”‚   â”œâ”€â”€ billing/       # Subscription management
â”‚   â”‚   â””â”€â”€ settings/      # User settings
â”‚   â”œâ”€â”€ login/             # Auth page (Google OAuth + magic link)
â”‚   â”œâ”€â”€ auth/callback/     # Supabase OAuth code exchange
â”‚   â””â”€â”€ page.tsx           # Public landing page
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ dashboard/         # MetricCard, etc.
â”‚   â”œâ”€â”€ leaks/             # LeakCard, LeakOverview, ActionCenter
â”‚   â”œâ”€â”€ layout/            # Sidebar, Header
â”‚   â””â”€â”€ shared/            # EmptyState, LoadingState
â”œâ”€â”€ hooks/                 # use-metrics, etc.
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ supabase/          # client.ts, server.ts, middleware.ts
â”‚   â”œâ”€â”€ server-clients.ts  # getStripeServerClient(), getSupabaseAdminClient()
â”‚   â”œâ”€â”€ server-error.ts    # handleApiError(), unauthorized(), badRequest()
â”‚   â”œâ”€â”€ encryption.ts      # AES-256-GCM encrypt/decrypt for Stripe tokens
â”‚   â”œâ”€â”€ rate-limit.ts      # Per-route rate limiting
â”‚   â”œâ”€â”€ revenue-leaks.ts   # Leak detection engine (4 detector types)
â”‚   â”œâ”€â”€ stripe.ts          # Stripe helpers, plan limits, billing utils
â”‚   â”œâ”€â”€ stripe-metrics.ts  # MRR/ARR/churn calculation from Stripe data
â”‚   â”œâ”€â”€ resend.ts          # Email via Resend
â”‚   â””â”€â”€ validation-schemas.ts # Zod schemas
â”œâ”€â”€ types/
â”‚   â”œâ”€â”€ database.ts        # Supabase generated types
â”‚   â””â”€â”€ index.ts           # Shared TypeScript types
â””â”€â”€ proxy.ts                # Auth guard via updateSession() (Next.js 16 middleware convention)
```

---

## Key Technical Decisions

### Authentication
- **Supabase Auth** with Google OAuth (primary) and email magic links (backup)
- Middleware at `src/proxy.ts` calls `updateSession()` from `src/lib/supabase/middleware.ts` (Next.js 16 uses `proxy.ts`, not `middleware.ts`)
- Public routes: `/`, `/login`, `/auth/callback`, `/api/webhooks/*`, `/api/cron/*`, `/api/health`
- All `/dashboard/*` routes require authentication
- Auth callback at `src/app/auth/callback/route.ts` exchanges code â†’ redirects to `/dashboard`

### Stripe Connect
- **OAuth 2.0** with `read_write` scope (Stripe requires it; our code only reads)
- Flow: `/api/stripe/connect?action=start` â†’ returns JSON `{ url }` â†’ client redirects â†’ Stripe â†’ callback with `code` â†’ token exchange â†’ encrypt â†’ store in Supabase
- Tokens encrypted with **AES-256-GCM** before database storage (never plaintext)
- DB columns: `encrypted_access_token` (object with encryptedData, iv, authTag)
- On successful connect, auto-triggers background sync via `/api/stripe/sync`

### Leak Detection Engine
Four detector types in `src/lib/revenue-leaks.ts`:
1. **Failed Payments** â€” declined charges, 70% recovery rate
2. **Expiring Cards** â€” cards expiring within 30 days, 85% recovery rate
3. **Pending Cancels** â€” scheduled cancellations, 25% save rate
4. **Zombie Subscriptions** â€” active subs with no recent usage

Leak score: `60% revenue_impact + 40% severity_weight`, normalized to 0â€“100.

### Database (Supabase / Postgres)
Key tables:
- `stripe_connections` â€” user â†” Stripe account link, encrypted tokens, status
- `revenue_leaks` â€” detected leaks with category, severity, revenue impact, status
- `metrics_snapshots` â€” daily MRR/ARR/churn/NRR snapshots per connection
- `recovery_events` â€” tracked recoveries with attribution
- `usage_events` â€” audit trail for OAuth, scans, etc.

**Always use RLS.** Every table has Row Level Security enabled. Service role (`getSupabaseAdminClient()`) bypasses RLS for cron jobs and webhooks.

### API Patterns
All route handlers follow this pattern:
```typescript
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeServerClient, getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();
    // ... business logic
  } catch (error) {
    return handleApiError(error, "ROUTE_NAME");
  }
}
```

### Cron Jobs
Protected by `CRON_SECRET` Bearer token. Vercel cron or external scheduler calls:
- `/api/cron/sync-all` â€” sync all active connections
- `/api/cron/detect-revenue-leaks` â€” run leak scan across all users
- `/api/cron/detect-revenue-signals` â€” signal detection
- `/api/cron/ai-anomaly-scan` â€” AI-powered anomaly detection
- `/api/cron/send-revenue-report` â€” email digest

---

## Code Style & Conventions

### TypeScript
- **Strict mode** â€” no `any` unless absolutely necessary (use `unknown` + type guard)
- Prefer `interface` for object shapes, `type` for unions/intersections
- Always type API responses explicitly â€” no implicit `any` from `.json()`
- Use `as const` for literal objects (severity levels, status enums)

### React / Next.js
- **All dashboard pages are `"use client"`** â€” they fetch data client-side
- **API routes are server-only** â€” never import browser APIs
- Use `fetch()` with `{ cache: "no-store" }` for real-time data in client components
- Sidebar navigation defined in `src/components/layout/Sidebar.tsx`
- Dashboard layout wraps all `/dashboard/*` pages with Sidebar + Header

### Styling
- **Tailwind CSS** for all dashboard components
- Dark theme: `bg-[#0B1120]` (canvas), `bg-gray-900` (cards), `border-gray-800` (borders)
- Landing page uses inline styles (standalone, no Tailwind dependency for public pages)
- Severity colors: critical=`red-500`, high=`amber-500`, medium=`blue-500`, low=`emerald-500`
- Monospace for numbers: `font-mono` class

### Error Handling
- API routes: wrap in try/catch, return via `handleApiError(error, "CONTEXT")`
- Client: show error in UI (red banner), never silent failures
- Rate limiting on all mutation endpoints
- Never expose internal errors to client â€” use generic messages

### Security
- **Never store Stripe tokens in plaintext** â€” always `encrypt()` before DB, `decrypt()` on read
- **Never trust client input** â€” validate with Zod schemas (`src/lib/validation-schemas.ts`)
- **Never expose service keys** â€” `SUPABASE_SERVICE_KEY` and `STRIPE_SECRET_KEY` are server-only
- **RLS on every table** â€” no exceptions
- Webhook signature verification for all Stripe webhooks
- CSRF protection via Supabase auth cookies

---

## Environment Variables

Required for local dev (`.env.local`):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_CLIENT_ID=
STRIPE_CONNECT_REDIRECT_URI=https://corvidet.com/api/stripe/connect
STRIPE_WEBHOOK_SECRET=

# Security
ENCRYPTION_KEY=          # 64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=             # Any random string for cron auth

# App
NEXT_PUBLIC_APP_URL=https://corvidet.com
```

**Stripe Dashboard Config Required:**
- Connect â†’ OAuth â†’ Redirect URI: `https://corvidet.com/api/stripe/connect`
- Supabase â†’ Auth â†’ URL Config â†’ Redirect URLs: `https://corvidet.com/auth/callback`

---

## Common Tasks

### Add a new dashboard page
1. Create `src/app/dashboard/{name}/page.tsx` (must be `"use client"`)
2. Add nav item in `src/components/layout/Sidebar.tsx`
3. Page inherits `DashboardLayout` (Sidebar + Header) automatically

### Add a new API route
1. Create `src/app/api/{path}/route.ts`
2. Use the standard pattern (auth check â†’ business logic â†’ error handler)
3. Add rate limiting for mutations
4. Add to public routes in middleware if unauthenticated access needed

### Add a new leak detector
1. Add detector function in `src/lib/revenue-leaks.ts`
2. Include in the `detectRevenueLeaks()` parallel execution array
3. Return standard `{ type, severity, title, description, revenue_impact, recovery_probability, suggested_action }` shape
4. Add any new Stripe API calls needed

### Run locally
```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build (catches TS errors)
npm run lint         # ESLint check
```

---

## What NOT To Do

- **Never commit `.env.local`** â€” it has secrets
- **Never use `read_only` scope** for Stripe Connect â€” Stripe rejects it without special approval; use `read_write`
- **Never call Supabase admin client from client components** â€” it bypasses RLS
- **Never store unencrypted Stripe tokens** â€” always use `encrypt()` from `src/lib/encryption.ts`
- **Never put auth logic in `dashboard/layout.tsx`** â€” middleware handles it
- **Never create `middleware.ts` at `src/middleware.ts`** â€” Next.js 16 uses `src/proxy.ts` as the middleware file; creating both causes a build error
- **Never use `localStorage`** in components â€” use React state or server-side sessions
- **Never hardcode Stripe API versions** â€” use the SDK default
- **Never skip error handling** in API routes â€” always wrap in try/catch with `handleApiError()`

---

## Current State (Last Updated)

### Working
- Landing page (`/`)
- Google OAuth login + session management
- Auth callback + middleware redirect chain
- Dashboard layout with sidebar navigation
- Stripe Connect OAuth flow (test mode)
- Leak scanner UI with scan trigger, filters, status management
- All API route handlers scaffolded

### Known Issues
- `src/app/api/ai/analyze/route.ts` line 27: TypeScript error (`Property 'id' does not exist on type 'never'`) â€” needs type annotation on Supabase query
- Magic link cross-device: auth callback handles token_hash flow; requires Supabase email template to use {{ .TokenHash }} (see auth/callback/route.ts)

### Next Up
- Complete Stripe data sync after Connect
- Run first leak scan with real Stripe test data
- Build out metrics dashboard with MRR charts
- Wire up AI copilot streaming endpoint
- Deploy to Vercel with production env vars
