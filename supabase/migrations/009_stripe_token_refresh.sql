-- Migration 009: Track Stripe Connect access token refresh timestamp.
--
-- Stripe Connect access tokens expire after 6-12 months. Without active
-- refresh, leak detection and metrics sync silently stop working for any
-- customer past that horizon. The withStripeConnect wrapper transparently
-- refreshes on expiry; this column lets the weekly /api/cron/refresh-
-- stripe-tokens job pre-emptively refresh tokens that haven't been touched
-- in 5+ months, before they hit the hard expiry.

alter table public.stripe_connections
  add column if not exists last_refreshed_at timestamptz;
