-- Migration 012: AI cost cap.
--
-- Adds a 3-argument variant of increment_ai_usage_if_allowed that also
-- enforces a monthly cost ceiling (in cents) per user, on top of the query
-- count limit. The function:
--   - Returns jsonb { allowed: boolean, event_id?: uuid, reason?: text }
--     so callers can update the inserted row with token usage after the
--     Anthropic call returns.
--   - Sums metadata->>'cost_cents' across the user's ai_query rows in the
--     current calendar month.
--   - Rejects when `count >= plan_limit` OR `cost >= max_cost_cents`.
--
-- The original 2-argument boolean variant from migration 007 stays in place
-- to avoid the brief gap between `db push` and Vercel propagating the new
-- code (~30s). A future migration can drop it once we confirm no callers
-- remain.

create or replace function public.increment_ai_usage_if_allowed(
  p_user_id        uuid,
  p_plan_limit     int,
  p_max_cost_cents int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  used_this_month  int;
  cost_this_month  numeric;
  new_event_id     uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*),
         coalesce(sum((metadata->>'cost_cents')::numeric), 0)
    into used_this_month, cost_this_month
    from usage_events
   where user_id    = p_user_id
     and event_type = 'ai_query'
     and created_at >= date_trunc('month', now());

  if used_this_month >= p_plan_limit then
    return jsonb_build_object('allowed', false, 'reason', 'count_limit');
  end if;
  if p_max_cost_cents is not null and cost_this_month >= p_max_cost_cents then
    return jsonb_build_object('allowed', false, 'reason', 'cost_limit');
  end if;

  insert into usage_events (user_id, event_type, metadata, created_at)
  values (
    p_user_id,
    'ai_query',
    jsonb_build_object('used', used_this_month + 1, 'limit', p_plan_limit),
    now()
  )
  returning id into new_event_id;

  return jsonb_build_object('allowed', true, 'event_id', new_event_id);
end;
$$;

grant execute on function public.increment_ai_usage_if_allowed(uuid, int, int)
  to authenticated, service_role;
