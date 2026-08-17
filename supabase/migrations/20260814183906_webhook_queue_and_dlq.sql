-- Fila assíncrona de webhooks com suporte a retries e Dead Letter Queue (DLQ)
create table if not exists public.whatsapp_webhook_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null,
  provider text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Índices para busca ultra-rápida de itens pendentes e histórico
create index if not exists idx_whatsapp_webhook_queue_status on public.whatsapp_webhook_queue(status, created_at);
create index if not exists idx_whatsapp_webhook_queue_tenant on public.whatsapp_webhook_queue(tenant_id, created_at desc);

-- Habilitar RLS
alter table public.whatsapp_webhook_queue enable row level security;

revoke all on table public.whatsapp_webhook_queue from anon, authenticated;
grant all on table public.whatsapp_webhook_queue to service_role;

-- A fila e interna: somente a service role pode acessa-la. O worker ainda nao
-- esta ligado ao caminho critico; a tabela fica pronta sem expor payloads.
create policy "Service role gerencia fila de webhooks"
  on public.whatsapp_webhook_queue
  for all
  to service_role
  using (true)
  with check (true);
