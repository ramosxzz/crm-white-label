-- Trigger enforce_service_order_status_permissions bloqueava QUALQUER
-- nao-office de mudar status pra 'agendada', mesmo sendo a consultora dona
-- da propria OS - contradizia o que scheduleServiceOrder ja documentava e
-- permitia na aplicacao ("vendedora marca o horario da OS que ela mesma
-- abriu"). Resultado: toda OS criada por vendedora ficava presa em
-- "rascunho"/sem data (aparecia em "Remarcar"), com erro generico no
-- cliente - bug silencioso, reproduzido e confirmado direto no banco.
create or replace function public.enforce_service_order_status_permissions()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_is_office boolean;
  v_is_finance boolean;
  v_is_reviewer boolean;
  v_is_field_actor boolean;
  v_is_reopening boolean;
  -- Vendedora agenda a OS que ela mesma abriu (fecha a venda com o cliente
  -- na linha) - so essa transicao especifica (rascunho -> agendada, sendo a
  -- consultora da OS). Remarcar/cancelar depois continua so com o
  -- escritorio, igual documentado em scheduleServiceOrder.
  v_is_own_initial_scheduling boolean;
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

  v_is_own_initial_scheduling :=
    old.status = 'rascunho' and new.status = 'agendada' and old.consultant_id = v_user;

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
        and not v_is_office
        and not v_is_own_initial_scheduling then
    raise exception 'Essa alteracao de agenda/status e feita pelo escritorio';
  elsif new.status in ('em_execucao','concluida','assistencia')
        and not v_is_field_actor then
    raise exception 'Somente tecnico alocado ou gestao pode fechar esta OS';
  end if;

  return new;
end;
$function$;
