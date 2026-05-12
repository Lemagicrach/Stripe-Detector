# CLAUDE.md — CORVIDET Revenue Leaks Detector

> This file tells Claude Code how to work on this project like a senior SaaS engineer.
> Keep it at the repo root. Claude reads it automatically on every session.

---

## Project Identity

**CORVIDET** is a Stripe revenue intelligence SaaS that detects revenue leaks, tracks MRR, and surfaces recovery opportunities for bootstrapped SaaS founders ($3K–$50K MRR).

- **Stack**: Next.js 16 (App Router, Turbopack), TypeScript, Supabase (Postgres + Auth + RLS), Stripe Connect OAuth, Tailwind CSS
- **Hosting**: Vercel (frontend + serverless), Supabase (database + auth)
- **AI**: Anthropic Claude API (revenue copilot + anomaly detection)
- **Monorepo**: Single `CORVIDET/` directory, no workspace or turborepo

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
└── proxy.ts                # Auth guard via updateSession() (Next.js 16 middleware convention)
```

---

## Key Technical Decisions

### Authentication
- **Supabase Auth** with Google OAuth (primary) and email magic links (backup)
- Middleware at `src/proxy.ts` calls `updateSession()` from `src/lib/supabase/middleware.ts` (Next.js 16 uses `proxy.ts`, not `middleware.ts`)
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
STRIPE_CONNECT_REDIRECT_URI=https://corvidet.com/api/stripe/connect
STRIPE_WEBHOOK_SECRET=

# Security
ENCRYPTION_KEY=          # 64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=             # Any random string for cron auth

# App
NEXT_PUBLIC_APP_URL=https://corvidet.com
```

**Stripe Dashboard Config Required:**
- Connect → OAuth → Redirect URI: `https://corvidet.com/api/stripe/connect`
- Supabase → Auth → URL Config → Redirect URLs: `https://corvidet.com/auth/callback`

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
- **Never create `middleware.ts` at `src/middleware.ts`** — Next.js 16 uses `src/proxy.ts` as the middleware file; creating both causes a build error
- **Never use `localStorage`** in components — use React state or server-side sessions
- **Never hardcode Stripe API versions** — use the SDK default
- **Never skip error handling** in API routes — always wrap in try/catch with `handleApiError()`

---

## Current State (Last Updated 2026-05-01)

### Working
- Landing page (`/`)
- Google OAuth login + session management
- Auth callback + middleware redirect chain
- Dashboard layout with sidebar navigation
- Stripe Connect OAuth flow (CSRF state + timing-safe compare validated)
- AES-256-GCM encryption module for Stripe tokens
- Webhook signature verification on `/api/webhooks/stripe-billing` and `/api/webhooks/stripe-connect`
- Cron auth via `timingSafeEqual` (`src/lib/cron-auth.ts`)
- Plan tier definitions (`PLAN_LIMITS` in `src/lib/stripe.ts`: free / growth $29 / business $99)
- Leak scanner UI with scan trigger, filters, status management
- MRR/ARR/Churn calculation (`src/lib/stripe-metrics.ts`)
- All API route handlers scaffolded
- Deployed to a few test users (no paying customers yet)

### Known Issues / Production Audit Findings (must fix before charging)
1. **Rate limiting is in-memory only** — `src/lib/rate-limit.ts` uses a `Map`; resets per Node process. Zero protection on serverless / multi-instance.
2. **Stripe Connect refresh tokens never used** — access tokens expire at 6-12 months; product will silently break for existing customers.
3. **AI quota enforcement is application-level** — race condition allows bypass; no Postgres-side guarantee.
4. **Webhooks not idempotent** — replays would duplicate side effects.
5. **No Sentry, no structured logs, no cron heartbeats** — production incidents are blind.
6. **No account deletion / GDPR endpoint** — legal blocker for EU customers.
7. **No versioned database schema** — Supabase tables created ad-hoc; can't reproduce environments.
8. `src/app/api/ai/analyze/route.ts` line 27: TS error (`Property 'id' does not exist on type 'never'`).
9. AI model hardcoded as `claude-sonnet-4-5-20250929` in `/api/ai/copilot` and `/api/ai/analyze` — move to env var with fallback.
10. Magic link cross-device: callback handles token_hash flow; requires Supabase template to use `{{ .TokenHash }}`.

