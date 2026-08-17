-- Trilha de Auditoria (Audit Log) para rastreabilidade de ações críticas
create table if not exists public.tenant_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_name text,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- Índices de consulta rápida
create index if not exists idx_tenant_audit_logs_tenant_created on public.tenant_audit_logs(tenant_id, created_at desc);
create index if not exists idx_tenant_audit_logs_action on public.tenant_audit_logs(tenant_id, action);
create index if not exists idx_tenant_audit_logs_resource on public.tenant_audit_logs(tenant_id, resource_type, resource_id);

-- Habilitar RLS
alter table public.tenant_audit_logs enable row level security;

revoke all on table public.tenant_audit_logs from anon;
grant select, insert on table public.tenant_audit_logs to authenticated;
grant all on table public.tenant_audit_logs to service_role;

-- Política de leitura: apenas administradores/owners do mesmo tenant
create policy "Admins podem visualizar logs de auditoria do tenant"
  on public.tenant_audit_logs
  for select
  to authenticated
  using (
    tenant_id in (
      select tm.tenant_id
      from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.role in ('admin', 'owner')
    )
  );

-- Política de inserção: membros autenticados do mesmo tenant. A service role
-- ignora RLS e possui grant explicito acima.
create policy "Membros podem registrar logs de auditoria"
  on public.tenant_audit_logs
  for insert
  to authenticated
  with check (
    tenant_id in (
      select tm.tenant_id
      from public.tenant_members tm
      where tm.user_id = auth.uid()
    )
  );
