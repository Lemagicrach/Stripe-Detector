-- =============================================================================
-- Migration 002: Align plan tier names with frontend / PLAN_LIMITS
--
-- WHEN TO RUN THIS:
--   Only if you already ran 001_initial_schema.sql on your Supabase project.
--   If your database is brand-new (empty), just run 001 -- it already uses
--   the correct tiers (free, growth, business).
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste and run this whole file.
-- =============================================================================

BEGIN;

-- Step 1: Migrate any existing rows to the new tier names
UPDATE public.user_profiles SET plan = 'growth'    WHERE plan = 'starter';
UPDATE public.user_profiles SET plan = 'business'  WHERE plan = 'professional';

-- Step 2: Drop the existing plan CHECK constraint (name-safe)
-- Postgres auto-names inline CHECK constraints as "{table}_{column}_check".
-- We look it up dynamically so this works even if the name differs.
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname
    INTO v_constraint
    FROM pg_constraint
   WHERE conrelid = 'public.user_profiles'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%plan%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped constraint: %', v_constraint;
  ELSE
    RAISE NOTICE 'No existing plan constraint found -- skipping drop.';
  END IF;
END $$;

-- Step 3: Add the new constraint with the correct tier names
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_plan_check
  CHECK (plan IN ('free', 'growth', 'business'));

-- Step 4: Add performance index for monthly AI query counting
-- Used by /api/ai/copilot to enforce per-plan query limits.
CREATE INDEX IF NOT EXISTS idx_usage_events_ai_query
  ON public.usage_events (user_id, event_type, created_at)
  WHERE event_type = 'ai_query';

COMMIT;
