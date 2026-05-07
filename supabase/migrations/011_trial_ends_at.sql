-- Migration 011: Trial state mirror.
--
-- Stores the active trial end timestamp on user_profiles so the dashboard
-- can show "X days left" without round-tripping to Stripe on every page
-- load. Populated by the customer.subscription.updated webhook when
-- subscription.trial_end is set; cleared on customer.subscription.deleted.

alter table public.user_profiles
  add column if not exists trial_ends_at timestamptz;
