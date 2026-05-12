-- Migration 016: Allow test-mode webhook sources in stripe_events_processed.
--
-- The dedup table previously only accepted source in {'billing', 'connect'}.
-- Both webhook routes (stripe-connect, stripe-billing) now optionally accept
-- events signed by a separate STRIPE_*_WEBHOOK_SECRET_TEST, used to validate
-- idempotency from Stripe Test mode against the production endpoint. Events
-- verified by the test secret are tagged with the `_test` suffix so live and
-- test event streams stay separable in the audit log.
--
-- Live event_ids and test-mode event_ids cannot collide (Stripe namespaces
-- them separately), so the existing event_id primary key still enforces
-- dedup correctly across both modes.

alter table public.stripe_events_processed
  drop constraint if exists stripe_events_processed_source_check;

alter table public.stripe_events_processed
  add constraint stripe_events_processed_source_check
    check (source in ('billing', 'connect', 'billing_test', 'connect_test'));
