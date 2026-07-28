-- ERP de servico em campo - Fase 1 (ordem de servico, agendamento por turno).
-- Modulo exclusivo por tenant atras da flag field_service_enabled, mesmo
-- padrao de stock_enabled / broadcast_enabled.
--
-- Modelo: o cliente continua sendo o lead (nao existe entidade "cliente"
-- separada no sistema). O endereco de atendimento fica na propria OS,
-- porque leads nao tem campo de endereco e o local do servico pode ser
-- diferente do cadastro.

alter table public.tenants
  add column if not exists field_service_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- Ordem de servico
-- ---------------------------------------------------------------------------

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,

  -- Numero sequencial por tenant (o "codigo" que a equipe usa pra se referir
  -- a OS). Unique garante que uma corrida na geracao vira erro, nao duplicata.
  code_seq int not null,

  status text not null default 'rascunho'
    check (status in ('rascunho','agendada','em_execucao','concluida','conferida','faturada','cancelada','remarcada')),

  -- Consultora que fechou a venda (a "vendedora interna" do comissionamento).
  consultant_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,

  -- Endereco do atendimento + coordenadas resolvidas uma unica vez na
  -- geocodificacao, pra nao repetir chamada paga do Google a cada roteiro.
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text,
  address_cep text,
  lat double precision,
  lng double precision,
  geocoded_at timestamptz,

  -- Voltagem da residencia: os equipamentos de lavagem dependem disso.
  voltage text check (voltage is null or voltage in ('110v','220v')),

  service_date date,
  shift text check (shift is null or shift in ('manha','tarde')),
  route_position int,
  deadline date,

  notes text,
  observations text,
  total_cents bigint not null default 0,

  -- Indicacao de loja parceira (comissao externa, calculada na fase 3).
  partner_store text,

  signature_path text,
  signed_at timestamptz,
  signer_name text,
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, code_seq)
);

create index on public.service_orders (tenant_id, status);
create index on public.service_orders (tenant_id, service_date, shift);
create index on public.service_orders (tenant_id, lead_id);
create index on public.service_orders (tenant_id, consultant_id);

-- ---------------------------------------------------------------------------
-- Itens da OS (pecas / servicos). kind='upsell' e o que o tecnico vendeu na
-- residencia - so esses geram comissao pro tecnico na fase 3.
-- ---------------------------------------------------------------------------

create table public.service_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price_cents bigint not null default 0,
  amount_cents bigint not null default 0,
  kind text not null default 'original' check (kind in ('original','upsell')),
  -- Item de upsell entra pendente e so soma no total depois que o ADM aprova.
  approved boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.service_order_items (service_order_id);
create index on public.service_order_items (tenant_id);

-- Total da OS vira soma dos itens aprovados, mesmo padrao ja usado em
-- lead_value_items -> leads.value_cents.
create or replace function public.recalc_service_order_total()
returns trigger language plpgsql as $$
declare target_order uuid := coalesce(new.service_order_id, old.service_order_id);
begin
  update public.service_orders
  set total_cents = coalesce((
        select sum(amount_cents)
        from public.service_order_items
        where service_order_id = target_order and approved
      ), 0),
      updated_at = now()
  where id = target_order;
  return null;
end; $$;

create trigger service_order_items_recalc
  after insert or update or delete on public.service_order_items
  for each row execute function public.recalc_service_order_total();

-- ---------------------------------------------------------------------------
-- Tecnicos da OS. Podem ir dois na mesma residencia - a comissao do upsell e
-- dividida entre os que estao aqui.
-- ---------------------------------------------------------------------------

create table public.service_order_technicians (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (service_order_id, user_id)
);

create index on public.service_order_technicians (tenant_id, user_id);
create index on public.service_order_technicians (service_order_id);

-- ---------------------------------------------------------------------------
-- Avarias do estofado registradas na chegada ("recebido"), com foto.
-- ---------------------------------------------------------------------------

create table public.service_order_damages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  description text not null,
  photo_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.service_order_damages (service_order_id);

-- ---------------------------------------------------------------------------
-- Historico de status, pra rastrear quem mudou o que e quando.
-- ---------------------------------------------------------------------------

