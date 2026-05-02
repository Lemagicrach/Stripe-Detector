-- Migration 006: Affirm Row Level Security on all user-owned tables.
--
-- Most of the original `001_initial_schema.sql` already enables RLS on these
-- tables, but this migration makes the intent explicit at the Phase 1 boundary
-- and serves as a safety net: re-running `enable row level security` on a
-- table that already has it is a Postgres no-op (no error, no state change).
--
-- This migration is idempotent and safe to apply to any environment, fresh or
-- existing.

alter table public.user_profiles      enable row level security;
alter table public.stripe_connections enable row level security;
alter table public.revenue_leaks      enable row level security;
alter table public.recovery_events    enable row level security;
alter table public.revenue_signals    enable row level security;
alter table public.metrics_snapshots  enable row level security;
alter table public.usage_events       enable row level security;
alter table public.monthly_reports    enable row level security;
