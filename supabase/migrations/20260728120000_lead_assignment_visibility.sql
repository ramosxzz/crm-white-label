-- Restringe visibilidade de leads por vendedor, atras de flag por tenant.
-- Quando lead_assignment_enabled=true no tenant: vendedor so ve leads com
-- assigned_to = ele mesmo. Owner/admin/gerente/atendente continuam vendo
-- tudo (podem atribuir). Quando a flag esta off (padrao, tenants existentes),
-- comportamento nao muda: todo mundo ve todos os leads, como sempre foi.

alter table tenants
  add column if not exists lead_assignment_enabled boolean not null default false;

drop policy if exists leads_tenant_select on leads;
create policy leads_tenant_select on leads
  for select
  using (
    is_tenant_member(tenant_id)
    and (
      not exists (
        select 1 from tenants t
        where t.id = leads.tenant_id and t.lead_assignment_enabled
      )
      or has_tenant_role(tenant_id, array['owner', 'admin', 'gerente', 'atendente']::member_role[])
      or assigned_to = auth.uid()
    )
  );

drop policy if exists leads_tenant_update on leads;
create policy leads_tenant_update on leads
  for update
  using (
    is_tenant_member(tenant_id)
    and (
      not exists (
        select 1 from tenants t
        where t.id = leads.tenant_id and t.lead_assignment_enabled
      )
      or has_tenant_role(tenant_id, array['owner', 'admin', 'gerente', 'atendente']::member_role[])
      or assigned_to = auth.uid()
    )
  )
  with check (is_tenant_member(tenant_id));

-- Ativa para o tenant que pediu (ACT / Demoact).
update tenants set lead_assignment_enabled = true where id = '54a6a18e-27f1-45c4-993b-42707a9f150b';
