-- Avisos com destinatario continuam privados. Avisos gerais (user_id null)
-- sao operacionais e pertencem apenas a gestao; vendedor deve receber somente
-- o que foi explicitamente atribuido a ele.
drop policy if exists notifications_tenant_select on public.notifications;
create policy notifications_tenant_select on public.notifications
  for select to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and (
      user_id = (select auth.uid())
      or (
        user_id is null
        and private.has_tenant_role(
          tenant_id,
          array['owner', 'admin', 'gerente', 'atendente']::public.member_role[]
        )
      )
    )
  );

drop policy if exists notifications_tenant_update on public.notifications;
create policy notifications_tenant_update on public.notifications
  for update to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and (
      user_id = (select auth.uid())
      or (
        user_id is null
        and private.has_tenant_role(
          tenant_id,
          array['owner', 'admin', 'gerente', 'atendente']::public.member_role[]
        )
      )
    )
  )
  with check (
    private.is_tenant_member(tenant_id)
    and (
      user_id = (select auth.uid())
      or (
        user_id is null
        and private.has_tenant_role(
          tenant_id,
          array['owner', 'admin', 'gerente', 'atendente']::public.member_role[]
        )
      )
    )
  );
