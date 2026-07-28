-- ERP de servico em campo - Fase 3 (financeiro e comissoes).
--
-- Fluxo que a operacao ja faz hoje na mao:
--   OS concluida -> ADM confere e aprova o que o tecnico vendeu em campo
--   -> pre-fechamento (conferida) -> gestao libera (faturada)
--   -> vira faturamento da vendedora + comissoes a pagar.
--
-- O passo "faturada" e transacional: ou nasce o lancamento a receber E as
-- comissoes juntos, ou nao nasce nada. Meio caminho aqui significaria
-- comissao sem faturamento (ou o contrario) no fechamento do mes.

-- ---------------------------------------------------------------------------
-- Contas a pagar e a receber
-- ---------------------------------------------------------------------------

create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('pagar','receber')),
  description text not null,
  amount_cents bigint not null,
  due_date date,
  paid_at timestamptz,
  status text not null default 'aberta' check (status in ('aberta','paga','cancelada')),
  category text,
  service_order_id uuid references public.service_orders(id) on delete set null,
  -- Conta fixa: "temos contas para o proximo mes e isso ja deixar fixado".
  -- recurrence_day e o dia do vencimento que se repete todo mes.
  is_recurring boolean not null default false,
  recurrence_day int check (recurrence_day is null or (recurrence_day between 1 and 31)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.finance_entries (tenant_id, kind, due_date);
create index on public.finance_entries (tenant_id, status);
create index on public.finance_entries (tenant_id, service_order_id);

-- ---------------------------------------------------------------------------
-- Regras de comissao por tenant. Ficam em tabela, nao no codigo: o 1% da
-- vendedora e o percentual da loja parceira sao negociaveis e mudam sem
-- deploy.
-- ---------------------------------------------------------------------------

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  party_kind text not null check (party_kind in ('tecnico','vendedora_interna','loja_parceira')),
  percent numeric(6,3) not null default 0 check (percent >= 0 and percent <= 100),
  updated_at timestamptz not null default now(),
  unique (tenant_id, party_kind)
);

-- ---------------------------------------------------------------------------
-- Comissoes geradas no faturamento da OS
-- ---------------------------------------------------------------------------

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  party_kind text not null check (party_kind in ('tecnico','vendedora_interna','loja_parceira')),
  -- Loja parceira nao e usuario do sistema, entao user_id fica nulo e o nome
  -- vai em partner_name.
  user_id uuid references auth.users(id) on delete set null,
  partner_name text,
  base_cents bigint not null default 0,
  percent numeric(6,3) not null default 0,
  amount_cents bigint not null default 0,
  status text not null default 'prevista' check (status in ('prevista','aprovada','paga')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or partner_name is not null)
);

create index on public.commissions (tenant_id, status);
create index on public.commissions (tenant_id, user_id);
create index on public.commissions (service_order_id);

-- Uma OS faturada duas vezes nao pode duplicar comissao. Como a mesma pessoa
-- so entra uma vez por papel na mesma OS, o par (OS, papel, pessoa) e unico.
create unique index commissions_unique_party
  on public.commissions (service_order_id, party_kind, coalesce(user_id::text, partner_name));

-- ---------------------------------------------------------------------------
-- Faturamento da OS: lancamento a receber + comissoes, tudo ou nada.
-- ---------------------------------------------------------------------------

