-- Migration 015: Email notification opt-out flag.
--
-- Defaults to TRUE on creation so users get alerts by default. The flag is
-- flipped by the /api/email/unsubscribe endpoint when a user clicks the
-- unsubscribe link in a marketing email; transactional emails (account
-- deletion confirmation, trial-ending notice, budget warning) bypass the
-- check because they are required by service terms or legal obligations.
--
-- The unsubscribe URL embeds an HMAC-SHA256 token over the user_id so a
-- Resend forwarder can't trivially unsubscribe random users by guessing
-- UUIDs. Token verification is stateless (no DB lookup).

alter table public.user_profiles
  add column if not exists email_notifications_enabled boolean not null default true;
