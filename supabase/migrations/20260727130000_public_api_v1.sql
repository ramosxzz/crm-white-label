-- API publica v1: chaves por tenant + webhooks de saida.
-- So o service role (backend) mexe nessas tabelas - dashboard usa Server
-- Actions com service client, igual lead_intake_keys ja faz hoje. Sem policy
-- de leitura direta pro usuario final via anon/authenticated key.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  is_active boolean not null default true,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index api_keys_tenant_id_idx on public.api_keys(tenant_id);
alter table public.api_keys enable row level security;

create table public.api_webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index api_webhooks_tenant_id_idx on public.api_webhooks(tenant_id);
alter table public.api_webhooks enable row level security;

create table public.api_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.api_webhooks(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event text not null,
  status_code int,
  response_body text,
  error text,
  created_at timestamptz not null default now()
);
create index api_webhook_deliveries_webhook_id_idx on public.api_webhook_deliveries(webhook_id);
alter table public.api_webhook_deliveries enable row level security;
