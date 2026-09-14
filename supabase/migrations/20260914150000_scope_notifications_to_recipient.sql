-- notifications.user_id marca o destinatario ("novo lead atribuido a voce"),
-- mas a policy so checava o tenant: qualquer vendedor lia (e marcava como
-- lida) notificacao de lead atribuido a outro colega, vazando o nome do
-- lead alheio. A aplicacao ja filtra isso nas queries (topbar.tsx,
-- _actions/notifications.ts com .or(user_id.is.null,user_id.eq.<uid>)), mas
-- isso e defesa so no app - RLS e quem tem que barrar de verdade, senao uma
-- chamada supabase-js direta do browser (mesma sessao, sem passar pelo
-- server action) le a caixa inteira do tenant.
drop policy if exists notifications_tenant_select on public.notifications;
create policy notifications_tenant_select on public.notifications
  for select to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and (user_id is null or user_id = (select auth.uid()))
  );

drop policy if exists notifications_tenant_update on public.notifications;
create policy notifications_tenant_update on public.notifications
  for update to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and (user_id is null or user_id = (select auth.uid()))
  )
  with check (
    private.is_tenant_member(tenant_id)
    and (user_id is null or user_id = (select auth.uid()))
  );
