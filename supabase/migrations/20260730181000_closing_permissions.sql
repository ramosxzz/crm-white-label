-- Defesa em profundidade para o fechamento da OS. As Server Actions ja
-- validam papeis, mas as mesmas regras precisam existir no banco porque as
-- tabelas e RPCs tambem podem ser chamadas pela Data API.

-- Funcoes novas nascem executaveis por PUBLIC no Postgres. RLS impediria a
-- leitura, mas o contrato correto e nem expor a chamada a anon.
revoke all on function public.close_service_order(uuid, uuid, text, jsonb, text, text)
  from public;
revoke all on function public.convert_service_order_quote(uuid, uuid)
  from public;
revoke all on function public.approve_financial_adjustment(uuid, uuid)
  from public;

grant execute on function public.close_service_order(uuid, uuid, text, jsonb, text, text)
  to authenticated, service_role;
grant execute on function public.convert_service_order_quote(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.approve_financial_adjustment(uuid, uuid)
  to authenticated, service_role;

-- Impede que uma chamada direta ao REST/RPC burle os mesmos cortes da
-- aplicacao ao trocar status.
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
  -- Operacoes internas com service_role/console nao carregam JWT. RLS e as
  -- Server Actions seguem cobrindo as chamadas normais.
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
    or (old.status = 'conferida' and new.status = 'concluida')
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

drop trigger if exists service_orders_status_permissions on public.service_orders;
create trigger service_orders_status_permissions
  before update of status on public.service_orders
  for each row execute function public.enforce_service_order_status_permissions();

-- Garante integridade do autor do laudo/orcamento mesmo que alguem chame a
-- RPC manualmente passando o UUID de outra pessoa.
create or replace function public.enforce_service_order_audit_actor()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor_text text;
begin
  if auth.uid() is null then
    return new;
  end if;

  v_actor_text := case tg_table_name
    when 'service_order_checklists' then to_jsonb(new) ->> 'completed_by'
    when 'service_order_quotes' then to_jsonb(new) ->> 'created_by'
    when 'service_order_schedule_history' then to_jsonb(new) ->> 'changed_by'
    when 'financial_adjustment_requests' then to_jsonb(new) ->> 'requested_by'
    when 'service_orders' then
      case when (to_jsonb(new) ->> 'origin_service_order_id') is not null
        then to_jsonb(new) ->> 'created_by'
        else null
      end
    else null
  end;

  if v_actor_text is not null and v_actor_text::uuid is distinct from auth.uid() then
    raise exception 'Autor da alteracao nao corresponde ao usuario autenticado';
  end if;
  return new;
end;
$$;

drop trigger if exists service_order_checklists_audit_actor on public.service_order_checklists;
create trigger service_order_checklists_audit_actor
  before insert or update on public.service_order_checklists
  for each row execute function public.enforce_service_order_audit_actor();

drop trigger if exists service_order_quotes_audit_actor on public.service_order_quotes;
create trigger service_order_quotes_audit_actor
  before insert on public.service_order_quotes
  for each row execute function public.enforce_service_order_audit_actor();

drop trigger if exists service_order_schedule_history_audit_actor
  on public.service_order_schedule_history;
create trigger service_order_schedule_history_audit_actor
  before insert on public.service_order_schedule_history
  for each row execute function public.enforce_service_order_audit_actor();

drop trigger if exists financial_adjustment_requests_audit_actor
  on public.financial_adjustment_requests;
create trigger financial_adjustment_requests_audit_actor
  before insert on public.financial_adjustment_requests
  for each row execute function public.enforce_service_order_audit_actor();

drop trigger if exists service_orders_origin_audit_actor on public.service_orders;
create trigger service_orders_origin_audit_actor
  before insert on public.service_orders
  for each row execute function public.enforce_service_order_audit_actor();

-- Laudo e novo orcamento em campo: somente tecnico alocado ou gestao. A
-- policy anterior usava apenas can_view e tambem deixava a vendedora editar.
drop policy if exists "service_order_checklists_write"
  on public.service_order_checklists;
create policy "service_order_checklists_insert" on public.service_order_checklists
  for insert to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_role(
        tenant_id,
        array['owner','admin','gerente']::public.member_role[]
      )
      or public.is_service_order_technician(service_order_id, auth.uid())
    )
  );
create policy "service_order_checklists_update" on public.service_order_checklists
  for update to authenticated
  using (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente']::public.member_role[]
    )
    or public.is_service_order_technician(service_order_id, auth.uid())
  )
  with check (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_role(
        tenant_id,
        array['owner','admin','gerente']::public.member_role[]
      )
      or public.is_service_order_technician(service_order_id, auth.uid())
    )
  );

drop policy if exists "service_order_quotes_insert" on public.service_order_quotes;
create policy "service_order_quotes_insert" on public.service_order_quotes
  for insert to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_role(
        tenant_id,
        array['owner','admin','gerente']::public.member_role[]
      )
      or public.is_service_order_technician(service_order_id, auth.uid())
    )
  );
