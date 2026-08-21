-- Prospeccao (Jeruza) precisa criar/editar qualquer lead do tenant pra rotear
-- pra pasta de quem for - igual atendente, nao fica restrita a "assigned_to
-- ela mesma" (senao nao consegue nem mandar pra outra pessoa).
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
          'atendente'::public.member_role,
          'prospeccao'::public.member_role
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
          'atendente'::public.member_role,
          'prospeccao'::public.member_role
        ]
      )
      or assigned_to = auth.uid()
    )
  );

-- field_service_partners: prospeccao pesquisa e cadastra parceiro (loja/
-- vendedor externo) igual atendente ja fazia.
drop policy if exists "field_service_partners_select" on public.field_service_partners;
create policy "field_service_partners_select" on public.field_service_partners
  for select using (
    public.is_tenant_member(tenant_id)
    and public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente','atendente','vendedor','prospeccao']::public.member_role[]
    )
  );

drop policy if exists "field_service_partners_write" on public.field_service_partners;
create policy "field_service_partners_write" on public.field_service_partners
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente','prospeccao']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente','prospeccao']::public.member_role[])
  );
