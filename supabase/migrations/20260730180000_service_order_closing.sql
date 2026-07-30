-- Fechamento operacional da OS:
--   * laudo/checklist unico por OS;
--   * assistencia/cortesia como resultado terminal, sem valor/comissao;
--   * orcamento originado em campo e convertido em nova OS;
--   * historico de remarcacoes feito pelo escritorio;
--   * acerto esperado/recebido/pendente por OS;
--   * ajustes financeiros auditados e liberados por owner.

alter table public.service_orders
  drop constraint if exists service_orders_status_check;

alter table public.service_orders
  add constraint service_orders_status_check
  check (status in (
    'rascunho','agendada','em_execucao','concluida','conferida',
    'faturada','cancelada','remarcada','assistencia'
  ));

alter table public.service_orders
  add column if not exists service_type text not null default 'normal'
    check (service_type in ('normal','assistencia')),
  add column if not exists closure_type text
    check (closure_type is null or closure_type in ('finalizado','finalizado_orcamento','assistencia')),
  add column if not exists closure_notes text,
  add column if not exists origin_service_order_id uuid
    references public.service_orders(id) on delete set null,
  add column if not exists payment_method text,
  add column if not exists expected_receipt_cents bigint
    check (expected_receipt_cents is null or expected_receipt_cents >= 0),
  add column if not exists received_cents bigint not null default 0
    check (received_cents >= 0);

create index if not exists service_orders_origin_idx
  on public.service_orders (origin_service_order_id);

comment on column public.service_orders.service_type is
  'normal ou assistencia/cortesia; assistencia nunca gera valor nem comissao.';
comment on column public.service_orders.origin_service_order_id is
  'OS de origem quando esta OS nasceu de um orcamento feito em campo.';

-- Laudo unico por OS. As respostas ficam em JSON para o checklist poder
-- evoluir sem uma migration para cada pergunta nova.
create table if not exists public.service_order_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  observations text,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_order_id)
);

create index if not exists service_order_checklists_tenant_idx
  on public.service_order_checklists (tenant_id);