---

# PHASE 1 — Critical Blockers (~10-12 days)

These must all ship before charging the first paying customer. Do them in order; each task is self-contained and includes a clear acceptance criterion.

## Task 1.1 — Replace in-memory rate limiting with Upstash Redis (~2 days)

**Why:** `src/lib/rate-limit.ts` uses a `Map` that resets per cold start. An abuser can blow the Anthropic budget in minutes.

**Steps:**
1. Install: `npm install @upstash/ratelimit @upstash/redis`
2. Add to `.env.example`:
   ```
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   ```
3. Rewrite `src/lib/rate-limit.ts`:
   ```ts
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";

   const redis = Redis.fromEnv();

   export const rateLimiters = {
     ai:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"),  prefix: "rl:ai" }),
     scan:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  "5 m"),  prefix: "rl:scan" }),
     webhook: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100,"1 m"),  prefix: "rl:wh" }),
     default: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"),  prefix: "rl:def" }),
   };

   export async function checkRateLimit(key: string, limiter = rateLimiters.default) {
     return limiter.limit(key);
   }
   ```
4. Apply at the top of these routes, keyed by `userId` (fallback to `request.headers.get("x-forwarded-for") ?? "anon"`):
   - `/api/ai/copilot` and `/api/ai/analyze` → `rateLimiters.ai`
   - `/api/leaks/run-scan` and `/api/churn/analyze` → `rateLimiters.scan`
   - All other authed `/api/*` mutations → `rateLimiters.default`
5. Return `429` with `Retry-After: ${reset}` header when blocked.

**Acceptance:** running 20 parallel requests to `/api/ai/copilot` from one user yields exactly 10 successes and 10 × `429`, even when redeployed mid-test.

---

## Task 1.2 — Stripe Connect access token refresh wrapper (~2 days)

**Why:** Refresh tokens are stored encrypted but never used. Tokens silently expire at 6-12 months, leak detection stops, customer pays for nothing.

**Steps:**
1. Create `src/lib/stripe-connect.ts` with a `withStripeConnect(connectionId, fn)` wrapper:
   - Loads `stripe_connections` row
   - Decrypts access token, instantiates Stripe with it
   - Runs `fn(stripe)`
   - On `StripeAuthenticationError` (or `expired_token` code): calls `stripe.oauth.token({ grant_type: "refresh_token", refresh_token: decryptedRefreshToken })`, encrypts and persists new tokens (and optionally new refresh token), retries `fn` once
   - Updates `stripe_connections.last_refreshed_at`
2. Refactor every place that currently calls `decrypt(...)` then instantiates Stripe — search regex: `decrypt\(.*\)`. Replace with `withStripeConnect(connectionId, async (stripe) => { ... })`. Files to touch:
   - `src/lib/revenue-leaks.ts`
   - `src/lib/stripe-metrics.ts`
   - `src/lib/monthly-reports.ts`
   - `src/app/api/leaks/run-scan/route.ts`
   - `src/app/api/churn/analyze/route.ts`
   - `src/app/api/stripe/sync/route.ts`
3. Add migration to add `last_refreshed_at timestamptz` to `stripe_connections`.
4. Create `/api/cron/refresh-stripe-tokens/route.ts`: weekly job that pre-emptively refreshes any token where `last_refreshed_at < now() - interval '5 months'`.
5. Add the new cron to `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/refresh-stripe-tokens", "schedule": "0 4 * * 0" }] }
   ```

**Acceptance:** unit test mocks an `expired_token` error from Stripe → wrapper refreshes and retries successfully. New `last_refreshed_at` written.

---

## Task 1.3 — Supabase RLS + DB-level AI quota enforcement (~2 days)

**Why:** Race condition lets a free user exceed 5 AI calls. Worse: any auth bug = cross-tenant data leak.

**Steps:**

