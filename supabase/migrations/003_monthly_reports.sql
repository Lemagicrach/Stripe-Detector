create table public.monthly_reports (
  id uuid primary key default uuid_generate_v4(),
  connection_id uuid not null references public.stripe_connections(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  stripe_account_id text not null,
  account_name text,
  period_start date not null,
  period_end date not null,
  period_label text not null,
  currency text not null default 'usd',
  total_revenue numeric(12,2) not null default 0,
  failed_payments_count integer not null default 0 check (failed_payments_count >= 0),
  failed_payments_amount numeric(12,2) not null default 0,
  recovered_revenue numeric(12,2) not null default 0,
  active_subscriptions integer not null default 0 check (active_subscriptions >= 0),
  canceled_subscriptions integer not null default 0 check (canceled_subscriptions >= 0),
  churn_rate numeric(6,4) not null default 0,
  revenue_change_percent numeric(8,4) not null default 0,
  health_status text not null default 'moderate' check (health_status in ('healthy', 'moderate', 'risk')),
  report_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, period_start, period_end)
);

alter table public.monthly_reports enable row level security;

create policy "Users can read own monthly reports"
  on public.monthly_reports
  for select
  using (auth.uid() = user_id);

create index idx_monthly_reports_user_period
  on public.monthly_reports(user_id, period_start desc, created_at desc);

create index idx_monthly_reports_connection_period
  on public.monthly_reports(connection_id, period_start desc);
