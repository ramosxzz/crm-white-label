
create or replace function public.recalc_service_order_total()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  target_order uuid := coalesce(new.service_order_id, old.service_order_id);
  target_type text;
  new_total bigint;
  old_total bigint;
  old_expected bigint;
begin
  select service_type, total_cents, expected_receipt_cents
    into target_type, old_total, old_expected
  from public.service_orders
  where id = target_order;

  new_total := case
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
  end;

  update public.service_orders
  set total_cents = new_total,
      expected_receipt_cents = case
        when old_expected is null or old_expected = old_total then new_total
        else old_expected
      end,
      updated_at = now()
  where id = target_order;
  return null;
end;
$function$;
