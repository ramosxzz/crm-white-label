-- Itens vistos nas fotos do sistema antigo do ACT que ainda faltavam no
-- modulo novo: canal de vendas/origem categorico, consultor extra e
-- parceiro extra, reaplicacao como registro proprio (nao so orcamento) e
-- proximo contato comercial.

alter table public.service_orders
  add column if not exists sale_channel text,
  add column if not exists consultant_extra_id uuid references auth.users(id) on delete set null,
  add column if not exists partner_extra_name text,
  add column if not exists partner_extra_percent numeric,
  add column if not exists origin_kind text;

alter table public.service_orders
  drop constraint if exists service_orders_sale_channel_check;
alter table public.service_orders
  add constraint service_orders_sale_channel_check
  check (sale_channel is null or sale_channel in (
    'instagram', 'anuncio', 'marketing', 'ja_e_cliente', 'indicacao', 'loja_parceira', 'outro'
  ));

alter table public.service_orders
  drop constraint if exists service_orders_origin_kind_check;
alter table public.service_orders
  add constraint service_orders_origin_kind_check
  check (origin_kind is null or origin_kind in ('orcamento_convertido', 'reaplicacao'));

create table if not exists public.service_order_followups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  category text not null,
  responsible_id uuid references auth.users(id) on delete set null,
  contact_date date not null,
  description text,
  notes text,
  status text not null default 'pendente' check (status in ('pendente', 'feito', 'cancelado')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists service_order_followups_tenant_date_idx
  on public.service_order_followups (tenant_id, contact_date);
create index if not exists service_order_followups_order_idx
  on public.service_order_followups (service_order_id);

alter table public.service_order_followups enable row level security;

drop policy if exists service_order_followups_tenant_select on public.service_order_followups;
create policy service_order_followups_tenant_select on public.service_order_followups
  for select using (
    public.is_tenant_member(tenant_id)
    and public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente','vendedor']::public.member_role[])
  );

drop policy if exists service_order_followups_manage_write on public.service_order_followups;
create policy service_order_followups_manage_write on public.service_order_followups
  for all using (
    public.is_tenant_member(tenant_id)
    and public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
  )
  with check (
    public.is_tenant_member(tenant_id)
    and public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
  );
