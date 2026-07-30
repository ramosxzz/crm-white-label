-- O advisor apontou funcoes SECURITY DEFINER herdando EXECUTE de PUBLIC.
-- Helpers de RLS continuam executaveis por usuario autenticado, mas deixam
-- de ser endpoints RPC anonimos. Funcoes internas de trigger/seed ficam
-- somente para service_role.

revoke all on function public.user_tenant_ids() from public;
revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.has_tenant_role(uuid, public.member_role[]) from public;
revoke all on function public.is_service_order_technician(uuid, uuid) from public;
revoke all on function public.can_view_service_order(uuid) from public;

grant execute on function public.user_tenant_ids()
  to authenticated, service_role;
grant execute on function public.is_tenant_member(uuid)
  to authenticated, service_role;
grant execute on function public.has_tenant_role(uuid, public.member_role[])
  to authenticated, service_role;
grant execute on function public.is_service_order_technician(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.can_view_service_order(uuid)
  to authenticated, service_role;

revoke all on function public.notify_new_lead() from public;
revoke all on function public.seed_megas_perini_defaults(uuid) from public;
grant execute on function public.notify_new_lead() to service_role;
grant execute on function public.seed_megas_perini_defaults(uuid) to service_role;
