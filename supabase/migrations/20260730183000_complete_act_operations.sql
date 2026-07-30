-- Completa os pontos operacionais confirmados para o ERP de campo:
-- catalogo/tabela de precos, parcelamento real e cancelamento auditado do
-- fechamento. As regras ficam no banco para a Data API nao conseguir
-- contornar as mesmas validacoes da interface.

-- Catalogo -----------------------------------------------------------------
create table public.service_catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category text not null
    check (category in ('lavagem','impermeabilizacao','couro','outro')),
  name text not null,
  unit text not null default 'un',
  price_cents bigint not null default 0 check (price_cents >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, category, name)
);

create index service_catalog_items_tenant_active_idx
  on public.service_catalog_items (tenant_id, is_active, category, name);

alter table public.service_catalog_items enable row level security;

create policy "service_catalog_items_select" on public.service_catalog_items
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "service_catalog_items_manage" on public.service_catalog_items
  for all to authenticated
  using (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente']::public.member_role[]
    )
  )
  with check (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente']::public.member_role[]
    )
  );

grant select, insert, update, delete on table public.service_catalog_items
  to authenticated, service_role;

alter table public.service_order_items
  add column catalog_item_id uuid
    references public.service_catalog_items(id) on delete set null;

create index service_order_items_catalog_idx
  on public.service_order_items (catalog_item_id)
  where catalog_item_id is not null;

-- Parcelamento -------------------------------------------------------------
alter table public.payment_method_rates
  add column installment_count integer not null default 1
    check (installment_count between 1 and 36),
  add column minimum_installment_cents bigint not null default 0
    check (minimum_installment_cents >= 0);

alter table public.finance_entries
  add column installment_number integer not null default 1
    check (installment_number >= 1),
  add column installment_count integer not null default 1
    check (installment_count >= 1),
  add constraint finance_entries_installment_order_check
    check (installment_number <= installment_count);

