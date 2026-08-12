-- A pagina de Leads buscava TODOS os leads do tenant (paginado em lotes de
-- 1000, sequencial) so pra somar/agrupar em JS - com tenants de milhares de
-- leads isso vira varios round-trips sequenciais a cada clique em qualquer
-- filtro (Entrada, Etapa), sentido como "trava"/"recarrega a pagina".
-- Agrega no banco numa query so: poucas linhas (etapas x 6 faixas de
-- estrela), nao milhares.
create or replace function public.lead_qualification_summary(
  p_tenant_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_stage_ids uuid[] default null
)
returns table (
  stage_id uuid,
  quality_stars int,
  lead_count bigint,
  value_cents_sum bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.stage_id,
    least(5, greatest(0, coalesce(l.quality_stars, 0))) as quality_stars,
    count(*) as lead_count,
    coalesce(sum(l.value_cents), 0) as value_cents_sum
  from leads l
  where l.tenant_id = p_tenant_id
    and (p_from is null or l.created_at >= p_from)
    and (p_to is null or l.created_at <= p_to)
    and (p_stage_ids is null or array_length(p_stage_ids, 1) is null or l.stage_id = any(p_stage_ids))
  group by l.stage_id, least(5, greatest(0, coalesce(l.quality_stars, 0)));
$$;

grant execute on function public.lead_qualification_summary(uuid, timestamptz, timestamptz, uuid[]) to authenticated, service_role;
