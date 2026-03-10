-- RevPilot Initial Schema
-- Run: npx supabase db push

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- â”€â”€ User profiles â”€â”€
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'growth', 'business')),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
create policy "Users can read own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);

-- â”€â”€ Stripe connections â”€â”€
create table public.stripe_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  stripe_account_id text not null,
  account_name text,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  status text not null default 'active' check (status in ('active', 'disconnected', 'error')),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, stripe_account_id)
);
alter table public.stripe_connections enable row level security;
create policy "Users can manage own connections" on public.stripe_connections for all using (auth.uid() = user_id);

-- â”€â”€ Revenue leaks â”€â”€
create table public.revenue_leaks (
  id uuid primary key default uuid_generate_v4(),
  connection_id uuid not null references public.stripe_connections(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  category text not null,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null,
  description text,
  lost_revenue numeric(12,2) not null default 0,
  recoverable_revenue numeric(12,2) not null default 0,
  affected_customers jsonb default '[]',
  fix_steps jsonb default '[]',
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.revenue_leaks enable row level security;
create policy "Users can manage own leaks" on public.revenue_leaks for all using (auth.uid() = user_id);

-- â”€â”€ Recovery events â”€â”€
create table public.recovery_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  leak_id uuid references public.revenue_leaks(id) on delete set null,
  type text not null,
  amount numeric(12,2) not null,
  customer_id text,
  recovered_at timestamptz not null default now()
);
alter table public.recovery_events enable row level security;
create policy "Users can read own recoveries" on public.recovery_events for select using (auth.uid() = user_id);

-- â”€â”€ Revenue signals / alerts â”€â”€
create table public.revenue_signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  description text,
  data jsonb default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.revenue_signals enable row level security;
create policy "Users can manage own signals" on public.revenue_signals for all using (auth.uid() = user_id);

-- â”€â”€ Metrics snapshots (daily) â”€â”€
create table public.metrics_snapshots (
  id uuid primary key default uuid_generate_v4(),
  connection_id uuid not null references public.stripe_connections(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  mrr numeric(12,2) not null default 0,
  arr numeric(12,2) not null default 0,
  active_customers integer not null default 0,
  churn_rate numeric(5,4) default 0,
  nrr numeric(5,4) default 0,
  arpu numeric(12,2) default 0,
  new_mrr numeric(12,2) default 0,
  expansion_mrr numeric(12,2) default 0,
  churned_mrr numeric(12,2) default 0,
  contraction_mrr numeric(12,2) default 0,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique(connection_id, snapshot_date)
);
alter table public.metrics_snapshots enable row level security;
create policy "Users can read own snapshots" on public.metrics_snapshots for select using (auth.uid() = user_id);

-- â”€â”€ Usage tracking â”€â”€
create table public.usage_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  event_type text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);
alter table public.usage_events enable row level security;
create policy "Users can read own usage" on public.usage_events for select using (auth.uid() = user_id);

-- â”€â”€ Indexes â”€â”€
create index idx_leaks_user_status on public.revenue_leaks(user_id, status);
create index idx_leaks_connection on public.revenue_leaks(connection_id);
create index idx_signals_user_read on public.revenue_signals(user_id, read);
create index idx_snapshots_connection_date on public.metrics_snapshots(connection_id, snapshot_date);
create index idx_recovery_user on public.recovery_events(user_id);
