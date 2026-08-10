-- Tarefas soltas: atribuir trabalho a uma pessoa sem que exista um cliente
-- envolvido ("subir os anuncios do cliente X" e do time, nao de um lead).
--
-- A tabela `tasks` ja aceitava lead_id nulo, mas as policies mandavam tudo pra
-- private.can_access_lead(tenant_id, lead_id). Com lead_id nulo essa funcao so
-- devolve true para owner/admin/gerente/atendente OU quando o tenant nao usa
-- atribuicao de leads. Ou seja: num tenant com atribuicao ligada (ACT, Vasos
-- Fortuna) um vendedor NAO enxergaria a tarefa atribuida a ele proprio - a
-- notificacao chegaria e a tarefa nao apareceria.
--
-- Aqui a visibilidade passa a depender do que a tarefa e: tarefa de lead segue
-- a regra do lead; tarefa solta pertence a quem faz, a quem pediu e a gestao.

create or replace function private.can_access_task(
  p_tenant_id uuid,
  p_lead_id uuid,
  p_assigned_to uuid,
  p_created_by uuid
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_lead_id is not null then private.can_access_lead(p_tenant_id, p_lead_id)
    else (
      p_assigned_to = auth.uid()
      or p_created_by = auth.uid()
      or public.has_tenant_role(
           p_tenant_id,
           array['owner','admin','gerente']::public.member_role[]
         )
    )
  end;
$$;

revoke all on function private.can_access_task(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function private.can_access_task(uuid, uuid, uuid, uuid) to authenticated;

drop policy if exists "tasks_tenant_select" on public.tasks;
drop policy if exists "tasks_tenant_insert" on public.tasks;
drop policy if exists "tasks_tenant_update" on public.tasks;

create policy "tasks_tenant_select" on public.tasks
  for select using (
    private.can_access_task(tenant_id, lead_id, assigned_to, created_by)
  );

-- Quem cria precisa ser do tenant. Tarefa de lead continua exigindo acesso ao
-- lead, pra ninguem criar tarefa em cliente que nao enxerga.
create policy "tasks_tenant_insert" on public.tasks
  for insert with check (
    case
      when lead_id is not null then private.can_access_lead(tenant_id, lead_id)
      else public.has_tenant_role(
             tenant_id,
             array['owner','admin','gerente','atendente','vendedor','tecnico']::public.member_role[]
           )
    end
  );

-- Concluir a propria tarefa e o caso mais comum, entao o responsavel precisa
-- de update mesmo sem ser gestao.
create policy "tasks_tenant_update" on public.tasks
  for update using (
    private.can_access_task(tenant_id, lead_id, assigned_to, created_by)
  )
  with check (
    private.can_access_task(tenant_id, lead_id, assigned_to, created_by)
  );

create index if not exists tasks_tenant_assigned_status_idx
  on public.tasks (tenant_id, assigned_to, status);
