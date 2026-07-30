-- Resumo de comissao antes de faturar (item 4 da pauta): mostrar quem vai
-- receber o que ANTES do usuario confirmar, pra ninguem faturar sem saber
-- pra quem esta indo o dinheiro (foi exatamente o que aconteceu com a
-- comissao do Matheus em 2026-07-29 - a comissao estava certa, mas ninguem
-- sabia que ia sair antes de clicar).
--
-- Em vez de duplicar a conta de comissao numa function separada (risco real:
-- essa e a QUARTA vez que bill_service_order muda nesta rodada de trabalho -
-- duplicar a logica um dia ia dessincronizar, e resumo mostrando uma coisa
-- enquanto o faturamento gera outra e o pior tipo de bug financeiro,
-- silencioso), o calculo sai da bill_service_order e vira uma function pura
-- que so LE e devolve as linhas, sem gravar nada. bill_service_order passa a
-- chamar essa function e inserir o que ela devolve. Resumo e faturamento
-- sao, por construcao, a mesma conta.
--
-- As colunas de saida levam prefixo `out_` de proposito: sem o prefixo,
-- `amount_cents` (nome de saida) colide com `service_order_items.amount_cents`
-- (coluna real) e o Postgres recusa a function inteira com
-- "column reference is ambiguous" - pegamos isso testando antes de aplicar.
create or replace function public.compute_service_order_commissions(p_service_order_id uuid)
returns table (
  out_party_kind text,
  out_user_id uuid,
  out_partner_id uuid,
  out_partner_name text,
  out_partner_store text,
  out_base_cents bigint,
  out_percent numeric,
  out_amount_cents bigint
)
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
  select * into v_order from public.service_orders where id = p_service_order_id;
  if not found then
    raise exception 'OS nao encontrada';
  end if;

  select coalesce(sum(soi.amount_cents), 0) into v_upsell_cents
  from public.service_order_items soi
  where soi.service_order_id = p_service_order_id and soi.kind = 'upsell' and soi.approved;

  select coalesce(max(case when cr.party_kind = 'tecnico' then cr.percent end), 0),
         coalesce(max(case when cr.party_kind = 'vendedora_interna' then cr.percent end), 0),
         coalesce(max(case when cr.party_kind = 'loja_parceira' then cr.percent end), 0)
    into v_tecnico_percent, v_vendedora_percent, v_parceira_percent
  from public.commission_rules cr
  where cr.tenant_id = v_order.tenant_id;

  if v_order.partner_commission_percent is not null then
    v_parceira_percent := v_order.partner_commission_percent;
  end if;

  select coalesce(array_agg(t.user_id order by t.is_primary desc, t.created_at), array[]::uuid[])
    into v_tecnicos
  from public.service_order_technicians t
  where t.service_order_id = p_service_order_id;

  v_tecnico_count := coalesce(array_length(v_tecnicos, 1), 0);

  if v_upsell_cents > 0 and v_tecnico_count > 0 and v_tecnico_percent > 0 then
    v_pool := round(v_upsell_cents * v_tecnico_percent / 100);
    v_base := v_pool / v_tecnico_count;
    v_remainder := v_pool - (v_base * v_tecnico_count);

    v_index := 0;
    foreach v_tecnico in array v_tecnicos loop
      v_amount := v_base + case when v_index < v_remainder then 1 else 0 end;
      if v_amount > 0 then
        out_party_kind := 'tecnico';
        out_user_id := v_tecnico;
        out_partner_id := null;
        out_partner_name := null;
        out_partner_store := null;
        out_base_cents := v_upsell_cents;
        out_percent := v_tecnico_percent;
        out_amount_cents := v_amount;
        return next;
      end if;
      v_index := v_index + 1;
    end loop;
  end if;

  if v_order.consultant_id is not null and v_order.total_cents > 0
     and v_vendedora_percent > 0 then
    v_amount := round(v_order.total_cents * v_vendedora_percent / 100);
    if v_amount > 0 then
      out_party_kind := 'vendedora_interna';
      out_user_id := v_order.consultant_id;
      out_partner_id := null;
      out_partner_name := null;
      out_partner_store := null;
      out_base_cents := v_order.total_cents;
      out_percent := v_vendedora_percent;
      out_amount_cents := v_amount;
      return next;
    end if;
  end if;

  if (v_order.partner_store_id is not null or v_order.partner_seller_id is not null)
     and v_order.total_cents > 0 and v_parceira_percent > 0 then

    v_total_partner_amount := round(v_order.total_cents * v_parceira_percent / 100);

    if v_order.partner_store_id is not null and v_order.partner_seller_id is not null then
      v_store_split := coalesce(v_order.partner_store_split_percent, 50);
      v_store_amount := round(v_total_partner_amount * v_store_split / 100);
      v_seller_amount := v_total_partner_amount - v_store_amount;

      if v_store_amount > 0 then
        select fp.name into v_store_name from public.field_service_partners fp where fp.id = v_order.partner_store_id;
        out_party_kind := 'loja_parceira';
        out_user_id := null;
        out_partner_id := v_order.partner_store_id;
        out_partner_name := v_store_name;
        out_partner_store := null;
        out_base_cents := v_order.total_cents;
        out_percent := round(v_store_split * v_parceira_percent / 100, 3);
        out_amount_cents := v_store_amount;
        return next;
      end if;

      if v_seller_amount > 0 then
        select fp.name into v_seller_name from public.field_service_partners fp where fp.id = v_order.partner_seller_id;
        out_party_kind := 'vendedor_externo';
        out_user_id := null;
        out_partner_id := v_order.partner_seller_id;
        out_partner_name := v_seller_name;
        out_partner_store := null;
        out_base_cents := v_order.total_cents;
        out_percent := round((100 - v_store_split) * v_parceira_percent / 100, 3);
        out_amount_cents := v_seller_amount;
        return next;
      end if;

    elsif v_order.partner_store_id is not null then
      if v_total_partner_amount > 0 then
        select fp.name into v_store_name from public.field_service_partners fp where fp.id = v_order.partner_store_id;
        out_party_kind := 'loja_parceira';
        out_user_id := null;
        out_partner_id := v_order.partner_store_id;
        out_partner_name := v_store_name;
        out_partner_store := null;
        out_base_cents := v_order.total_cents;
        out_percent := v_parceira_percent;
        out_amount_cents := v_total_partner_amount;
        return next;
      end if;

    else
      if v_total_partner_amount > 0 then
        select fp.name into v_seller_name from public.field_service_partners fp where fp.id = v_order.partner_seller_id;
        out_party_kind := 'vendedor_externo';
        out_user_id := null;
        out_partner_id := v_order.partner_seller_id;
        out_partner_name := v_seller_name;
        out_partner_store := null;
        out_base_cents := v_order.total_cents;
        out_percent := v_parceira_percent;
        out_amount_cents := v_total_partner_amount;
        return next;
      end if;
    end if;

  elsif v_order.total_cents > 0 and v_parceira_percent > 0 then
    v_partner_beneficiary := coalesce(
      nullif(btrim(v_order.partner_seller_name), ''),
      nullif(btrim(v_order.partner_store), '')
    );

    if v_partner_beneficiary is not null then
      v_amount := round(v_order.total_cents * v_parceira_percent / 100);
      if v_amount > 0 then
        out_party_kind := 'loja_parceira';
        out_user_id := null;
        out_partner_id := null;
        out_partner_name := v_partner_beneficiary;
        out_partner_store := nullif(btrim(v_order.partner_store), '');
        out_base_cents := v_order.total_cents;
        out_percent := v_parceira_percent;
        out_amount_cents := v_amount;
        return next;
      end if;
    end if;
  end if;

  return;
