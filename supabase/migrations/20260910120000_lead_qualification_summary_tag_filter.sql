-- A /leads filtra por tag so na query da tabela (.contains("tags",[tag])) -
-- o RPC usado pros cards/rodape/paginacao (lead_qualification_summary)
-- nao recebia a tag, entao com filtro de tag ativo os numeros do topo
-- mostravam o total de TODOS os leads do periodo, ignorando a tag
-- selecionada. p_tag default null preserva todo chamador existente.

create or replace function public.lead_qualification_summary(
  p_tenant_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_stage_ids uuid[] default null,
  p_tag text default null
)
returns table(stage_id uuid, quality_stars integer, lead_count bigint, value_cents_sum bigint)
language sql
stable
security definer
set search_path = 'public'
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
    and (p_tag is null or l.tags @> array[p_tag])
    and private.can_access_lead(l.tenant_id, l.id)
  group by l.stage_id, least(5, greatest(0, coalesce(l.quality_stars, 0)));
$$;
