-- Tabela de registros de idempotência para APIs e integrações externas
create table if not exists public.idempotency_records (
  key text not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  endpoint text not null,
  request_hash text not null,
  response_status integer not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (key, tenant_id)
);

-- Indice para limpeza periodica de registros expirados
create index if not exists idx_idempotency_expires_at on public.idempotency_records(expires_at);

-- Habilitar RLS
alter table public.idempotency_records enable row level security;

revoke all on table public.idempotency_records from anon, authenticated;
grant all on table public.idempotency_records to service_role;

-- Politica: apenas service role acessa a tabela de idempotencia
create policy "Service role gerencia idempotencia"
  on public.idempotency_records
  for all
  to service_role
  using (true)
  with check (true);
