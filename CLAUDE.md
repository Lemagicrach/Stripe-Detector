# CLAUDE.md — RevPilot Revenue Leaks Detector

> This file tells Claude Code how to work on this project like a senior SaaS engineer.
> Keep it at the repo root. Claude reads it automatically on every session.

---

## Project Identity

**RevPilot** is a Stripe revenue intelligence SaaS that detects revenue leaks, tracks MRR, and surfaces recovery opportunities for bootstrapped SaaS founders ($3K–$50K MRR).

- **Stack**: Next.js 16 (App Router, Turbopack), TypeScript, Supabase (Postgres + Auth + RLS), Stripe Connect OAuth, Tailwind CSS
- **Hosting**: Vercel (frontend + serverless), Supabase (database + auth)
- **AI**: Anthropic Claude API (revenue copilot + anomaly detection)
- **Monorepo**: Single `revpilot/` directory, no workspace or turborepo

---

## Architecture

```
src/
├── app/
│   ├── api/               # Next.js Route Handlers (serverless)
│   │   ├── stripe/        # Connect OAuth, sync, webhooks
│   │   ├── leaks/         # Scan, actions, notifications, SSE stream
│   │   ├── ai/            # Copilot (streaming SSE) + analyze
│   │   ├── metrics/       # MRR/ARR/churn snapshots
│   │   ├── recoveries/    # Timeline + by-type attribution
│   │   ├── cron/          # Scheduled jobs (sync-all, detect-leaks, anomaly-scan)
│   │   ├── churn/         # Churn analysis + intervention
│   │   ├── webhooks/      # Stripe billing + Connect webhooks
│   │   └── user/          # Connection status, profile
│   ├── dashboard/         # Protected pages (layout with Sidebar + Header)
│   │   ├── page.tsx       # Main leak scanner (default view)
│   │   ├── leaks/         # Revenue Leak Scanner
│   │   ├── metrics/       # MRR/ARR charts
│   │   ├── churn/         # Churn analysis
│   │   ├── recovery/      # Recovery timeline
│   │   ├── connect/       # Stripe OAuth connection management
│   │   ├── scenarios/     # What-if scenarios
│   │   ├── alerts/        # Alert configuration
│   │   ├── benchmarks/    # Industry benchmarks
│   │   ├── billing/       # Subscription management
│   │   └── settings/      # User settings
│   ├── login/             # Auth page (Google OAuth + magic link)
│   ├── auth/callback/     # Supabase OAuth code exchange
│   └── page.tsx           # Public landing page
├── components/
│   ├── dashboard/         # MetricCard, etc.
│   ├── leaks/             # LeakCard, LeakOverview, ActionCenter
│   ├── layout/            # Sidebar, Header
│   └── shared/            # EmptyState, LoadingState
├── hooks/                 # use-metrics, etc.
├── lib/
│   ├── supabase/          # client.ts, server.ts, middleware.ts
│   ├── server-clients.ts  # getStripeServerClient(), getSupabaseAdminClient()
│   ├── server-error.ts    # handleApiError(), unauthorized(), badRequest()
│   ├── encryption.ts      # AES-256-GCM encrypt/decrypt for Stripe tokens
│   ├── rate-limit.ts      # Per-route rate limiting
│   ├── revenue-leaks.ts   # Leak detection engine (4 detector types)
│   ├── stripe.ts          # Stripe helpers, plan limits, billing utils
│   ├── stripe-metrics.ts  # MRR/ARR/churn calculation from Stripe data
│   ├── resend.ts          # Email via Resend
│   └── validation-schemas.ts # Zod schemas
├── types/
│   ├── database.ts        # Supabase generated types
│   └── index.ts           # Shared TypeScript types
└── middleware.ts           # Auth guard via updateSession()
```

---

## Key Technical Decisions

### Authentication
- **Supabase Auth** with Google OAuth (primary) and email magic links (backup)
- Middleware at `src/middleware.ts` calls `updateSession()` from `src/lib/supabase/middleware.ts`
- Public routes: `/`, `/login`, `/auth/callback`, `/api/webhooks/*`, `/api/cron/*`, `/api/health`
- All `/dashboard/*` routes require authentication
- Auth callback at `src/app/auth/callback/route.ts` exchanges code → redirects to `/dashboard`

