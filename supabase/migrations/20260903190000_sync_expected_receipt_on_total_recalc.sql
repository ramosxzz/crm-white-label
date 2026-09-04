-- Os dois triggers que recalculam total_cents (peca aprovada/removida, e
-- deslocamento/tipo de servico) so mexiam em total_cents - "Previsto"
-- (expected_receipt_cents) ficava parado no valor antigo, mostrando "A
-- receber" errado sempre que o total mudava depois da OS criada.
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
      -- "Previsto" acompanha o total automaticamente enquanto ninguem
      -- customizou ele manualmente (acerto com valor negociado diferente
      -- do total das pecas) - so nao mexe se ja tiver divergido.
      expected_receipt_cents = case
        when old_expected is null or old_expected = old_total then new_total
        else old_expected
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