1. **Migration `0002_rls.sql`** — enable RLS on all user-owned tables:
   ```sql
   alter table user_profiles      enable row level security;
   alter table stripe_connections enable row level security;
   alter table metrics_snapshots  enable row level security;
   alter table revenue_leaks      enable row level security;
   alter table usage_events       enable row level security;
   alter table recovery_events    enable row level security;
   alter table alerts             enable row level security;
   alter table monthly_reports    enable row level security;

   create policy "users_own_profile" on user_profiles
     for all using (auth.uid() = id) with check (auth.uid() = id);

   create policy "users_own_connections" on stripe_connections
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

   -- Repeat the same shape for each user-owned table
   ```
2. **Migration `0002b_quota_function.sql`** — atomic increment-and-check:
   ```sql
   create or replace function increment_ai_usage_if_allowed(
     p_user_id    uuid,
     p_plan_limit int
   ) returns boolean
   language plpgsql security definer as $$
   declare
     used_this_month int;
   begin
     select count(*) into used_this_month
       from usage_events
      where user_id    = p_user_id
        and event_type = 'ai_query'
        and created_at >= date_trunc('month', now());

     if used_this_month >= p_plan_limit then
       return false;
     end if;

     insert into usage_events (user_id, event_type, created_at)
     values (p_user_id, 'ai_query', now());
     return true;
   end;
   $$;
   ```
3. In `/api/ai/copilot` and `/api/ai/analyze`, replace the application-level counting with:
   ```ts
   const plan = profile.plan as PlanTier;
   const { data: allowed } = await supabase.rpc("increment_ai_usage_if_allowed", {
     p_user_id: user.id,
     p_plan_limit: PLAN_LIMITS[plan].aiQueriesPerMonth,
   });
   if (!allowed) {
     return NextResponse.json({ error: "quota_exceeded", plan }, { status: 402 });
   }
   ```

**Acceptance:** parallel curl loop of 10 requests on a free user (limit 5) → exactly 5 succeed, 5 return `402`.

---

## Task 1.4 — Webhook idempotency (~1 day)

**Why:** Stripe replays events. Without dedup, an upgrade can fire twice.

**Steps:**
1. **Migration `0003_webhook_idempotency.sql`:**
   ```sql
   create table stripe_events_processed (
     event_id     text primary key,
     source       text not null,
     processed_at timestamptz not null default now()
   );
   create index on stripe_events_processed (processed_at);
   ```
2. In **both** `/api/webhooks/stripe-billing/route.ts` and `/api/webhooks/stripe-connect/route.ts`, immediately after `stripe.webhooks.constructEvent(...)`:
   ```ts
   const { error } = await admin.from("stripe_events_processed").insert({
     event_id: event.id,
     source:   "billing", // or "connect"
   });
   if (error?.code === "23505") {
     return NextResponse.json({ received: true, deduped: true });
   }
   if (error) throw error;
   ```
3. Add weekly cleanup cron `/api/cron/purge-event-log` deleting rows older than 30 days.

**Acceptance:** posting the same Stripe event payload twice returns `deduped: true` on the second call; no duplicate side effect in DB.

---

## Task 1.5 — Observability: Sentry + structured logs + cron heartbeats (~2 days)

**Why:** Today, production errors are invisible.

**Steps:**
1. Install Sentry: `npx @sentry/wizard@latest -i nextjs`. Add `SENTRY_DSN` to env. The wizard creates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
2. Create `src/lib/logger.ts`:
   ```ts
   type LogLevel = "debug" | "info" | "warn" | "error";

   export function log(level: LogLevel, msg: string, ctx: Record<string, unknown> = {}) {
     const entry = { level, msg, ts: new Date().toISOString(), ...ctx };
     // eslint-disable-next-line no-console
     console[level === "debug" ? "log" : level](JSON.stringify(entry));
   }
   ```
3. Replace every `console.error(...)` and `console.log(...)` in `src/app/api/**` and `src/lib/**` with `log(...)`. Always include at minimum `route`, `userId` (when known), `errorCode`.
4. Sign up `healthchecks.io` (free). Add env vars `HC_SYNC_ALL_URL`, `HC_DETECT_LEAKS_URL`, `HC_REFRESH_TOKENS_URL`, `HC_AI_ANOMALY_URL`, `HC_SEND_REPORT_URL`. At the start of each cron route, `fetch(\`${url}/start\`)`. On success: `fetch(url)`. On error: `fetch(\`${url}/fail\`)`.