create table public.service_order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  user_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index on public.service_order_events (service_order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers de visibilidade
-- ---------------------------------------------------------------------------

-- security definer pra nao recursar nas policies: quando a policy de
-- service_orders precisa saber se o usuario e tecnico daquela OS, ela nao
-- pode disparar a policy de service_order_technicians de novo.
create or replace function public.is_service_order_technician(p_order_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.service_order_technicians t
    where t.service_order_id = p_order_id and t.user_id = p_user_id
  );
$$;

-- Regra unica de "quem pode ver esta OS", reusada pelas tabelas filhas:
-- gestao ve tudo; vendedor so o que ele vendeu; tecnico so onde ele vai.
create or replace function public.can_view_service_order(p_order_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.service_orders so
    where so.id = p_order_id
      and public.is_tenant_member(so.tenant_id)
      and (
        public.has_tenant_role(so.tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
        or so.consultant_id = auth.uid()
        or so.created_by = auth.uid()
        or public.is_service_order_technician(so.id, auth.uid())
      )
  );
$$;

grant execute on function public.is_service_order_technician(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_service_order(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.service_orders enable row level security;
alter table public.service_order_items enable row level security;
alter table public.service_order_technicians enable row level security;
alter table public.service_order_damages enable row level security;
alter table public.service_order_events enable row level security;

create policy "service_orders_select" on public.service_orders
  for select using (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
      or consultant_id = auth.uid()
      or created_by = auth.uid()
      or public.is_service_order_technician(id, auth.uid())
    )
  );

create policy "service_orders_insert" on public.service_orders
  for insert with check (
    public.is_tenant_member(tenant_id)
    and public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente','vendedor']::public.member_role[])
  );

create policy "service_orders_update" on public.service_orders
  for update using (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
      or consultant_id = auth.uid()
      or public.is_service_order_technician(id, auth.uid())
    )
  )
  with check (public.is_tenant_member(tenant_id));

create policy "service_orders_delete" on public.service_orders
  for delete using (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  );

create policy "service_order_items_select" on public.service_order_items
  for select using (public.can_view_service_order(service_order_id));
create policy "service_order_items_insert" on public.service_order_items
  for insert with check (
    public.is_tenant_member(tenant_id) and public.can_view_service_order(service_order_id)
  );
create policy "service_order_items_update" on public.service_order_items
  for update using (public.can_view_service_order(service_order_id))
  with check (public.is_tenant_member(tenant_id));
create policy "service_order_items_delete" on public.service_order_items
  for delete using (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente']::public.member_role[])
  );

create policy "service_order_technicians_select" on public.service_order_technicians
  for select using (
    public.is_tenant_member(tenant_id)
    and (user_id = auth.uid() or public.can_view_service_order(service_order_id))
  );
create policy "service_order_technicians_write" on public.service_order_technicians
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
  );

create policy "service_order_damages_select" on public.service_order_damages
  for select using (public.can_view_service_order(service_order_id));
create policy "service_order_damages_insert" on public.service_order_damages
  for insert with check (
    public.is_tenant_member(tenant_id) and public.can_view_service_order(service_order_id)
  );
create policy "service_order_damages_delete" on public.service_order_damages
  for delete using (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente']::public.member_role[])
  );

create policy "service_order_events_select" on public.service_order_events
  for select using (public.can_view_service_order(service_order_id));
create policy "service_order_events_insert" on public.service_order_events
  for insert with check (
    public.is_tenant_member(tenant_id) and public.can_view_service_order(service_order_id)
  );

-- ---------------------------------------------------------------------------
-- Bucket privado de assinaturas e fotos (mesmo esquema de prefixo por tenant
-- usado no bucket lead-files).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('service-orders', 'service-orders', false)
on conflict (id) do nothing;

create policy "service_order_files_select" on storage.objects
  for select using (
    bucket_id = 'service-orders'
    and (storage.foldername(name))[1]::uuid in (select public.user_tenant_ids())
  );

create policy "service_order_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'service-orders'
    and (storage.foldername(name))[1]::uuid in (select public.user_tenant_ids())
  );

create policy "service_order_files_delete" on storage.objects
  for delete using (
    bucket_id = 'service-orders'
    and (storage.foldername(name))[1]::uuid in (select public.user_tenant_ids())
  );

-- Ativa o modulo para o tenant que pediu (ACT / Demoact).
update public.tenants
set field_service_enabled = true
where id = '54a6a18e-27f1-45c4-993b-42707a9f150b';
