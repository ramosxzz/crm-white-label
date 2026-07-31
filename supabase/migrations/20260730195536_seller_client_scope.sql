create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.can_access_lead(
  p_tenant_id uuid,
  p_lead_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and (
        not t.lead_assignment_enabled
        or tm.role in (
          'owner'::public.member_role,
          'admin'::public.member_role,
          'gerente'::public.member_role,
          'atendente'::public.member_role
        )
        or exists (
          select 1
          from public.leads l
          where l.tenant_id = p_tenant_id
            and l.id = p_lead_id
            and (
              l.assigned_to = auth.uid()
              or exists (
                select 1
                from public.conversations c
                join public.whatsapp_accounts wa
                  on wa.id = c.whatsapp_account_id
                 and wa.tenant_id = c.tenant_id
                where c.tenant_id = l.tenant_id
                  and c.lead_id = l.id
                  and wa.assigned_to = auth.uid()
              )
            )
        )
      )
  );
$$;

revoke all on function private.can_access_lead(uuid, uuid) from public;
grant execute on function private.can_access_lead(uuid, uuid)
  to authenticated, service_role;

drop policy if exists leads_tenant_select on public.leads;
create policy leads_tenant_select on public.leads
  for select
  using (private.can_access_lead(tenant_id, id));

drop policy if exists leads_tenant_insert on public.leads;
create policy leads_tenant_insert on public.leads
  for insert
  with check (
    public.is_tenant_member(tenant_id)
    and (
      not exists (
        select 1
        from public.tenants t
        where t.id = leads.tenant_id
          and t.lead_assignment_enabled
      )
      or public.has_tenant_role(
        tenant_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'gerente'::public.member_role,
          'atendente'::public.member_role
        ]
      )
      or assigned_to = auth.uid()
    )
  );

drop policy if exists leads_tenant_update on public.leads;
create policy leads_tenant_update on public.leads
  for update
  using (private.can_access_lead(tenant_id, id))
  with check (private.can_access_lead(tenant_id, id));

drop policy if exists appointments_tenant_select on public.appointments;
create policy appointments_tenant_select on public.appointments
  for select
  using (private.can_access_lead(tenant_id, lead_id));

drop policy if exists appointments_tenant_insert on public.appointments;
create policy appointments_tenant_insert on public.appointments
  for insert
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists appointments_tenant_update on public.appointments;
create policy appointments_tenant_update on public.appointments
  for update
  using (private.can_access_lead(tenant_id, lead_id))
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists tasks_tenant_select on public.tasks;
create policy tasks_tenant_select on public.tasks
  for select
  using (private.can_access_lead(tenant_id, lead_id));

drop policy if exists tasks_tenant_insert on public.tasks;
create policy tasks_tenant_insert on public.tasks
  for insert
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists tasks_tenant_update on public.tasks;
create policy tasks_tenant_update on public.tasks
  for update
  using (private.can_access_lead(tenant_id, lead_id))
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists "tenant members manage scheduled"
  on public.scheduled_messages;
drop policy if exists "tenant members read scheduled"
  on public.scheduled_messages;
create policy scheduled_messages_client_scope on public.scheduled_messages
  for all
  using (private.can_access_lead(tenant_id, lead_id))
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists files_tenant_select on public.files;
create policy files_tenant_select on public.files
  for select
  using (private.can_access_lead(tenant_id, lead_id));

drop policy if exists files_tenant_insert on public.files;
create policy files_tenant_insert on public.files
  for insert
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists files_tenant_update on public.files;
create policy files_tenant_update on public.files
  for update
  using (private.can_access_lead(tenant_id, lead_id))
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists lead_activities_tenant_select
  on public.lead_activities;
create policy lead_activities_tenant_select on public.lead_activities
  for select
  using (private.can_access_lead(tenant_id, lead_id));

drop policy if exists lead_activities_tenant_insert
  on public.lead_activities;
create policy lead_activities_tenant_insert on public.lead_activities
  for insert
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists lead_activities_tenant_update
  on public.lead_activities;
create policy lead_activities_tenant_update on public.lead_activities
  for update
  using (private.can_access_lead(tenant_id, lead_id))
  with check (private.can_access_lead(tenant_id, lead_id));

drop policy if exists lead_value_items_all on public.lead_value_items;
create policy lead_value_items_client_scope on public.lead_value_items
  for all
  using (private.can_access_lead(tenant_id, lead_id))
  with check (private.can_access_lead(tenant_id, lead_id));
