-- Migration 007: Atomic AI quota check + increment.
--
-- Replaces the application-level race-prone pattern in /api/ai/copilot and
-- /api/ai/analyze (separate SELECT count + IF check + INSERT) with a single
-- DB-side function that serializes concurrent calls per user via a
-- transaction-scoped advisory lock.
--
-- Without the lock, two parallel requests from the same free user (limit 5)
-- could both observe used_this_month = 4, both proceed past the check, and
-- both insert -- letting the user exceed the quota. With pg_advisory_xact_lock
-- keyed on hashtext(user_id), concurrent calls for the SAME user serialize;
-- calls for DIFFERENT users do not contend.
--
-- SECURITY DEFINER lets this function INSERT into usage_events even though
-- only an admin/service_role policy would normally allow it. The hardcoded
-- search_path prevents an attacker from hijacking unqualified references via
-- objects in their own schema.

create or replace function public.increment_ai_usage_if_allowed(
  p_user_id    uuid,
  p_plan_limit int
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  used_this_month int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*) into used_this_month
    from usage_events
   where user_id    = p_user_id
     and event_type = 'ai_query'
     and created_at >= date_trunc('month', now());

  if used_this_month >= p_plan_limit then
    return false;
  end if;

  insert into usage_events (user_id, event_type, metadata, created_at)
  values (
    p_user_id,
    'ai_query',
    jsonb_build_object('used', used_this_month + 1, 'limit', p_plan_limit),
    now()
  );

  return true;
end;
$$;

grant execute on function public.increment_ai_usage_if_allowed(uuid, int)
  to authenticated, service_role;
