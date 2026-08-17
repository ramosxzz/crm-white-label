-- Monitoramento de saúde das conexões de WhatsApp
alter table public.whatsapp_accounts
  add column if not exists health_status text not null default 'healthy' check (health_status in ('healthy', 'warning', 'offline')),
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists last_health_check_at timestamptz,
  add column if not exists last_error_message text,
  add column if not exists consecutive_health_failures integer not null default 0;

-- Índice para busca rápida de contas por status de saúde
create index if not exists idx_whatsapp_accounts_health on public.whatsapp_accounts(tenant_id, health_status);