-- Orcamento anotado pelo tecnico. Ao ser aceito, o escritorio cria uma nova
-- OS e converted_service_order_id preserva o elo entre as duas.
create table if not exists public.service_order_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  description text not null,
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  status text not null default 'pendente'
    check (status in ('pendente','convertido','cancelado')),
  converted_service_order_id uuid references public.service_orders(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_order_quotes_order_idx
  on public.service_order_quotes (service_order_id, created_at desc);

-- Uma troca de data nao apaga a agenda anterior: o painel do dia consegue
-- mostrar que aquela visita foi remarcada e para quando ela foi movida.
create table if not exists public.service_order_schedule_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  previous_date date,
  previous_shift text check (previous_shift is null or previous_shift in ('manha','tarde')),
  new_date date,
  new_shift text check (new_shift is null or new_shift in ('manha','tarde')),
  reason text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists service_order_schedule_history_day_idx
  on public.service_order_schedule_history (tenant_id, previous_date);

-- Tabela configuravel de taxas. Os percentuais ficam zerados ate o cliente
-- informar as taxas reais das maquininhas.
create table if not exists public.payment_method_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  fee_percent numeric(7,4) not null default 0
    check (fee_percent >= 0 and fee_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.finance_entries
  add column if not exists payment_method text;

-- Depois que dinheiro/comissao foi lancado, a alteracao vira solicitacao.
-- Somente owner aprova; payload guarda o antes/depois aplicado.
create table if not exists public.financial_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_order_id uuid references public.service_orders(id) on delete cascade,
  commission_id uuid references public.commissions(id) on delete cascade,
  adjustment_kind text not null
    check (adjustment_kind in ('acerto_os','comissao')),
  payload jsonb not null,
  reason text not null,
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','recusado')),
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (service_order_id is not null or commission_id is not null)
);

create index if not exists financial_adjustments_tenant_status_idx
  on public.financial_adjustment_requests (tenant_id, status, created_at desc);

-- Fechamento atomico do tecnico: checklist, resultado, orcamento e evento
-- entram juntos ou nao entra nada.
create or replace function public.close_service_order(
  p_service_order_id uuid,
  p_user_id uuid,
  p_closure_type text,
  p_answers jsonb,
  p_observations text default null,
  p_quote_description text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.service_orders%rowtype;
  v_to_status text;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Usuario invalido';
  end if;
  if p_closure_type not in ('finalizado','finalizado_orcamento','assistencia') then
    raise exception 'Tipo de fechamento invalido';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_service_order_id
  for update;

  if not found then
    raise exception 'OS nao encontrada ou sem acesso';
  end if;
  if v_order.status <> 'em_execucao' then
    raise exception 'So da pra fechar uma OS em execucao';
  end if;
  if v_order.signed_at is null then
    raise exception 'Colete a assinatura do cliente antes de concluir a OS';
  end if;
  if p_closure_type = 'finalizado_orcamento'
     and coalesce(btrim(p_quote_description), '') = '' then
    raise exception 'Descreva o orcamento solicitado pelo cliente';
  end if;

  insert into public.service_order_checklists (
    tenant_id, service_order_id, answers, observations,
    completed_by, completed_at, updated_at
  )
  values (
    v_order.tenant_id, v_order.id, coalesce(p_answers, '{}'::jsonb),
    nullif(btrim(p_observations), ''), p_user_id, now(), now()
  )
  on conflict (service_order_id) do update
  set answers = excluded.answers,
      observations = excluded.observations,
      completed_by = excluded.completed_by,
      completed_at = excluded.completed_at,
      updated_at = now();

  if p_closure_type = 'finalizado_orcamento' then
    insert into public.service_order_quotes (
      tenant_id, service_order_id, description, created_by
    )
    values (
      v_order.tenant_id, v_order.id, btrim(p_quote_description), p_user_id
    );
  end if;

  v_to_status := case
    when p_closure_type = 'assistencia' then 'assistencia'
    else 'concluida'
  end;

  update public.service_orders
  set status = v_to_status,
      service_type = case when p_closure_type = 'assistencia' then 'assistencia' else service_type end,
      closure_type = p_closure_type,
      closure_notes = nullif(btrim(p_observations), ''),
      completed_at = now(),
      total_cents = case when p_closure_type = 'assistencia' then 0 else total_cents end,
      updated_at = now()
  where id = v_order.id;

  insert into public.service_order_events (
    tenant_id, service_order_id, from_status, to_status, user_id, reason
  )
  values (
    v_order.tenant_id, v_order.id, v_order.status, v_to_status, p_user_id,
    case p_closure_type
      when 'assistencia' then 'Fechada como assistencia/cortesia'
      when 'finalizado_orcamento' then 'Finalizada com orcamento anexo'
      else 'Servico finalizado'
    end
  );
end;
$$;

grant execute on function public.close_service_order(uuid, uuid, text, jsonb, text, text)
  to authenticated, service_role;

-- Converte um orcamento pendente em outra OS do mesmo cliente. O endereco e
-- os dados comerciais sao copiados, mas agenda/itens/tecnicos comecam limpos.
create or replace function public.convert_service_order_quote(
  p_quote_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote public.service_order_quotes%rowtype;
  v_origin public.service_orders%rowtype;
  v_new_id uuid;
  v_next_code int;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Usuario invalido';
  end if;
  select * into v_quote
  from public.service_order_quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Orcamento nao encontrado ou sem acesso';
  end if;
  if v_quote.status <> 'pendente' then
    raise exception 'Esse orcamento ja foi tratado';
  end if;

  select * into v_origin
  from public.service_orders
  where id = v_quote.service_order_id;

  perform pg_advisory_xact_lock(hashtextextended(v_origin.tenant_id::text, 0));
  select coalesce(max(code_seq), 0) + 1 into v_next_code
  from public.service_orders
  where tenant_id = v_origin.tenant_id;

  insert into public.service_orders (
    tenant_id, lead_id, code_seq, status, consultant_id, created_by,
    address_street, address_number, address_complement, address_district,
    address_city, address_state, address_cep, voltage, notes, observations,
    partner_store, partner_seller_name, partner_commission_percent,
    partner_store_id, partner_seller_id, partner_store_split_percent,
    origin_service_order_id
  )
  values (
    v_origin.tenant_id, v_origin.lead_id, v_next_code, 'rascunho',
    v_origin.consultant_id, p_user_id, v_origin.address_street,
    v_origin.address_number, v_origin.address_complement, v_origin.address_district,
    v_origin.address_city, v_origin.address_state, v_origin.address_cep,
    v_origin.voltage, 'Orcamento originado da OS-' || lpad(v_origin.code_seq::text, 4, '0'),
    v_quote.description, v_origin.partner_store, v_origin.partner_seller_name,
    v_origin.partner_commission_percent, v_origin.partner_store_id,
    v_origin.partner_seller_id, v_origin.partner_store_split_percent,
    v_origin.id
  )
  returning id into v_new_id;

  if v_quote.amount_cents is not null and v_quote.amount_cents > 0 then
    insert into public.service_order_items (
      tenant_id, service_order_id, description, quantity, unit_price_cents,
      amount_cents, kind, approved, created_by
    )
    values (
      v_origin.tenant_id, v_new_id, v_quote.description, 1,
      v_quote.amount_cents, v_quote.amount_cents, 'original', true, p_user_id
    );
  end if;

  update public.service_order_quotes
  set status = 'convertido', converted_service_order_id = v_new_id, updated_at = now()
  where id = v_quote.id;

  insert into public.service_order_events (
    tenant_id, service_order_id, from_status, to_status, user_id, reason
  )
  values (
    v_origin.tenant_id, v_new_id, null, 'rascunho', p_user_id,
    'Nova OS criada a partir de orcamento da OS-' || lpad(v_origin.code_seq::text, 4, '0')
  );

  return v_new_id;
end;
$$;

grant execute on function public.convert_service_order_quote(uuid, uuid)
  to authenticated, service_role;

-- Libera uma alteracao depois do lancamento. A funcao valida o owner no
-- banco e aplica acerto, recebimento e taxa de pagamento na mesma transacao.
create or replace function public.approve_financial_adjustment(
  p_request_id uuid,
  p_user_id uuid
)
returns void
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
  v_rate numeric(7,4);
  v_fee bigint;
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
    where id = v_request.service_order_id;

    update public.finance_entries
    set amount_cents = v_expected,
        payment_method = v_method,
        status = case when v_expected > 0 and v_received >= v_expected then 'paga' else 'aberta' end,
        paid_at = case when v_expected > 0 and v_received >= v_expected then now() else null end,
        updated_at = now()
    where service_order_id = v_request.service_order_id
      and kind = 'receber'
      and category = 'Servico em campo';

    delete from public.finance_entries
    where service_order_id = v_request.service_order_id
      and kind = 'pagar'
      and category = 'Taxa de pagamento';

    select fee_percent into v_rate
    from public.payment_method_rates
    where tenant_id = v_request.tenant_id
      and lower(name) = lower(v_method)
      and is_active
    limit 1;

    v_fee := round(v_received * coalesce(v_rate, 0) / 100);
    if v_fee > 0 then
      insert into public.finance_entries (
        tenant_id, kind, description, amount_cents, due_date, status,
        category, service_order_id, payment_method, created_by
      )
      values (
        v_request.tenant_id, 'pagar', 'Taxa de pagamento da OS',
        v_fee, current_date, 'aberta', 'Taxa de pagamento',
        v_request.service_order_id, v_method, p_user_id
      );
    end if;

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

grant execute on function public.approve_financial_adjustment(uuid, uuid)
  to authenticated, service_role;

-- Assistencia permanece zerada mesmo se alguma tela antiga mexer nos itens.
create or replace function public.recalc_service_order_total()
returns trigger language plpgsql
set search_path = public
as $$
declare
  target_order uuid := coalesce(new.service_order_id, old.service_order_id);
  target_type text;
begin
  select service_type into target_type
  from public.service_orders
  where id = target_order;

  update public.service_orders
  set total_cents = case
        when target_type = 'assistencia' then 0
        else coalesce((
          select sum(amount_cents)
          from public.service_order_items
          where service_order_id = target_order
            and approved
            and discount_status not in ('solicitado','recusado')
        ), 0) + coalesce((
          select travel_fee_cents from public.service_orders where id = target_order
        ), 0)
      end,
      updated_at = now()
  where id = target_order;
  return null;
end;
$$;

create or replace function public.recalc_service_order_total_from_order()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.travel_fee_cents is distinct from old.travel_fee_cents
     or new.service_type is distinct from old.service_type then
    update public.service_orders
    set total_cents = case
          when new.service_type = 'assistencia' then 0
          else coalesce((
            select sum(amount_cents)
            from public.service_order_items
            where service_order_id = new.id
              and approved
              and discount_status not in ('solicitado','recusado')
          ), 0) + new.travel_fee_cents
        end,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists service_orders_recalc_total_on_travel_fee on public.service_orders;
create trigger service_orders_recalc_total_on_pricing
  after update of travel_fee_cents, service_type on public.service_orders
  for each row execute function public.recalc_service_order_total_from_order();

-- Defesa no banco: mesmo uma chamada antiga de faturamento nao consegue
-- criar recebimento ou comissao para assistencia/cortesia.
create or replace function public.block_assistance_financial_entry()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.service_order_id is not null and exists (
    select 1 from public.service_orders
    where id = new.service_order_id and service_type = 'assistencia'
  ) then
    raise exception 'Assistencia/cortesia nao gera lancamento financeiro ou comissao';
  end if;
  return new;
end;
$$;

drop trigger if exists finance_entries_block_assistance on public.finance_entries;
create trigger finance_entries_block_assistance
  before insert or update of service_order_id on public.finance_entries
  for each row execute function public.block_assistance_financial_entry();

drop trigger if exists commissions_block_assistance on public.commissions;
create trigger commissions_block_assistance
  before insert or update of service_order_id on public.commissions
  for each row execute function public.block_assistance_financial_entry();

-- O faturamento existente continua sendo a porta de entrada, mas usa o
-- acerto informado na OS e cria a taxa configurada da forma de pagamento.
create or replace function public.prepare_service_order_receivable()
returns trigger language plpgsql
set search_path = public
as $$
declare
  v_order public.service_orders%rowtype;
begin
  if new.kind = 'receber'
     and new.category = 'Servico em campo'
     and new.service_order_id is not null then
    select * into v_order
    from public.service_orders
    where id = new.service_order_id;

    new.amount_cents := coalesce(v_order.expected_receipt_cents, v_order.total_cents);
    new.payment_method := v_order.payment_method;
    if new.amount_cents > 0 and v_order.received_cents >= new.amount_cents then
      new.status := 'paga';
      new.paid_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists finance_entries_prepare_service_receivable on public.finance_entries;
create trigger finance_entries_prepare_service_receivable
  before insert on public.finance_entries
  for each row execute function public.prepare_service_order_receivable();

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
     or new.payment_method is null then
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

drop trigger if exists finance_entries_create_service_fee on public.finance_entries;
create trigger finance_entries_create_service_fee
  after insert on public.finance_entries
  for each row execute function public.create_service_order_payment_fee();

-- RLS ----------------------------------------------------------------------
alter table public.service_order_checklists enable row level security;
alter table public.service_order_quotes enable row level security;
alter table public.service_order_schedule_history enable row level security;
alter table public.payment_method_rates enable row level security;
alter table public.financial_adjustment_requests enable row level security;

create policy "service_order_checklists_select" on public.service_order_checklists
  for select using (public.can_view_service_order(service_order_id));
create policy "service_order_checklists_write" on public.service_order_checklists
  for all using (
    public.is_tenant_member(tenant_id)
    and public.can_view_service_order(service_order_id)
  )
  with check (
    public.is_tenant_member(tenant_id)
    and public.can_view_service_order(service_order_id)
  );

create policy "service_order_quotes_select" on public.service_order_quotes
  for select using (public.can_view_service_order(service_order_id));
create policy "service_order_quotes_insert" on public.service_order_quotes
  for insert with check (
    public.is_tenant_member(tenant_id)
    and public.can_view_service_order(service_order_id)
  );
create policy "service_order_quotes_manage" on public.service_order_quotes
  for update using (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente','atendente']::public.member_role[]
    )
  )
  with check (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente','atendente']::public.member_role[]
    )
  );

create policy "service_order_schedule_history_select" on public.service_order_schedule_history
  for select using (public.can_view_service_order(service_order_id));
create policy "service_order_schedule_history_insert" on public.service_order_schedule_history
  for insert with check (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente','atendente']::public.member_role[]
    )
  );

create policy "payment_method_rates_manage" on public.payment_method_rates
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  );

create policy "financial_adjustments_select" on public.financial_adjustment_requests
  for select using (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente']::public.member_role[]
    )
  );
create policy "financial_adjustments_insert" on public.financial_adjustment_requests
  for insert with check (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente']::public.member_role[]
    )
  );
create policy "financial_adjustments_owner_update" on public.financial_adjustment_requests
  for update using (
    public.has_tenant_role(tenant_id, array['owner']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner']::public.member_role[])
  );

insert into public.payment_method_rates (tenant_id, name, fee_percent)
select t.id, methods.name, 0
from public.tenants t
cross join (
  values ('Dinheiro'), ('PIX'), ('Boleto'), ('Débito'), ('Crédito 1x')
) as methods(name)
where t.field_service_enabled
on conflict (tenant_id, name) do nothing;
