-- Fase 4 do ERP de campo: valor de tabela, desconto aprovado pela gerencia
-- e deslocamento cobrado na OS. O total continua sendo calculado no banco,
-- para que uma tela antiga ou chamada direta nao consiga faturar um desconto
-- ainda pendente.

alter table public.service_orders
  add column if not exists travel_fee_cents bigint not null default 0
    check (travel_fee_cents >= 0);

comment on column public.service_orders.travel_fee_cents is
  'Valor de deslocamento cobrado nesta OS, em centavos.';

alter table public.service_order_items
  add column if not exists table_price_cents bigint,
  add column if not exists discount_status text not null default 'nao_aplicavel'
    check (discount_status in ('nao_aplicavel','solicitado','aprovado','recusado')),
  add column if not exists discount_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists discount_requested_at timestamptz,
  add column if not exists discount_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists discount_reviewed_at timestamptz,
  add column if not exists discount_reason text;

alter table public.service_order_items
  add constraint service_order_items_table_price_nonnegative
  check (table_price_cents is null or table_price_cents >= 0);

comment on column public.service_order_items.table_price_cents is
  'Preco de tabela informado na venda. Valor negociado abaixo dele exige aprovacao.';

-- Um item em desconto solicitado/recusado nao entra no valor final. Upsell
-- continua obedecendo sua propria aprovacao, sem ser confundido com desconto.
create or replace function public.recalc_service_order_total()
returns trigger language plpgsql as $$
declare target_order uuid := coalesce(new.service_order_id, old.service_order_id);
begin
  update public.service_orders
  set total_cents = coalesce((
        select sum(amount_cents)
        from public.service_order_items
        where service_order_id = target_order
          and approved
          and discount_status not in ('solicitado','recusado')
      ), 0) + coalesce((
        select travel_fee_cents from public.service_orders where id = target_order
      ), 0),
      updated_at = now()
  where id = target_order;
  return null;
end; $$;

-- Alterar o deslocamento tambem recalcula o total final.
create or replace function public.recalc_service_order_total_from_order()
returns trigger language plpgsql as $$
begin
  if new.travel_fee_cents is distinct from old.travel_fee_cents then
    update public.service_orders
    set total_cents = coalesce((
          select sum(amount_cents)
          from public.service_order_items
          where service_order_id = new.id
            and approved
            and discount_status not in ('solicitado','recusado')
        ), 0) + new.travel_fee_cents,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists service_orders_recalc_total_on_travel_fee on public.service_orders;
create trigger service_orders_recalc_total_on_travel_fee
  after update of travel_fee_cents on public.service_orders
  for each row execute function public.recalc_service_order_total_from_order();
