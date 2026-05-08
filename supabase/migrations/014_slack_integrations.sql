-- Migration 014: Slack incoming-webhook integrations.
--
-- Stores one row per Slack workspace connected by a user. The webhook URL
-- is encrypted with AES-256-GCM (same key as Stripe tokens) before storage;
-- decrypt + POST happens server-side in src/lib/slack.ts.
--
-- A user can only connect Slack on the Business plan; the application code
-- gates `?action=start` against PLAN_LIMITS[plan].slackAlerts.

create table if not exists public.slack_integrations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  team_id               text not null,
  team_name             text,
  channel_id            text,
  channel_name          text,
  encrypted_webhook_url text not null,
  status                text not null default 'active' check (status in ('active', 'revoked')),
  created_at            timestamptz not null default now(),
  revoked_at            timestamptz,
  unique (user_id, team_id)
);

create index if not exists idx_slack_integrations_user
  on public.slack_integrations (user_id);

alter table public.slack_integrations enable row level security;

drop policy if exists "users_read_own_slack" on public.slack_integrations;
create policy "users_read_own_slack" on public.slack_integrations
  for select using (auth.uid() = user_id);
