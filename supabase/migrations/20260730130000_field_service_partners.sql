-- Cadastro de lojas e vendedores parceiros, com comissao dividida (pauta da
-- reuniao de 2026-07-29).
--
-- Ate aqui a indicacao era so texto livre (partner_store/partner_seller_name)
-- com UM beneficiario. O pedido: cadastrar lojas e os vendedores de cada
-- loja, e poder DIVIDIR a comissao de indicacao entre os dois - ex.: a
-- Benoit indicou, o vendedor da Benoit foi quem levou o cliente ate a ACT,
-- entao parte da comissao fica com a loja e parte com o vendedor. Ou, se so
-- um dos dois for informado, ele leva o total.
create type public.field_service_partner_kind as enum ('loja', 'vendedor');

create table public.field_service_partners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind public.field_service_partner_kind not null,
  name text not null,
  -- So preenchido em vendedor: a loja a qual ele pertence. Opcional -
  -- vendedor pode ser autonomo, sem loja.
  store_id uuid references public.field_service_partners(id) on delete set null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index field_service_partners_tenant_idx
  on public.field_service_partners (tenant_id, kind, is_active);

-- Check constraint nao alcanca outra linha da mesma tabela - store_id so faz
-- sentido em vendedor, e precisa apontar pra uma loja do MESMO tenant, entao
-- a validacao e por trigger.
create or replace function public.field_service_partners_validate_store()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'loja' and new.store_id is not null then
    raise exception 'Loja nao tem uma loja responsavel';
  end if;
  if new.kind = 'vendedor' and new.store_id is not null then
    if not exists (
      select 1 from public.field_service_partners
      where id = new.store_id and tenant_id = new.tenant_id and kind = 'loja'
    ) then
      raise exception 'A loja informada nao existe nesta empresa';
    end if;
  end if;
  return new;
end;
$$;

create trigger field_service_partners_validate_store_trg
  before insert or update on public.field_service_partners
  for each row execute function public.field_service_partners_validate_store();

alter table public.field_service_partners enable row level security;

-- Leitura: quem pode criar OS precisa escolher o parceiro no formulario.
create policy "field_service_partners_select" on public.field_service_partners
  for select using (
    public.is_tenant_member(tenant_id)
    and public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente','atendente','vendedor']::public.member_role[]
    )
  );

-- Escrita: so quem gerencia OS. Cadastro de parceiro e decisao do escritorio,
-- nao da vendedora na hora da venda.
create policy "field_service_partners_write" on public.field_service_partners
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
  );

-- ---------------------------------------------------------------------------
-- OS passa a referenciar o cadastro em vez de (so) texto livre.
-- partner_store / partner_seller_name continuam existindo: OS antiga ou sem
-- cadastro (indicacao avulsa, sem repetir negocio) continua funcionando exata
-- como antes - bill_service_order usa o cadastro quando presente, e cai no
-- texto livre quando nao.
-- ---------------------------------------------------------------------------
alter table public.service_orders
  add column if not exists partner_store_id uuid references public.field_service_partners(id) on delete set null,
  add column if not exists partner_seller_id uuid references public.field_service_partners(id) on delete set null,
  -- Percentual do total da comissao de indicacao que fica com a LOJA; o
  -- resto vai pro vendedor. So importa quando os dois estao preenchidos.
  add column if not exists partner_store_split_percent numeric(5,2)
    check (partner_store_split_percent is null or (partner_store_split_percent between 0 and 100));

comment on column public.service_orders.partner_store_id is
  'Loja parceira cadastrada. Junto com partner_seller_id, divide a comissao de indicacao conforme partner_store_split_percent.';
comment on column public.service_orders.partner_seller_id is
  'Vendedor parceiro cadastrado, indicado nesta OS.';
comment on column public.service_orders.partner_store_split_percent is
  'Fatia da comissao de indicacao que fica com a loja (0-100). Nulo com os dois preenchidos = 50/50, a negociacao muda a cada indicacao.';

-- ---------------------------------------------------------------------------
-- Comissao ganha o papel "vendedor_externo", separado de "loja_parceira",
-- pra loja e vendedor aparecerem como linhas distintas quando a comissao e
-- dividida. E rastreabilidade ao cadastro via partner_id.
-- ---------------------------------------------------------------------------
alter table public.commissions
  add column if not exists partner_id uuid references public.field_service_partners(id) on delete set null;

alter table public.commissions drop constraint commissions_party_kind_check;
alter table public.commissions add constraint commissions_party_kind_check
  check (party_kind = any (array['tecnico','vendedora_interna','loja_parceira','vendedor_externo']));

alter table public.commission_rules drop constraint commission_rules_party_kind_check;
alter table public.commission_rules add constraint commission_rules_party_kind_check
  check (party_kind = any (array['tecnico','vendedora_interna','loja_parceira','vendedor_externo']));

-- ---------------------------------------------------------------------------
-- bill_service_order: so o trecho da comissao de indicacao muda. O resto e
-- identico a versao anterior (conferido com pg_get_functiondef antes de
-- escrever esta migration) - faturamento, comissao de tecnico e de vendedora
-- interna nao mudam uma linha.
-- ---------------------------------------------------------------------------
create or replace function public.bill_service_order(
  p_service_order_id uuid,
  p_user_id uuid
) returns void
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
  v_partner_beneficiary text;
  v_total_partner_amount bigint;
  v_store_split numeric(6,3);
  v_store_amount bigint;
  v_seller_amount bigint;
  v_store_name text;
  v_seller_name text;
