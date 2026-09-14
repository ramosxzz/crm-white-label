-- Enquanto a OS estiver aberta, o valor previsto e o proprio total aprovado
-- (itens + deslocamento). O administrativo nao precisa manter dois valores
-- manualmente, e mudancas feitas pelo tecnico em campo aparecem no acerto.
create or replace function public.recalc_service_order_total()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  target_order uuid := coalesce(new.service_order_id, old.service_order_id);
  target_type text;
  target_status text;
  new_total bigint;
begin
  select service_type, status
    into target_type, target_status
  from public.service_orders
  where id = target_order;

  new_total := case
    when target_type = 'assistencia' then 0
    else coalesce((
      select sum(amount_cents)
      from public.service_order_items
      where service_order_id = target_order
        and approved
        and discount_status not in ('solicitado', 'recusado')
    ), 0) + coalesce((
      select travel_fee_cents from public.service_orders where id = target_order
    ), 0)
  end;

  update public.service_orders
  set total_cents = new_total,
      expected_receipt_cents = case
        when target_status = 'faturada' then expected_receipt_cents
        else new_total
      end,
      updated_at = now()
  where id = target_order;
  return null;
end;
$function$;

create or replace function public.recalc_service_order_total_from_order()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  new_total bigint;
begin
  if new.travel_fee_cents is distinct from old.travel_fee_cents
     or new.service_type is distinct from old.service_type then
    new_total := case
      when new.service_type = 'assistencia' then 0
      else coalesce((
        select sum(amount_cents)
        from public.service_order_items
        where service_order_id = new.id
          and approved
          and discount_status not in ('solicitado', 'recusado')
      ), 0) + new.travel_fee_cents
    end;

    update public.service_orders
    set total_cents = new_total,
        expected_receipt_cents = case
          when new.status = 'faturada' then expected_receipt_cents
          else new_total
        end,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$function$;

-- Corrige as OS abertas do ACT que ja ficaram divergentes antes desta regra.
update public.service_orders
set expected_receipt_cents = total_cents,
    updated_at = now()
where tenant_id = '54a6a18e-27f1-45c4-993b-42707a9f150b'
  and status <> 'faturada'
  and expected_receipt_cents is distinct from total_cents;