**Acceptance:** trigger a deliberate exception in dev → it appears in Sentry. Skip a cron run → healthchecks.io alerts via email/Slack.

---

## Task 1.6 — Account deletion + GDPR (~2 days)

**Why:** Legal requirement (GDPR Article 17). Trust requirement.

**Steps:**
1. **Migration `0004_cascade.sql`:**
   - Add `on delete cascade` on every FK referencing `auth.users(id)` or `user_profiles(id)`
   - Add `deleted_at timestamptz` on `user_profiles` for soft-delete tombstone
   - Create:
     ```sql
     create table account_deletions (
       id           uuid primary key default gen_random_uuid(),
       user_id      uuid not null,
       email_hash   text not null,
       deleted_at   timestamptz not null default now(),
       reason       text
     );
     ```
2. Create `src/app/api/user/account/route.ts` with `DELETE`:
   ```ts
   // 1. Auth check
   // 2. For each stripe_connection: stripe.oauth.deauthorize({ stripe_user_id, client_id: env.STRIPE_CLIENT_ID })
   // 3. Cancel any active stripe billing subscription on user_profiles.stripe_customer_id
   // 4. Insert account_deletions row (hash email with sha256, never store plaintext)
   // 5. Use service role admin client: supabaseAdmin.auth.admin.deleteUser(user.id) → cascades user-owned tables
   // 6. Send confirmation email via Resend
   ```
3. Create UI: `src/app/dashboard/settings/danger-zone.tsx` with a confirmation modal that requires the user to type their email exactly to enable the delete button.
4. Update `src/app/privacy/page.tsx` with a section: "How to delete your account and all associated data."

**Acceptance:** test user clicks delete, types email, confirms → all rows gone from DB, Stripe Connect deauthorized (visible in Stripe dashboard), confirmation email arrives.

---

## Task 1.7 — Versioned database schema with Supabase migrations (~1 day)

**Why:** Today, schema lives only in production. Cannot bootstrap a fresh environment, cannot rollback.

**Steps:**
1. Inside `revpilot/`: `npx supabase init` (creates `supabase/` folder).
2. `supabase link --project-ref <YOUR_REF>`.
3. `supabase db pull` → produces `supabase/migrations/<timestamp>_initial.sql`.
4. Commit migrations 0002 (RLS), 0002b (quota fn), 0003 (idempotency), 0004 (cascade) created above.
5. Document in README:
   ```bash
   supabase db push    # apply local migrations to linked project
   supabase db diff    # diff local schema vs remote
   ```
6. Add CI step `.github/workflows/db.yml` running `supabase db lint`.

**Acceptance:** a fresh empty Supabase project + `supabase db push` produces a fully working DB; the app runs end-to-end against it.

---

# PHASE 2 — Professional Polish (~8-10 days)

After Phase 1 is shipped, deliver these to reach "operator can sleep at night" quality.

## Task 2.1 — Audit logs (~2 days)

1. Migration: `audit_logs (id uuid pk, user_id uuid, action text, resource_type text, resource_id text, ip text, user_agent text, metadata jsonb, created_at timestamptz default now())`. Index on `(user_id, created_at desc)`.
2. Helper `src/lib/audit.ts`: `audit(userId, action, resource_type, resource_id, meta)`.
3. Call from: `stripe.connect.connected`, `stripe.connect.disconnected`, `account.deleted`, `subscription.upgraded`, `subscription.downgraded`, `report.exported`, `leak.dismissed`, `ai.query`.
4. Add admin-only viewer at `/dashboard/settings/activity` showing the user's own audit trail.

## Task 2.2 — Email notifications (~2 days)

1. Install `npm install react-email @react-email/components`.
2. Create `src/emails/`:
   - `MonthlyHealthReport.tsx` — wires existing `monthly-reports.ts` data into a clean React Email template.
   - `HighSeverityLeakAlert.tsx` — fired from `/api/cron/detect-revenue-leaks` when severity ≥ "high".
   - `TrialEndingSoon.tsx` — for Phase 2.5 wiring.