end;
$$;

revoke all on function public.compute_service_order_commissions(uuid) from public;
grant execute on function public.compute_service_order_commissions(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- bill_service_order: o corpo de comissao vira um loop sobre a function
-- nova. O resto - trava da linha, checagem de status, lancamento a receber,
-- mudanca de status, evento - e identico ao de antes.
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
  v_row record;
begin
  select * into v_order from public.service_orders where id = p_service_order_id for update;
  if not found then
    raise exception 'OS nao encontrada';
  end if;
  if v_order.status <> 'conferida' then
    raise exception 'So da pra faturar uma OS conferida (status atual: %)', v_order.status;
  end if;

  insert into public.finance_entries (
    tenant_id, kind, description, amount_cents, due_date, status,
    category, service_order_id, created_by
  )
  values (
    v_order.tenant_id, 'receber', 'OS-' || lpad(v_order.code_seq::text, 4, '0'),
    v_order.total_cents, coalesce(v_order.deadline, current_date), 'aberta',
    'Servico em campo', v_order.id, p_user_id
  );

  for v_row in select * from public.compute_service_order_commissions(p_service_order_id) loop
    insert into public.commissions (
      tenant_id, service_order_id, party_kind, user_id, partner_id, partner_name,
      partner_store, base_cents, percent, amount_cents, status
    )
    values (
      v_order.tenant_id, v_order.id, v_row.out_party_kind, v_row.out_user_id, v_row.out_partner_id,
      v_row.out_partner_name, v_row.out_partner_store, v_row.out_base_cents, v_row.out_percent,
      v_row.out_amount_cents, 'prevista'
    )
    on conflict do nothing;
  end loop;

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