### Stripe Connect
- **OAuth 2.0** with `read_write` scope (Stripe requires it; our code only reads)
- Flow: `/api/stripe/connect?action=start` → returns JSON `{ url }` → client redirects → Stripe → callback with `code` → token exchange → encrypt → store in Supabase
- Tokens encrypted with **AES-256-GCM** before database storage (never plaintext)
- DB columns: `encrypted_access_token` (object with encryptedData, iv, authTag)
- On successful connect, auto-triggers background sync via `/api/stripe/sync`

### Leak Detection Engine
Four detector types in `src/lib/revenue-leaks.ts`:
1. **Failed Payments** — declined charges, 70% recovery rate
2. **Expiring Cards** — cards expiring within 30 days, 85% recovery rate
3. **Pending Cancels** — scheduled cancellations, 25% save rate
4. **Zombie Subscriptions** — active subs with no recent usage

Leak score: `60% revenue_impact + 40% severity_weight`, normalized to 0–100.

### Database (Supabase / Postgres)
Key tables:
- `stripe_connections` — user ↔ Stripe account link, encrypted tokens, status
- `revenue_leaks` — detected leaks with category, severity, revenue impact, status
- `metrics_snapshots` — daily MRR/ARR/churn/NRR snapshots per connection
- `recovery_events` — tracked recoveries with attribution
- `usage_events` — audit trail for OAuth, scans, etc.

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
- `/api/cron/sync-all` — sync all active connections
- `/api/cron/detect-revenue-leaks` — run leak scan across all users
- `/api/cron/detect-revenue-signals` — signal detection
- `/api/cron/ai-anomaly-scan` — AI-powered anomaly detection
- `/api/cron/send-revenue-report` — email digest

---

## Code Style & Conventions

### TypeScript
- **Strict mode** — no `any` unless absolutely necessary (use `unknown` + type guard)
- Prefer `interface` for object shapes, `type` for unions/intersections
- Always type API responses explicitly — no implicit `any` from `.json()`
- Use `as const` for literal objects (severity levels, status enums)

### React / Next.js
- **All dashboard pages are `"use client"`** — they fetch data client-side
- **API routes are server-only** — never import browser APIs
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
- Never expose internal errors to client — use generic messages

### Security
- **Never store Stripe tokens in plaintext** — always `encrypt()` before DB, `decrypt()` on read
- **Never trust client input** — validate with Zod schemas (`src/lib/validation-schemas.ts`)
- **Never expose service keys** — `SUPABASE_SERVICE_KEY` and `STRIPE_SECRET_KEY` are server-only
- **RLS on every table** — no exceptions
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
STRIPE_CONNECT_REDIRECT_URI=http://localhost:3000/api/stripe/connect
STRIPE_WEBHOOK_SECRET=

# Security
ENCRYPTION_KEY=          # 64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=             # Any random string for cron auth

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Stripe Dashboard Config Required:**
- Connect → OAuth → Redirect URI: `http://localhost:3000/api/stripe/connect`
- Supabase → Auth → URL Config → Redirect URLs: `http://localhost:3000/auth/callback`

---

## Common Tasks

### Add a new dashboard page
1. Create `src/app/dashboard/{name}/page.tsx` (must be `"use client"`)
2. Add nav item in `src/components/layout/Sidebar.tsx`
3. Page inherits `DashboardLayout` (Sidebar + Header) automatically

### Add a new API route
1. Create `src/app/api/{path}/route.ts`
2. Use the standard pattern (auth check → business logic → error handler)
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

- **Never commit `.env.local`** — it has secrets
- **Never use `read_only` scope** for Stripe Connect — Stripe rejects it without special approval; use `read_write`
- **Never call Supabase admin client from client components** — it bypasses RLS
- **Never store unencrypted Stripe tokens** — always use `encrypt()` from `src/lib/encryption.ts`
- **Never put auth logic in `dashboard/layout.tsx`** — middleware handles it
- **Never create `middleware.ts` in `src/lib/`** — Next.js only reads from `src/middleware.ts`
- **Never use `localStorage`** in components — use React state or server-side sessions
- **Never hardcode Stripe API versions** — use the SDK default
- **Never skip error handling** in API routes — always wrap in try/catch with `handleApiError()`

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
- `src/app/api/ai/analyze/route.ts` line 27: TypeScript error (`Property 'id' does not exist on type 'never'`) — needs type annotation on Supabase query
- Magic link login has PKCE issue when opened in different browser context — low priority, Google OAuth is primary
- `src/proxy.ts` is dead code (leftover) — safe to delete

### Next Up
- Complete Stripe data sync after Connect
- Run first leak scan with real Stripe test data
- Build out metrics dashboard with MRR charts
- Wire up AI copilot streaming endpoint
- Deploy to Vercel with production env vars
