-- Invoker RPCs: somente o servidor (service_role) pode executar.
-- A linha do cursor serializa execucoes concorrentes do mesmo bloco.
create or replace function public.assign_automation_lead_round_robin(
  p_tenant_id uuid, p_flow_id uuid, p_block_id text, p_lead_id uuid,
  p_user_ids uuid[]
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_index integer;
  v_user uuid;
begin
  if cardinality(p_user_ids) is null or cardinality(p_user_ids) = 0
     or cardinality(p_user_ids) > 500 or nullif(trim(p_block_id), '') is null then
    raise exception 'Lista de responsaveis ou bloco invalido';
  end if;
  if not exists (select 1 from automation_flows where id=p_flow_id and tenant_id=p_tenant_id)
     or not exists (select 1 from leads where id=p_lead_id and tenant_id=p_tenant_id) then
    raise exception 'Fluxo ou lead nao pertence a empresa';
  end if;
  if exists (
    select 1 from unnest(p_user_ids) u(id)
    where not exists (select 1 from tenant_members m where m.tenant_id=p_tenant_id and m.user_id=u.id)
  ) then
    raise exception 'Responsavel nao pertence a empresa';
  end if;
  insert into automation_round_robin_cursors(flow_id,block_id,last_index)
    values(p_flow_id,p_block_id,-1) on conflict(flow_id,block_id) do nothing;
  select last_index into v_index from automation_round_robin_cursors
    where flow_id=p_flow_id and block_id=p_block_id for update;
  v_index := (v_index+1) % cardinality(p_user_ids);
  v_user := p_user_ids[v_index+1];
  update leads set assigned_to=v_user where id=p_lead_id and tenant_id=p_tenant_id;
  if not found then raise exception 'Lead nao encontrado'; end if;
  update automation_round_robin_cursors set last_index=v_index,updated_at=now()
    where flow_id=p_flow_id and block_id=p_block_id;
  return jsonb_build_object('assigned_to',v_user,'round_robin_index',v_index);
end;
$$;
revoke all on function public.assign_automation_lead_round_robin(uuid,uuid,text,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.assign_automation_lead_round_robin(uuid,uuid,text,uuid,uuid[]) to service_role;

create or replace function public.submit_satisfaction_survey_atomic(
  p_slug text, p_nps_score integer, p_comments text, p_ratings jsonb
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_form satisfaction_survey_forms%rowtype;
  v_response uuid;
begin
  select * into v_form from satisfaction_survey_forms where slug=p_slug and is_active for share;
  if not found then raise exception 'Formulario nao encontrado ou desativado'; end if;
  if p_nps_score is null or p_nps_score not between 0 and 10
     or length(coalesce(p_comments,''))>4000 or p_ratings is null
     or jsonb_typeof(p_ratings)<>'array' then
    raise exception 'Dados invalidos';
  end if;
  if jsonb_array_length(p_ratings) not between 1 and 100 then raise exception 'Quantidade de notas invalida'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_ratings) r
    where jsonb_typeof(r)<>'object' or r->>'employee_name' is null
      or not (v_form.employees @> jsonb_build_array(r->>'employee_name'))
      or coalesce(r->>'service_rating','') !~ '^[1-5]$'
  ) then raise exception 'Funcionaria ou nota invalida'; end if;
  if (select count(distinct r->>'employee_name') from jsonb_array_elements(p_ratings) r)
      <> jsonb_array_length(p_ratings) then raise exception 'Funcionaria repetida'; end if;
  insert into satisfaction_survey_responses(tenant_id,nps_score,comments,channel)
    values(v_form.tenant_id,p_nps_score,nullif(trim(p_comments),''),p_slug)
    returning id into v_response;
  insert into satisfaction_survey_employee_ratings(response_id,tenant_id,employee_name,service_rating)
    select v_response,v_form.tenant_id,r->>'employee_name',(r->>'service_rating')::smallint
    from jsonb_array_elements(p_ratings) r;
  return v_response;
end;
$$;
revoke all on function public.submit_satisfaction_survey_atomic(text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_satisfaction_survey_atomic(text,integer,text,jsonb) to service_role;
