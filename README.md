# RevPilot — Revenue Intelligence for Bootstrapped SaaS

Detect revenue leaks, track MRR/ARR, predict churn, and recover lost revenue — powered by your Stripe data and Claude AI.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS |
| Database & Auth | Supabase (Postgres + RLS + Auth) |
| Payments | Stripe Connect OAuth |
| AI | Anthropic Claude API (copilot + anomaly detection) |
| Email | Resend |
| Hosting | Vercel (frontend + serverless functions) |

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` at the project root:

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

# Anthropic
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=

# Security
ENCRYPTION_KEY=   # 64 hex chars — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=      # any random string

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. External service setup

**Stripe Dashboard:**
- Connect → OAuth → Redirect URI: `http://localhost:3000/api/stripe/connect`

**Supabase Dashboard:**
- Auth → URL Configuration → Redirect URLs: `http://localhost:3000/auth/callback`
- Auth → SMTP Settings: configure Resend as custom SMTP to avoid email rate limits

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ai/            # Copilot streaming SSE + anomaly analysis
│   │   ├── churn/         # Churn rate + at-risk customer analysis
│   │   ├── create-checkout/  # Stripe Checkout session
│   │   ├── create-portal/    # Stripe billing portal
│   │   ├── cron/          # Scheduled jobs (sync, detect, report)
│   │   ├── leaks/         # Leak scan + actions + SSE stream
│   │   ├── metrics/       # MRR/ARR/churn snapshots
│   │   ├── recoveries/    # Recovery timeline + by-type attribution
│   │   ├── stripe/        # Connect OAuth + sync
│   │   ├── user/          # Connection status, profile
│   │   └── webhooks/      # Stripe billing + Connect webhooks
│   ├── auth/callback/     # Supabase PKCE code exchange
│   ├── dashboard/
│   │   ├── page.tsx       # Main dashboard overview
│   │   ├── leaks/         # Revenue Leak Scanner
│   │   ├── metrics/       # MRR/ARR/churn/NRR charts
│   │   ├── churn/         # Churn predictions + at-risk customers
│   │   ├── recovery/      # Recovery timeline + attribution
│   │   ├── copilot/       # AI revenue copilot chat
│   │   ├── connect/       # Stripe connection management
│   │   ├── billing/       # Subscription management
│   │   └── settings/      # User settings
│   ├── demo/              # Public demo (no login required)
│   ├── login/             # Google OAuth + magic link auth
│   └── page.tsx           # Public landing page
├── components/
│   ├── dashboard/         # MetricCard
│   ├── layout/            # Sidebar, Header
│   └── shared/            # EmptyState, LoadingState
├── lib/
│   ├── supabase/          # client, server, middleware
│   ├── encryption.ts      # AES-256-GCM token encryption
│   ├── rate-limit.ts      # Per-route rate limiting
│   ├── resend.ts          # Transactional email
│   ├── revenue-leaks.ts   # Leak detection engine
│   ├── server-clients.ts  # Stripe + Supabase admin clients
│   ├── server-error.ts    # Standardized API error responses
│   ├── stripe.ts          # Plan limits, billing helpers
│   ├── stripe-metrics.ts  # MRR/ARR/churn calculation
│   └── validation-schemas.ts  # Zod input validation
├── proxy.ts               # Next.js 16 middleware (session refresh + auth guard)
└── types/                 # Shared TypeScript types + Supabase generated types
```

---

## Key Features

- **Revenue Leak Scanner** — detects failed payments, expiring cards, pending cancels, zombie subscriptions
- **MRR / ARR Dashboard** — historical charts from Stripe data snapshots
- **Churn Predictions** — at-risk customer list with MRR at risk and save probability
- **Recovery Tracker** — attributes and tracks revenue saved by category
- **AI Copilot** — streaming chat powered by Claude, answers revenue questions using your Stripe data
- **Stripe Connect** — multi-tenant OAuth with AES-256-GCM encrypted token storage

---

## Scripts

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build — catches TypeScript errors
npm run lint     # ESLint
```

---

## Database

Schema lives in `supabase/migrations/`. Key tables:

| Table | Purpose |
|---|---|
| `stripe_connections` | User ↔ Stripe account link, encrypted tokens |
| `revenue_leaks` | Detected leaks with severity, revenue impact, status |
| `metrics_snapshots` | Daily MRR/ARR/churn/NRR per connection |
| `recovery_events` | Tracked recoveries with category attribution |
| `usage_events` | Audit trail (OAuth, scans, AI usage) |

All tables use Row Level Security. Service role bypasses RLS only for cron jobs and webhooks.
