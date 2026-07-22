-- Tabela de notificacoes (chegou direto em producao sem migration
-- versionada; recriada aqui com "if not exists" pra nao afetar producao e
-- destravar ambientes novos/branches).

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  description text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_tenant_idx
  on public.notifications (tenant_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_tenant_select" on public.notifications;
create policy "notifications_tenant_select" on public.notifications
  for select using (is_tenant_member(tenant_id));

drop policy if exists "notifications_tenant_insert" on public.notifications;
create policy "notifications_tenant_insert" on public.notifications
  for insert with check (is_tenant_member(tenant_id));

drop policy if exists "notifications_tenant_update" on public.notifications;
create policy "notifications_tenant_update" on public.notifications
  for update using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
