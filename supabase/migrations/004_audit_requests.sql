create table public.audit_requests (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  work_email text not null,
  company text not null,
  website text,
  mrr_band text not null check (mrr_band in ('under_10k', '10k_to_25k', '25k_to_50k', '50k_to_100k', '100k_plus')),
  billing_model text not null check (billing_model in ('b2b_saas_subscription', 'subscription_plus_usage', 'annual_contracts_in_stripe', 'not_sure')),
  biggest_leak text not null,
  landing_variant text not null default 'stripe-b2b-saas-audit',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  user_agent text,
  status text not null default 'requested' check (status in ('requested', 'qualified', 'contacted', 'booked', 'connected', 'won', 'lost')),
  admin_notes text,
  last_contacted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now()
);

alter table public.audit_requests enable row level security;

create index idx_audit_requests_requested_at
  on public.audit_requests(requested_at desc);

create index idx_audit_requests_status_requested
  on public.audit_requests(status, requested_at desc);

create index idx_audit_requests_source
  on public.audit_requests(utm_source, utm_campaign, landing_variant);