-- A funcao monta (ou remonta, depois de um ajuste aprovado) os titulos da
-- OS. Valores sao divididos em centavos sem arredondamento perdido: o resto
-- fica nas primeiras parcelas.
create or replace function public.rebuild_service_order_receivables(
  p_service_order_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.service_orders%rowtype;
  v_installments integer := 1;
  v_minimum bigint := 0;
  v_expected bigint;
  v_base bigint;
  v_remainder integer;
  v_amount bigint;
  v_paid_remaining bigint;
  v_due_date date;
  v_index integer;
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Usuario invalido';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_service_order_id
  for update;

  if not found then
    raise exception 'OS nao encontrada';
  end if;
  if not public.has_tenant_role(
    v_order.tenant_id,
    array['owner','admin']::public.member_role[]
  ) then
    raise exception 'Somente a gestao financeira pode gerar recebimentos';
  end if;
  if v_order.service_type = 'assistencia' then
    raise exception 'Assistencia/cortesia nao gera recebimento';
  end if;

  select installment_count, minimum_installment_cents
    into v_installments, v_minimum
  from public.payment_method_rates
  where tenant_id = v_order.tenant_id
    and lower(name) = lower(v_order.payment_method)
    and is_active
  limit 1;

  v_installments := coalesce(v_installments, 1);
  v_minimum := coalesce(v_minimum, 0);
  v_expected := coalesce(v_order.expected_receipt_cents, v_order.total_cents, 0);

  if v_expected < 0 then
    raise exception 'Valor previsto invalido';
  end if;
  if v_expected > 0
     and v_minimum > 0
     and floor(v_expected::numeric / v_installments) < v_minimum then
    raise exception 'Valor abaixo da parcela minima configurada';
  end if;

  delete from public.finance_entries
  where service_order_id = v_order.id
    and category in ('Servico em campo', 'Taxa de pagamento');

  if v_expected = 0 then
    return;
  end if;

  v_base := v_expected / v_installments;
  v_remainder := (v_expected % v_installments)::integer;
  v_paid_remaining := greatest(coalesce(v_order.received_cents, 0), 0);
  v_due_date := coalesce(v_order.deadline, current_date);

  for v_index in 1..v_installments loop
    v_amount := v_base + case when v_index <= v_remainder then 1 else 0 end;

    insert into public.finance_entries (
      tenant_id, kind, description, amount_cents, due_date, paid_at, status,
      category, service_order_id, payment_method, installment_number,
      installment_count, created_by
    )
    values (
      v_order.tenant_id,
      'receber',
      'OS-' || lpad(v_order.code_seq::text, 4, '0')
        || case when v_installments > 1
          then ' - parcela ' || v_index || '/' || v_installments
          else ''
        end,
      v_amount,
      (v_due_date + make_interval(months => v_index - 1))::date,
      case when v_paid_remaining >= v_amount then now() else null end,
      case when v_paid_remaining >= v_amount then 'paga' else 'aberta' end,
      'Servico em campo',
      v_order.id,
      v_order.payment_method,
      v_index,
      v_installments,
      p_user_id
    );

    v_paid_remaining := greatest(v_paid_remaining - v_amount, 0);
  end loop;
end;
$$;

revoke all on function public.rebuild_service_order_receivables(uuid, uuid)
  from public;
grant execute on function public.rebuild_service_order_receivables(uuid, uuid)
  to authenticated, service_role;

-- O trigger antigo substituia toda parcela pelo total da OS. Agora a funcao
-- acima entrega o valor exato; o trigger apenas completa metadados legados.
create or replace function public.prepare_service_order_receivable()
returns trigger language plpgsql
set search_path = public
as $$
declare
  v_method text;
begin
  if new.kind = 'receber'
     and new.category = 'Servico em campo'
     and new.service_order_id is not null then
    select payment_method into v_method
    from public.service_orders
    where id = new.service_order_id;
    new.payment_method := coalesce(new.payment_method, v_method);
  end if;
  return new;
end;
$$;

-- Taxa e calculada uma vez sobre o recebido da OS, nao uma vez por parcela.
create or replace function public.create_service_order_payment_fee()
returns trigger language plpgsql
set search_path = public
as $$
declare
  v_received bigint;
  v_rate numeric(7,4);
  v_fee bigint;
begin
  if new.kind <> 'receber'
     or new.category <> 'Servico em campo'
     or new.service_order_id is null
     or new.payment_method is null
     or new.installment_number <> 1 then
    return new;
  end if;

  select received_cents into v_received
  from public.service_orders
  where id = new.service_order_id;

  select fee_percent into v_rate
  from public.payment_method_rates
  where tenant_id = new.tenant_id
    and lower(name) = lower(new.payment_method)
    and is_active
  limit 1;

  v_fee := round(coalesce(v_received, 0) * coalesce(v_rate, 0) / 100);
  if v_fee > 0 then
    insert into public.finance_entries (
      tenant_id, kind, description, amount_cents, due_date, status,
      category, service_order_id, payment_method, created_by
    )
    values (
      new.tenant_id, 'pagar', 'Taxa de pagamento da OS',
      v_fee, coalesce(new.due_date, current_date), 'aberta',
      'Taxa de pagamento', new.service_order_id, new.payment_method, new.created_by
    );
  end if;
  return new;
end;
$$;

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
  if p_user_id is distinct from auth.uid() then
    raise exception 'Usuario invalido';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_service_order_id
  for update;

  if not found then
    raise exception 'OS nao encontrada';
  end if;
  if v_order.status <> 'conferida' then
    raise exception 'So da pra faturar uma OS conferida (status atual: %)', v_order.status;
  end if;

  perform public.rebuild_service_order_receivables(v_order.id, p_user_id);

  for v_row in select * from public.compute_service_order_commissions(p_service_order_id) loop
    insert into public.commissions (
      tenant_id, service_order_id, party_kind, user_id, partner_id, partner_name,
      partner_store, base_cents, percent, amount_cents, status
    )
    values (
      v_order.tenant_id, v_order.id, v_row.out_party_kind, v_row.out_user_id,
      v_row.out_partner_id, v_row.out_partner_name, v_row.out_partner_store,
      v_row.out_base_cents, v_row.out_percent, v_row.out_amount_cents, 'prevista'
    )
    on conflict do nothing;
  end loop;

  update public.service_orders
  set status = 'faturada', updated_at = now()
  where id = v_order.id;

  insert into public.service_order_events (
    tenant_id, service_order_id, from_status, to_status, user_id, reason
  )
  values (
    v_order.tenant_id, v_order.id, 'conferida', 'faturada', p_user_id,
    'Faturamento gerado automaticamente'
  );
end;
$$;

revoke all on function public.bill_service_order(uuid, uuid) from public;
grant execute on function public.bill_service_order(uuid, uuid)
  to authenticated, service_role;

-- Ajuste aprovado remonta as parcelas e a taxa dentro da mesma transacao.
create or replace function public.approve_financial_adjustment(
  p_request_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.financial_adjustment_requests%rowtype;
  v_expected bigint;
  v_received bigint;
  v_method text;
  v_amount bigint;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Usuario invalido';
  end if;

  select * into v_request
  from public.financial_adjustment_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'pendente' then
    raise exception 'Solicitacao pendente nao encontrada';
  end if;
  if not public.has_tenant_role(
    v_request.tenant_id,
    array['owner']::public.member_role[]
  ) then
    raise exception 'Somente um dos donos pode liberar esta alteracao';
  end if;

  if v_request.adjustment_kind = 'acerto_os' then
    v_expected := (v_request.payload ->> 'expected_receipt_cents')::bigint;
    v_received := (v_request.payload ->> 'received_cents')::bigint;
    v_method := nullif(btrim(v_request.payload ->> 'payment_method'), '');

    if v_expected < 0 or v_received < 0 then
      raise exception 'Valores invalidos';
    end if;

    update public.service_orders
    set expected_receipt_cents = v_expected,
        received_cents = v_received,
        payment_method = v_method,
        updated_at = now()
    where id = v_request.service_order_id
      and tenant_id = v_request.tenant_id;

    perform public.rebuild_service_order_receivables(
      v_request.service_order_id,
      p_user_id
    );

  elsif v_request.adjustment_kind = 'comissao' then
    v_amount := (v_request.payload ->> 'amount_cents')::bigint;
    if v_amount < 0 then
      raise exception 'Valor de comissao invalido';
    end if;

    update public.commissions
    set amount_cents = v_amount
    where id = v_request.commission_id
      and tenant_id = v_request.tenant_id;
  end if;

  update public.financial_adjustment_requests
  set status = 'aprovado', reviewed_by = p_user_id, reviewed_at = now()
  where id = v_request.id;
end;
$$;

revoke all on function public.approve_financial_adjustment(uuid, uuid)
  from public;
grant execute on function public.approve_financial_adjustment(uuid, uuid)
  to authenticated, service_role;

-- Cancelamento da finalizacao ----------------------------------------------
create or replace function public.cancel_service_order_closure(
  p_service_order_id uuid,
  p_user_id uuid,
  p_reason text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.service_orders%rowtype;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Usuario invalido';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Informe o motivo do cancelamento';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_service_order_id
  for update;

  if not found then
    raise exception 'OS nao encontrada';
  end if;
  if v_order.status not in ('concluida','conferida','assistencia') then
    raise exception 'Esta OS nao possui uma finalizacao cancelavel';
  end if;
  if not public.has_tenant_role(
    v_order.tenant_id,
    array['owner','admin','gerente']::public.member_role[]
  ) then
    raise exception 'Somente a gestao pode cancelar uma finalizacao';
  end if;

  update public.service_orders
  set status = 'em_execucao',
      service_type = 'normal',
      closure_type = null,
      completed_at = null,
      reviewed_at = null,
      reviewed_by = null,
      updated_at = now()
  where id = v_order.id;

  insert into public.service_order_events (
    tenant_id, service_order_id, from_status, to_status, user_id, reason
  )
  values (
    v_order.tenant_id, v_order.id, v_order.status, 'em_execucao', p_user_id,
    'Finalizacao cancelada: ' || btrim(p_reason)
  );
end;
$$;

revoke all on function public.cancel_service_order_closure(uuid, uuid, text)
  from public;
grant execute on function public.cancel_service_order_closure(uuid, uuid, text)
  to authenticated, service_role;

-- Conferencia cancelada volta direto para execucao. Continua restrita a
-- owner/admin/gerente pela mesma funcao de permissao.
create or replace function public.enforce_service_order_status_permissions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_office boolean;
  v_is_finance boolean;
  v_is_reviewer boolean;
  v_is_field_actor boolean;
  v_is_reopening boolean;
begin
  if v_user is null or new.status is not distinct from old.status then
    return new;
  end if;

  v_is_office := public.has_tenant_role(
    old.tenant_id,
    array['owner','admin','gerente','atendente']::public.member_role[]
  );
  v_is_finance := public.has_tenant_role(
    old.tenant_id,
    array['owner','admin']::public.member_role[]
  );
  v_is_reviewer := public.has_tenant_role(
    old.tenant_id,
    array['owner','admin','gerente']::public.member_role[]
  );
  v_is_field_actor := v_is_reviewer
    or public.is_service_order_technician(old.id, v_user);

  v_is_reopening :=
    (old.status = 'concluida' and new.status = 'em_execucao')
    or (old.status = 'conferida' and new.status in ('concluida','em_execucao'))
    or (old.status = 'assistencia' and new.status = 'em_execucao');

  if v_is_reopening and not v_is_reviewer then
    raise exception 'Somente a gestao pode reabrir uma finalizacao';
  end if;

  if new.status in ('conferida','faturada') and not v_is_finance then
    raise exception 'Somente a gestao financeira pode conferir ou faturar a OS';
  elsif new.status in ('agendada','remarcada','cancelada','rascunho')
        and not v_is_office then
    raise exception 'Essa alteracao de agenda/status e feita pelo escritorio';
  elsif new.status in ('em_execucao','concluida','assistencia')
        and not v_is_field_actor then
    raise exception 'Somente tecnico alocado ou gestao pode fechar esta OS';
  end if;

  return new;
end;
$$;

-- ACT: o unico vendedor ativo passa a participar do round-robin. Leads de
-- parceiro continuam fora do sorteio por regra da Server Action.
insert into public.attendant_status (tenant_id, user_id, is_available)
select tm.tenant_id, tm.user_id, true
from public.tenant_members tm
where tm.tenant_id = '54a6a18e-27f1-45c4-993b-42707a9f150b'::uuid
  and tm.role in ('vendedor','atendente')
on conflict (tenant_id, user_id)
do update set is_available = excluded.is_available, updated_at = now();

-- Itens visiveis nas referencias enviadas pelo ACT. A equipe pode ajustar
-- valores, desativar ou completar a tabela pela tela financeira.
insert into public.service_catalog_items (
  tenant_id, category, name, unit, price_cents, is_active
)
values
  ('54a6a18e-27f1-45c4-993b-42707a9f150b', 'lavagem', 'Colchão solteiro', 'un', 19000, true),
  ('54a6a18e-27f1-45c4-993b-42707a9f150b', 'lavagem', 'Sofá curva 5 lugares', 'un', 34000, true),
  ('54a6a18e-27f1-45c4-993b-42707a9f150b', 'lavagem', 'Sofá 3 lugares retrátil e reclinável', 'un', 24000, true),
  ('54a6a18e-27f1-45c4-993b-42707a9f150b', 'impermeabilizacao', 'Sofá curva 5 lugares', 'un', 42400, true),
  ('54a6a18e-27f1-45c4-993b-42707a9f150b', 'impermeabilizacao', 'Almofada pequena ou de rins', 'un', 1800, true),
  ('54a6a18e-27f1-45c4-993b-42707a9f150b', 'impermeabilizacao', 'Sofá 3 lugares retrátil e reclinável', 'un', 34900, true),
  ('54a6a18e-27f1-45c4-993b-42707a9f150b', 'impermeabilizacao', 'Cadeira - assento e encosto', 'un', 4900, true)
on conflict (tenant_id, category, name) do nothing;

insert into public.payment_method_rates (
  tenant_id, name, fee_percent, installment_count, minimum_installment_cents
)
values
  ('54a6a18e-27f1-45c4-993b-42707a9f150b', 'Crédito 2x', 0, 2, 0)
on conflict (tenant_id, name)
do update set installment_count = excluded.installment_count;