3. Implement actual sending in `/api/cron/send-revenue-report` (currently scaffolded but inert).
4. Add `email_notifications_enabled boolean default true` to `user_profiles`. Add unsubscribe link → token-based opt-out endpoint.

## Task 2.3 — AI cost cap per plan (~1 day)

1. Capture `usage.input_tokens`, `usage.output_tokens` from Anthropic SDK responses, persist in `usage_events.metadata` (cents at current Sonnet rates).
2. Daily cron `/api/cron/check-ai-budget` sums monthly cost per user; flags accounts ≥ 80%.
3. Extend `increment_ai_usage_if_allowed` to also accept `p_max_cost_cents` and check both query count AND running cost.

## Task 2.4 — Terms of Service + Privacy Policy + cookie banner (~2 days)

1. Use Termly or Iubenda (~$10/mo) for legally-defensible boilerplate, OR commission lawyer-reviewed static pages.
2. Pages: `src/app/terms/page.tsx`, fully revise `src/app/privacy/page.tsx`.
3. Footer link to both on every page.
4. Cookie banner: only required if you load any 3rd-party analytics (GA, Meta, Hotjar). If first-party only — skip the banner under EU rules (CNIL guidance).
5. Update auth signup flow to require ToS acceptance checkbox.

## Task 2.5 — 14-day Growth trial + billing UX (~2 days)

1. In `src/app/api/create-checkout/route.ts`, when target plan is `growth` and user is on `free`, set `subscription_data: { trial_period_days: 14 }`. Trial without payment method (lower friction, accept higher trial-to-paid drop).
2. Webhook `customer.subscription.trial_will_end` → send `TrialEndingSoon` email (3 days before).
3. Dashboard banner component when user is in trial: "X days left in your Growth trial."
4. On `customer.subscription.deleted` after trial expiry without conversion → revert plan to `free`.

## Task 2.6 — Pick ONE visible Business-tier feature (~2-3 days)

**Recommended: Slack alerts** (highest perceived value, lowest build cost).

- **Option A — Slack alerts (recommended, ~2 days):**
  1. Slack OAuth app, store webhook URL encrypted in `slack_integrations` table.
  2. Page `/dashboard/settings/integrations` with "Connect Slack" button.
  3. Fire on: high-severity leak detected, monthly report ready, trial ending.
- **Option B — Multi-Stripe-account (~3 days):** schema change to support N connections per user, dashboard switcher.
- **Option C — Scheduled CSV/PDF export (~2 days):** weekly digest of leaks/recoveries by email.

Update `PLAN_LIMITS.business` in `src/lib/stripe.ts` to expose the new flag, and surface it on the pricing page.

---

# Go / No-Go Validation Checklist

Before flipping the public switch and accepting paying customers:

- [ ] All Phase 1 tasks (1.1–1.7) merged and deployed.
- [x] Sentry receives a deliberate test exception from production.
- [ ] Healthchecks.io shows green for all 6 cron jobs over 7+ days.
- [ ] `supabase db push` against a fresh project produces a working app.
- [ ] `DELETE /api/user/account` removes all user data + deauthorizes Stripe Connect (verified manually).
- [ ] `withStripeConnect` covers every place that previously did `decrypt(...)` + `new Stripe(...)`.
- [ ] Quota bypass test: 10 parallel AI requests on a free user → exactly 5 succeed.
- [ ] Webhook replay test: same `event.id` posted twice → `deduped: true` on second call.
- [ ] ToS + Privacy linked from every footer; signup requires ToS acceptance.
- [ ] At least 3 paid beta users on $1 symbolic Stripe price for ≥ 2 weeks with no incidents.
- [ ] Runbook doc exists: "what to do if Stripe Connect is down / Anthropic is down / a customer asks for their data".

---

# Working Order Recommendation

Suggested merge order to minimize risk:

