
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
          and discount_status not in ('solicitado','recusado')
      ), 0) + new.travel_fee_cents
    end;

    update public.service_orders
    set total_cents = new_total,
        expected_receipt_cents = case
          when old.expected_receipt_cents is null or old.expected_receipt_cents = old.total_cents then new_total
          else old.expected_receipt_cents
        end,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$function$;
