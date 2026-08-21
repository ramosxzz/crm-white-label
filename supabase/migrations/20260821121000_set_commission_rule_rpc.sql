-- commission_rules agora tem 2 indices unicos parciais (padrao do tenant vs
-- override por vendedora) em vez de 1 constraint simples - o upsert do
-- PostgREST/Supabase JS nao sabe mirar num indice parcial via onConflict de
-- coluna. Function resolve o conflito certo direto no servidor.
create or replace function public.set_commission_rule(
  p_tenant_id uuid,
  p_party_kind text,
  p_user_id uuid,
  p_percent numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_user_id is null then
    insert into public.commission_rules (tenant_id, party_kind, user_id, percent, updated_at)
    values (p_tenant_id, p_party_kind, null, p_percent, now())
    on conflict (tenant_id, party_kind) where user_id is null
    do update set percent = excluded.percent, updated_at = now();
  else
    insert into public.commission_rules (tenant_id, party_kind, user_id, percent, updated_at)
    values (p_tenant_id, p_party_kind, p_user_id, p_percent, now())
    on conflict (tenant_id, party_kind, user_id) where user_id is not null
    do update set percent = excluded.percent, updated_at = now();
  end if;
end;
$$;

revoke all on function public.set_commission_rule(uuid, text, uuid, numeric) from public;
grant execute on function public.set_commission_rule(uuid, text, uuid, numeric) to authenticated, service_role;