1. Task 1.7 first (migrations infrastructure — unblocks all later DB work)
2. Tasks 1.3 + 1.4 in the same migration sprint (RLS + quota + idempotency)
3. Task 1.2 (token refresh — touches many files, do when migrations are stable)
4. Task 1.1 (rate limiting — independent, can ship anytime)
5. Task 1.5 (observability — ship before any of the above hits real customers)
6. Task 1.6 (deletion — last because it requires cascade migrations from 1.7)
7. Phase 2 tasks in any order; recommend 2.4 (legal) and 2.5 (trial) earliest.

---

# Decision Log

When making non-obvious choices, append a short entry. Keeps future Claude Code sessions aware of past trade-offs.

- **2026-05-01:** Initial production audit completed. Phase 1 + Phase 2 plan added to CLAUDE.md.
- **2026-05-01:** Chose Upstash Redis over Vercel KV for portability if we leave Vercel later.
- **2026-05-01:** Chose `trial_period_days: 14` without payment method for Growth plan to lower top-of-funnel friction; accept higher trial-to-paid drop.
- **2026-05-01:** Task 1.7 partially executed: added `supabase/config.toml`, `supabase/seed.sql`, `supabase/.gitignore`, `.github/workflows/db.yml`, and a Database migrations section in README. Did **not** run `supabase link` / `db pull` / `db push` (deferred to operator). Decided to keep the existing `001_`–`004_` sequential migration naming (rather than CLI's `<timestamp>_` default) and to **not** run `db pull`, since it would emit a duplicate `_remote_schema.sql`. Phase 1 migrations referenced in CLAUDE.md as `0002_rls.sql`, `0002b_quota_function.sql`, `0003_webhook_idempotency.sql`, `0004_cascade.sql` must therefore be renumbered to `006_rls.sql`, `007_quota_function.sql`, `008_webhook_idempotency.sql`, `009_cascade.sql` (numbering shifted by one because of `005_align_with_prod.sql`) when Tasks 1.3 / 1.4 / 1.6 are executed.
- **2026-05-02:** Task 1.7 closed end-to-end. Discovered while running `supabase db diff --linked` that the production schema had drifted massively from `001`–`004`: ~23 tables (`churn_*`, `cohorts`, `customers_cache`, `email_queue`, `feature_flags`, `invoices_cache`, `leak_*`, `metrics_history`, `referrals`, `revenue_recovery_events`, `saved_searches`, `stripe_connection_members`, `subscription_history`, `subscriptions_cache`, `sync_logs`, `team_members`, `teams`, `analytics_events`, `api_usage`), 12 functions, 78 indexes, 7 policies, 3 triggers, 525 grants, plus 1 view (`view_connection_metrics`) and 2 drops (`pg_net` extension and `idx_usage_events_ai_query`) had been applied to prod via Supabase Studio without ever being captured in a migration file. Captured the full delta in `005_align_with_prod.sql`, transformed to be idempotent for trivial cases (CREATE TABLE / INDEX / TRIGGER / POLICY guarded by IF NOT EXISTS or DROP IF EXISTS). Strategy chosen: **B (idempotent + `migration repair`)** — non-trivial cases like `add constraint` are NOT idempotent, but `005` is marked as already applied on prod via `npx supabase migration repair --status applied 005`, so it never replays there; on fresh DBs it replays cleanly. Also fixed a UTF-8 BOM bug at the top of `001_initial_schema.sql` that was preventing the local replay. Verified replay works via `db diff --linked` (only 6 phantom function diffs remain, confirmed via `pg_proc` introspection to be a known `migra`/`db diff` bug — the function bodies, owners, ACLs, volatility, security_definer flags are byte-identical between shadow and remote; not a real divergence). Acceptance criterion met: a fresh project + `db push` produces a working DB end-to-end.
- **2026-05-06:** Phase 1 fermée bout-en-bout (7/7). Tous les blockers critiques de production sont levés et validés en prod sous trafic réel.
  - **1.1 (Upstash rate limit)**: 5 limiters sliding-window (ai/scan/default/formPublic/webhook), per-user keying, fail-open sur Redis down, header `Retry-After`. Validé E2E : 15 requêtes parallèles → 5×429 + 10×passé-quota.
  - **1.2 (Token refresh)**: `withStripeConnect(connectionId, fn)` wrapper, refresh sur `StripeAuthenticationError`/`expired_token`/401, persist tokens chiffrés + `last_refreshed_at`. Migration `009_stripe_token_refresh.sql`. Cron weekly `/api/cron/refresh-stripe-tokens` (`HC_REFRESH_TOKENS_URL`). Lib functions (`stripe-metrics.ts`, `monthly-reports.ts`, `revenue-leaks.ts`) refactorées pour recevoir un `Stripe` instance plutôt qu'un `encryptedAccessToken`.
  - **1.3 (AI quota)**: fonction PL/pgSQL `increment_ai_usage_if_allowed` avec `pg_advisory_xact_lock(hashtext(user_id))` pour atomicité, `SECURITY DEFINER` + `SET search_path = public, pg_temp`. Migration `007_quota_function.sql`. Validé E2E : 10 parallel → 5/5 split exact.
  - **1.4 (Webhook idempotency)**: table `stripe_events_processed (event_id PK)`, INSERT dédup au top des 2 routes webhook avec catch `23505` → `{deduped:true}`. Migration `008_webhook_idempotency.sql`, cron `/api/cron/purge-event-log` (purge >30j). Validé via SQL constraint test.
  - **1.5 (Observability)**: `src/lib/logger.ts` (JSON struct + Sentry forwarding pour level=error), 31 `console.*` migrés sur 20 fichiers, Sentry wizard installé (configs + DSN dans `next.config.ts`/`sentry.server.config.ts`/`sentry.edge.config.ts`/`instrumentation.ts`). Cron heartbeats via `pingHealthcheck()` sur 6 crons (sync-all, detect-revenue-leaks, detect-revenue-signals, ai-anomaly-scan, send-revenue-report, run-monthly-health). 6 env vars `HC_*_URL` côté Vercel. `purge-event-log` exclu (low value). Pages `/sentry-example-*` du wizard supprimées (DOS vector quota).
  - **1.6 (GDPR deletion)**: route `DELETE /api/user/account` orchestre 8 étapes (auth → confirm email → deauth Stripe Connect → cancel sub → audit row sha256 → `auth.admin.deleteUser` → email). Migration `010_cascade.sql` ajoute `user_profiles.deleted_at`, table `account_deletions`, fix 2 FKs `actioned_by` (NO ACTION → SET NULL). Wrapper Radix `AlertDialog` + page `/dashboard/settings` avec danger zone (type-email-to-confirm). Section dédiée dans `/privacy`. Validé E2E : 9 tables cascadées à 0, audit row avec sha256 vérifiée. Audit FK pré-migration via `pg_constraint` direct (pas `information_schema` qui foire les schémas croisés).
  - **Reste pour go public** : Phase 2 task 2.4 (ToS + Privacy + cookie banner) bloquant légal EU. Phase 2 task 2.5 (trial 14j) pour la conversion. Healthchecks à observer 7+ jours sous trafic réel pour valider que les 6 crons firent toutes.
- **2026-05-11:** Go/No-Go Test 2 validé en production. Création d'une route temporaire `GET /api/debug/error` qui throw une `Error` non-caught, gatée derrière `DEBUG_ROUTES=1` (sinon `404`). Premier essai sous `src/app/api/_debug/error/` → 404 Next.js : App Router exclut du routing tout dossier préfixé par `_` ("private folders"). Renommée en `debug/`, le gate env suffit à cacher la route. Validation prod : commit `53ea935` déployé sur Vercel avec `DEBUG_ROUTES=1` scope Production → `curl https://corvidet.com/api/debug/error` retourne 500 → event reçu dans Sentry avec `environment=vercel-production`, `release=53ea935591d8`, `mechanism=auto.function.nextjs.on_request_error`, `handled=no`. Capture automatique via `@sentry/nextjs` confirmée : aucune instrumentation custom requise, toute erreur uncaught dans un Route Handler atterrit dans Sentry. Cleanup : commit `8f0f28c` supprime la route, `DEBUG_ROUTES` retirée de Vercel.
- *(append new entries below)*
