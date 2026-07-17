create or replace function public.dashboard_stage_counts(p_tenant_id uuid)
returns table(stage_id uuid, lead_count bigint)
language sql
stable
set search_path = public
as $$
  select l.stage_id, count(*)::bigint as lead_count
  from public.leads l
  where l.tenant_id = p_tenant_id
  group by l.stage_id
$$;

grant execute on function public.dashboard_stage_counts(uuid) to authenticated, service_role;