begin
  select * into v_order from public.service_orders where id = p_service_order_id for update;
  if not found then
    raise exception 'OS nao encontrada';
  end if;
  if v_order.status <> 'conferida' then
    raise exception 'So da pra faturar uma OS conferida (status atual: %)', v_order.status;
  end if;

  select coalesce(sum(amount_cents), 0) into v_upsell_cents
  from public.service_order_items
  where service_order_id = p_service_order_id and kind = 'upsell' and approved;

  select coalesce(max(case when party_kind = 'tecnico' then percent end), 0),
         coalesce(max(case when party_kind = 'vendedora_interna' then percent end), 0),
         coalesce(max(case when party_kind = 'loja_parceira' then percent end), 0)
    into v_tecnico_percent, v_vendedora_percent, v_parceira_percent
  from public.commission_rules
  where tenant_id = v_order.tenant_id;

  if v_order.partner_commission_percent is not null then
    v_parceira_percent := v_order.partner_commission_percent;
  end if;

  select coalesce(array_agg(user_id order by is_primary desc, created_at), array[]::uuid[])
    into v_tecnicos
  from public.service_order_technicians
  where service_order_id = p_service_order_id;

  v_tecnico_count := coalesce(array_length(v_tecnicos, 1), 0);

  insert into public.finance_entries (
    tenant_id, kind, description, amount_cents, due_date, status,
    category, service_order_id, created_by
  )
  values (
    v_order.tenant_id, 'receber', 'OS-' || lpad(v_order.code_seq::text, 4, '0'),
    v_order.total_cents, coalesce(v_order.deadline, current_date), 'aberta',
    'Servico em campo', v_order.id, p_user_id
  );

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

  if v_order.consultant_id is not null and v_order.total_cents > 0
     and v_vendedora_percent > 0 then
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

  -- Comissao de indicacao: cadastro primeiro, texto livre so quando nao ha
  -- cadastro selecionado nesta OS.
  if (v_order.partner_store_id is not null or v_order.partner_seller_id is not null)
     and v_order.total_cents > 0 and v_parceira_percent > 0 then

    v_total_partner_amount := round(v_order.total_cents * v_parceira_percent / 100);

    if v_order.partner_store_id is not null and v_order.partner_seller_id is not null then
      -- Divide entre loja e vendedor. Sem split explicito na OS, meio a
      -- meio: a negociacao muda a cada indicacao, entao nao ha uma regra
      -- unica certa - 50/50 e o ponto de partida, editavel por OS.
      v_store_split := coalesce(v_order.partner_store_split_percent, 50);
      v_store_amount := round(v_total_partner_amount * v_store_split / 100);
      v_seller_amount := v_total_partner_amount - v_store_amount;

      if v_store_amount > 0 then
        select name into v_store_name from public.field_service_partners where id = v_order.partner_store_id;
        insert into public.commissions (
          tenant_id, service_order_id, party_kind, partner_id, partner_name,
          base_cents, percent, amount_cents, status
        ) values (
          v_order.tenant_id, v_order.id, 'loja_parceira', v_order.partner_store_id, v_store_name,
          v_order.total_cents, round(v_store_split * v_parceira_percent / 100, 3), v_store_amount, 'prevista'
        ) on conflict do nothing;
      end if;

      if v_seller_amount > 0 then
        select name into v_seller_name from public.field_service_partners where id = v_order.partner_seller_id;
        insert into public.commissions (
          tenant_id, service_order_id, party_kind, partner_id, partner_name,
          base_cents, percent, amount_cents, status
        ) values (
          v_order.tenant_id, v_order.id, 'vendedor_externo', v_order.partner_seller_id, v_seller_name,
          v_order.total_cents, round((100 - v_store_split) * v_parceira_percent / 100, 3), v_seller_amount, 'prevista'
        ) on conflict do nothing;
      end if;

    elsif v_order.partner_store_id is not null then
      -- So loja cadastrada: leva o total.
      if v_total_partner_amount > 0 then
        select name into v_store_name from public.field_service_partners where id = v_order.partner_store_id;
        insert into public.commissions (
          tenant_id, service_order_id, party_kind, partner_id, partner_name,
          base_cents, percent, amount_cents, status
        ) values (
          v_order.tenant_id, v_order.id, 'loja_parceira', v_order.partner_store_id, v_store_name,
          v_order.total_cents, v_parceira_percent, v_total_partner_amount, 'prevista'
        ) on conflict do nothing;
      end if;

    else
      -- So vendedor cadastrado: leva o total.
      if v_total_partner_amount > 0 then
        select name into v_seller_name from public.field_service_partners where id = v_order.partner_seller_id;
        insert into public.commissions (
          tenant_id, service_order_id, party_kind, partner_id, partner_name,
          base_cents, percent, amount_cents, status
        ) values (
          v_order.tenant_id, v_order.id, 'vendedor_externo', v_order.partner_seller_id, v_seller_name,
          v_order.total_cents, v_parceira_percent, v_total_partner_amount, 'prevista'
        ) on conflict do nothing;
      end if;
    end if;

  elsif v_order.total_cents > 0 and v_parceira_percent > 0 then
    -- Sem cadastro selecionado: caminho antigo, texto livre.
    v_partner_beneficiary := coalesce(
      nullif(btrim(v_order.partner_seller_name), ''),
      nullif(btrim(v_order.partner_store), '')
    );

    if v_partner_beneficiary is not null then
      v_amount := round(v_order.total_cents * v_parceira_percent / 100);
      if v_amount > 0 then
        insert into public.commissions (
          tenant_id, service_order_id, party_kind, partner_name, partner_store,
          base_cents, percent, amount_cents, status
        )
        values (
          v_order.tenant_id, v_order.id, 'loja_parceira', v_partner_beneficiary,
          nullif(btrim(v_order.partner_store), ''),
          v_order.total_cents, v_parceira_percent, v_amount, 'prevista'
        )
        on conflict do nothing;
      end if;
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
