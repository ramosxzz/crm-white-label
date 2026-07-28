-- Ajustes apontados pelo linter do Supabase logo apos a fase 1 do modulo de
-- servico em campo:
--   * search_path fixo na trigger de recalculo (evita sequestro de search_path);
--   * anon nao precisa executar os helpers de visibilidade da OS - so usuario
--     autenticado e o service_role.

create or replace function public.recalc_service_order_total()
returns trigger language plpgsql
set search_path = public
as $$
declare target_order uuid := coalesce(new.service_order_id, old.service_order_id);
begin
  update public.service_orders
  set total_cents = coalesce((
        select sum(amount_cents)
        from public.service_order_items
        where service_order_id = target_order and approved
      ), 0),
      updated_at = now()
  where id = target_order;
  return null;
end; $$;

revoke execute on function public.is_service_order_technician(uuid, uuid) from anon;
revoke execute on function public.can_view_service_order(uuid) from anon;