create or replace function public.bill_service_order(
  p_service_order_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.service_orders%rowtype;
  v_upsell_cents bigint;
  v_tecnico_percent numeric(6,3);
  v_vendedora_percent numeric(6,3);
  v_parceira_percent numeric(6,3);
  v_tecnicos uuid[];
  v_tecnico_count int;
  v_pool bigint;
  v_base bigint;
  v_remainder bigint;
  v_amount bigint;
  v_index int;
  v_tecnico uuid;
begin
  -- security invoker de proposito: quem nao enxerga a OS pela RLS tambem nao
  -- deve conseguir fatura-la por dentro da funcao.
  select * into v_order from public.service_orders where id = p_service_order_id;
  if not found then
    raise exception 'OS nao encontrada';
  end if;

  if v_order.status <> 'conferida' then
    raise exception 'So da pra faturar uma OS conferida (status atual: %)', v_order.status;
  end if;

  -- Base do tecnico: so o que ele vendeu na residencia E o ADM aprovou.
  select coalesce(sum(amount_cents), 0) into v_upsell_cents
  from public.service_order_items
  where service_order_id = p_service_order_id and kind = 'upsell' and approved;

  select coalesce(max(case when party_kind = 'tecnico' then percent end), 0),
         coalesce(max(case when party_kind = 'vendedora_interna' then percent end), 0),
         coalesce(max(case when party_kind = 'loja_parceira' then percent end), 0)
    into v_tecnico_percent, v_vendedora_percent, v_parceira_percent
  from public.commission_rules
  where tenant_id = v_order.tenant_id;

  select coalesce(array_agg(user_id order by is_primary desc, created_at), array[]::uuid[])
    into v_tecnicos
  from public.service_order_technicians
  where service_order_id = p_service_order_id;

  v_tecnico_count := coalesce(array_length(v_tecnicos, 1), 0);

  -- Lancamento a receber do cliente.
  insert into public.finance_entries (
    tenant_id, kind, description, amount_cents, due_date, status,
    category, service_order_id, created_by
  )
  values (
    v_order.tenant_id,
    'receber',
    'OS-' || lpad(v_order.code_seq::text, 4, '0'),
    v_order.total_cents,
    coalesce(v_order.deadline, current_date),
    'aberta',
    'Servico em campo',
    v_order.id,
    p_user_id
  );

  -- Comissao do tecnico, dividida entre quem foi na residencia. Os centavos
  -- que sobram da divisao vao pros primeiros, pra soma bater exatamente com
  -- o pool.
  if v_upsell_cents > 0 and v_tecnico_count > 0 and v_tecnico_percent > 0 then
    v_pool := round(v_upsell_cents * v_tecnico_percent / 100);
    v_base := v_pool / v_tecnico_count;
    v_remainder := v_pool - (v_base * v_tecnico_count);

    v_index := 0;
    foreach v_tecnico in array v_tecnicos loop
      v_amount := v_base + case when v_index < v_remainder then 1 else 0 end;
      if v_amount > 0 then
        insert into public.commissions (
          tenant_id, service_order_id, party_kind, user_id,
          base_cents, percent, amount_cents, status
        )
        values (
          v_order.tenant_id, v_order.id, 'tecnico', v_tecnico,
          v_upsell_cents, v_tecnico_percent, v_amount, 'prevista'
        )
        on conflict do nothing;
      end if;
      v_index := v_index + 1;
    end loop;
  end if;

  if v_order.consultant_id is not null and v_order.total_cents > 0 and v_vendedora_percent > 0 then
    v_amount := round(v_order.total_cents * v_vendedora_percent / 100);
    if v_amount > 0 then
      insert into public.commissions (
        tenant_id, service_order_id, party_kind, user_id,
        base_cents, percent, amount_cents, status
      )
      values (
        v_order.tenant_id, v_order.id, 'vendedora_interna', v_order.consultant_id,
        v_order.total_cents, v_vendedora_percent, v_amount, 'prevista'
      )
      on conflict do nothing;
    end if;
  end if;

  if coalesce(btrim(v_order.partner_store), '') <> '' and v_order.total_cents > 0
     and v_parceira_percent > 0 then
    v_amount := round(v_order.total_cents * v_parceira_percent / 100);
    if v_amount > 0 then
      insert into public.commissions (
        tenant_id, service_order_id, party_kind, partner_name,
        base_cents, percent, amount_cents, status
      )
      values (
        v_order.tenant_id, v_order.id, 'loja_parceira', btrim(v_order.partner_store),
        v_order.total_cents, v_parceira_percent, v_amount, 'prevista'
      )
      on conflict do nothing;
    end if;
  end if;

  update public.service_orders
  set status = 'faturada', updated_at = now()
  where id = p_service_order_id;

  insert into public.service_order_events (
    tenant_id, service_order_id, from_status, to_status, user_id, reason
  )
  values (
    v_order.tenant_id, v_order.id, 'conferida', 'faturada', p_user_id,
    'Faturamento gerado automaticamente'
  );
end;
$$;

grant execute on function public.bill_service_order(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: financeiro e so da gestao (resposta 18 do briefing - vendedora e
-- tecnico nao veem o caixa da empresa).
-- ---------------------------------------------------------------------------

alter table public.finance_entries enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commissions enable row level security;

create policy "finance_entries_manage" on public.finance_entries
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  );

create policy "commission_rules_manage" on public.commission_rules
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  );

-- Gestao ve e mexe em tudo; cada pessoa ve a propria comissao (sem editar).
create policy "commissions_select" on public.commissions
  for select using (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
    or user_id = auth.uid()
  );

create policy "commissions_write" on public.commissions
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  );

-- Regras padrao pra quem ja tem o modulo ligado, com os percentuais que o
-- ACT informou no briefing (1% vendedora interna).
insert into public.commission_rules (tenant_id, party_kind, percent)
select t.id, r.party_kind, r.percent
from public.tenants t
cross join (values ('tecnico', 10.0), ('vendedora_interna', 1.0), ('loja_parceira', 5.0))
  as r(party_kind, percent)
where t.field_service_enabled
on conflict (tenant_id, party_kind) do nothing;
