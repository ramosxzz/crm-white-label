-- Remove execucao anonima de helpers SECURITY DEFINER e restringe tabelas
-- internas da API ao backend com service role.
revoke execute on function public.has_tenant_role(uuid, public.member_role[]) from public, anon;
revoke execute on function public.is_tenant_member(uuid) from public, anon;
revoke execute on function public.user_tenant_ids() from public, anon;
revoke execute on function public.lead_qualification_summary(uuid, timestamptz, timestamptz, uuid[]) from public, anon;
revoke execute on function public.notify_new_lead() from public, anon, authenticated;
revoke execute on function public.seed_megas_perini_defaults(uuid) from public, anon, authenticated;

grant execute on function public.has_tenant_role(uuid, public.member_role[]) to authenticated, service_role;
grant execute on function public.is_tenant_member(uuid) to authenticated, service_role;
grant execute on function public.user_tenant_ids() to authenticated, service_role;
grant execute on function public.lead_qualification_summary(uuid, timestamptz, timestamptz, uuid[]) to authenticated, service_role;
grant execute on function public.notify_new_lead() to service_role;
grant execute on function public.seed_megas_perini_defaults(uuid) to service_role;

revoke all on table public.api_keys from anon, authenticated;
revoke all on table public.api_webhooks from anon, authenticated;
revoke all on table public.api_webhook_deliveries from anon, authenticated;
grant all on table public.api_keys to service_role;
grant all on table public.api_webhooks to service_role;
grant all on table public.api_webhook_deliveries to service_role;
