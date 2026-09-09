alter table public.tenants
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;
