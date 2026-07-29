-- Comissao do vendedor externo, com percentual negociado por OS.
--
-- Pedido do cliente por audio: "fui indicado por uma loja, e aí tem que pagar
-- uma comissão pro vendedor externo (...) isso já sai certo na OS, com a
-- porcentagem negociada".
--
-- O que faltava:
--   1. Nome do vendedor externo - so existia o nome da loja.
--   2. Percentual por OS - so existia um percentual global por empresa, e a
--      negociacao muda de indicacao pra indicacao.
--
-- As duas colunas sao opcionais: OS sem percentual proprio continua usando a
-- regra global, exatamente como antes. Nada muda pro que ja foi faturado.

alter table public.service_orders
  add column if not exists partner_seller_name text,
  add column if not exists partner_commission_percent numeric(6,3)
    check (partner_commission_percent >= 0 and partner_commission_percent <= 100);

comment on column public.service_orders.partner_seller_name is
  'Vendedor da loja parceira que indicou. E ele quem recebe a comissao externa.';
comment on column public.service_orders.partner_commission_percent is
  'Percentual negociado nesta indicacao. Nulo = usa a regra global do tenant.';

-- A comissao passa a registrar loja e vendedor separados: partner_name guarda
-- quem recebe, partner_store guarda de onde veio a indicacao.
alter table public.commissions
  add column if not exists partner_store text;

comment on column public.commissions.partner_store is
  'Loja que indicou. O beneficiario da comissao vai em partner_name.';

-- ---------------------------------------------------------------------------
-- Faturamento: mesma funcao, so o trecho da comissao externa muda.
--
-- Cuidado deliberado: o resto do corpo e identico ao original. Faturamento e
-- comissoes saem na mesma transacao, e meio caminho aqui deixaria comissao sem
-- faturamento no fechamento do mes.
-- ---------------------------------------------------------------------------
create or replace function public.bill_service_order(
  p_service_order_id uuid,
  p_user_id uuid
) returns void
language plpgsql
-- invoker, igual a versao original: a funcao roda com as permissoes de quem
-- chamou, entao a RLS continua valendo e ninguem fatura OS de outro tenant.
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
begin
  -- `for update` trava a linha ate o fim da transacao. A versao anterior nao
  -- travava: duas chamadas simultaneas podiam ler status 'conferida' as duas e
  -- seguir em frente. As comissoes escapavam pelo unique, mas o lancamento a
  -- receber nao tem unique - dava pra sair em duplicidade. Com a trava, a
  -- segunda chamada espera e encontra a OS ja 'faturada'.
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

  -- O percentual negociado na OS manda sobre a regra global. Zero negociado e
  -- uma escolha valida ("essa indicacao nao paga"), por isso o teste e por
  -- nulo e nao por valor.
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

  -- Comissao externa: quem recebe e o vendedor da loja, quando informado.
  -- Sem vendedor, cai no nome da loja - e como as OS antigas funcionavam, e
  -- continua valendo pra quem so registra a loja.
  v_partner_beneficiary := coalesce(
    nullif(btrim(v_order.partner_seller_name), ''),
    nullif(btrim(v_order.partner_store), '')
  );

  if v_partner_beneficiary is not null and v_order.total_cents > 0
     and v_parceira_percent > 0 then
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
