-- Admin pediu pra poder editar o valor de cada comissao (tecnico, vendedora,
-- loja/vendedor parceiro) direto no modal de faturamento antes de confirmar,
-- nao so ver o preview. p_overrides opcional: quando vier preenchido, usa
-- esses valores em vez de recalcular - sem overrides o comportamento e
-- identico ao de sempre (nenhuma chamada existente quebra).
create or replace function public.bill_service_order(
  p_service_order_id uuid,
  p_user_id uuid,
  p_overrides jsonb default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.service_orders%rowtype;
  v_row record;
  v_override record;
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

  if p_overrides is not null then
    for v_override in select * from jsonb_to_recordset(p_overrides) as x(
      party_kind text, user_id uuid, partner_id uuid, partner_name text,
      partner_store text, base_cents bigint, percent numeric, amount_cents bigint
    ) loop
      if v_override.amount_cents > 0 then
        insert into public.commissions (
          tenant_id, service_order_id, party_kind, user_id, partner_id, partner_name,
          partner_store, base_cents, percent, amount_cents, status
        )
        values (
          v_order.tenant_id, v_order.id, v_override.party_kind, v_override.user_id,
          v_override.partner_id, v_override.partner_name, v_override.partner_store,
          v_override.base_cents, v_override.percent, v_override.amount_cents, 'prevista'
        )
        on conflict do nothing;
      end if;
    end loop;
  else
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
  end if;

  update public.service_orders
  set status = 'faturada', updated_at = now()
  where id = v_order.id;

  insert into public.service_order_events (
    tenant_id, service_order_id, from_status, to_status, user_id, reason
  )
  values (
    v_order.tenant_id, v_order.id, 'conferida', 'faturada', p_user_id,
    case when p_overrides is not null then 'Faturamento gerado com comissao ajustada manualmente' else 'Faturamento gerado automaticamente' end
  );
end;
$$;

revoke all on function public.bill_service_order(uuid, uuid, jsonb) from public;
grant execute on function public.bill_service_order(uuid, uuid, jsonb)
  to authenticated, service_role;
