-- Migration 008: Webhook idempotency.
--
-- Stripe replays webhook events on transient failures, so an "upgrade plan"
-- handler that runs twice can charge or bump the user twice. This table
-- records every processed event_id; webhook handlers INSERT on entry and
-- bail with `deduped: true` on PK conflict (Postgres error code 23505).
--
-- Cleanup: /api/cron/purge-event-log deletes rows older than 30 days each
-- Sunday at 04:00 UTC. Stripe retries within 3 days, so 30 days is a safe
-- buffer.

create table if not exists public.stripe_events_processed (
  event_id     text primary key,
  source       text not null check (source in ('billing', 'connect')),
  processed_at timestamptz not null default now()
);

create index if not exists idx_stripe_events_processed_processed_at
  on public.stripe_events_processed (processed_at);

-- RLS enabled with no user-facing policies: only service_role (admin client)
-- can read or write this table. End users have no business touching it.
alter table public.stripe_events_processed enable row level security;
