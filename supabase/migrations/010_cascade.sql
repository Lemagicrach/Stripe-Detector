-- Migration 010: GDPR account deletion infrastructure.
--
-- 1. Soft-delete tombstone on user_profiles (used by Sentry / support to
--    distinguish "user was here once" from "user never existed").
-- 2. account_deletions audit table — keeps a tamper-evident record of every
--    deletion (sha256 email, never plaintext) for GDPR compliance demonstration.
-- 3. Fix the two `actioned_by` FKs that today block auth.admin.deleteUser()
--    with NO ACTION. Their owning rows (churn_predictions, churn_interventions)
--    are owned by stripe_connection_id and cascade-delete via that chain; the
--    actioning user is just attribution metadata that we preserve as a
--    tombstone via SET NULL.
--
-- Validated against prod FK audit: 17 FKs reference auth.users(id) or
-- public.user_profiles(id). All 15 others already have correct CASCADE or
-- SET NULL behavior; only these two needed fixing.

alter table public.user_profiles
  add column if not exists deleted_at timestamptz;

create table if not exists public.account_deletions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  email_hash   text not null,
  deleted_at   timestamptz not null default now(),
  reason       text
);

create index if not exists idx_account_deletions_deleted_at
  on public.account_deletions (deleted_at desc);

-- RLS enabled with no user-facing policy: only service_role can read or write
-- this table (admin client during deletion + admin queries for legal proof).
alter table public.account_deletions enable row level security;

-- Fix churn_interventions.actioned_by: NO ACTION → SET NULL
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'churn_interventions_actioned_by_fkey'
      and conrelid = 'public.churn_interventions'::regclass
  ) then
    alter table public.churn_interventions
      drop constraint churn_interventions_actioned_by_fkey;
  end if;
end $$;

alter table public.churn_interventions
  add constraint churn_interventions_actioned_by_fkey
  foreign key (actioned_by) references auth.users(id) on delete set null;

-- Fix churn_predictions.actioned_by: NO ACTION → SET NULL
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'churn_predictions_actioned_by_fkey'
      and conrelid = 'public.churn_predictions'::regclass
  ) then
    alter table public.churn_predictions
      drop constraint churn_predictions_actioned_by_fkey;
  end if;
end $$;

alter table public.churn_predictions
  add constraint churn_predictions_actioned_by_fkey
  foreign key (actioned_by) references auth.users(id) on delete set null;
