-- Migration 013: Audit logs.
--
-- Tamper-evident record of every meaningful user action. Distinct from
-- `usage_events` (which is product analytics keyed on event_type for AI
-- quota enforcement etc.) — audit_logs captures *who did what*, *when*,
-- *from where* (IP + user-agent) for compliance, support, and security
-- forensics.
--
-- RLS:
--   - Users can SELECT only their own rows
--   - Only service_role (admin client) can INSERT — guarantees the
--     application code cannot be tricked into writing fake audit entries
--     under another user's id.

create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  action        text not null,
  resource_type text,
  resource_id   text,
  ip            text,
  user_agent    text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_logs_user_created
  on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "users_read_own_audit_logs" on public.audit_logs;
create policy "users_read_own_audit_logs" on public.audit_logs
  for select using (auth.uid() = user_id);
