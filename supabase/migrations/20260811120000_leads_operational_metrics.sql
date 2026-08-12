create or replace function public.leads_operational_metrics(
  p_tenant_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_stage_ids uuid[] default null
)
returns table (
  total_leads bigint,
  total_value_cents bigint,
  rated_leads bigint,
  stars_sum bigint,
  stars_0 bigint,
  stars_1 bigint,
  stars_2 bigint,
  stars_3 bigint,
  stars_4 bigint,
  stars_5 bigint,
  responded_conversations bigint,
  avg_first_response_seconds numeric,
  stage_counts jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with lead_scope as (
    select l.id, l.stage_id, l.value_cents, l.quality_stars
    from public.leads l
    where l.tenant_id = p_tenant_id
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at <= p_to)
      and (p_stage_ids is null or l.stage_id = any(p_stage_ids))
  ),
  totals as (
    select
      count(*)::bigint as total_leads,
      coalesce(sum(value_cents), 0)::bigint as total_value_cents,
      count(*) filter (where quality_stars between 1 and 5)::bigint as rated_leads,
      coalesce(sum(quality_stars) filter (where quality_stars between 1 and 5), 0)::bigint as stars_sum,
      count(*) filter (where coalesce(quality_stars, 0) = 0)::bigint as stars_0,
      count(*) filter (where quality_stars = 1)::bigint as stars_1,
      count(*) filter (where quality_stars = 2)::bigint as stars_2,
      count(*) filter (where quality_stars = 3)::bigint as stars_3,
      count(*) filter (where quality_stars = 4)::bigint as stars_4,
      count(*) filter (where quality_stars = 5)::bigint as stars_5
    from lead_scope
  ),
  stages as (
    select coalesce(
      jsonb_agg(jsonb_build_object('stage_id', grouped.stage_id, 'count', grouped.lead_count)),
      '[]'::jsonb
    ) as stage_counts
    from (
      select stage_id, count(*)::bigint as lead_count
      from lead_scope
      group by stage_id
    ) grouped
  ),
  first_inbound as (
    select c.id as conversation_id, min(m.created_at) as received_at
    from public.conversations c
    join lead_scope l on l.id = c.lead_id
    join public.messages m on m.conversation_id = c.id
    where c.tenant_id = p_tenant_id and m.tenant_id = p_tenant_id and m.direction = 'inbound'
    group by c.id
  ),
  first_responses as (
    select i.conversation_id, min(m.created_at) as responded_at, i.received_at
    from first_inbound i
    join public.messages m on m.conversation_id = i.conversation_id
      and m.tenant_id = p_tenant_id
      and m.direction = 'outbound'
      and m.created_at >= i.received_at
    group by i.conversation_id, i.received_at
  ),
  response_summary as (
    select
      count(*)::bigint as responded_conversations,
      coalesce(avg(extract(epoch from (responded_at - received_at))), 0)::numeric as avg_seconds
    from first_responses
  )
  select
    t.total_leads, t.total_value_cents, t.rated_leads, t.stars_sum,
    t.stars_0, t.stars_1, t.stars_2, t.stars_3, t.stars_4, t.stars_5,
    r.responded_conversations, r.avg_seconds, s.stage_counts
  from totals t cross join response_summary r cross join stages s;
$$;

grant execute on function public.leads_operational_metrics(uuid, timestamptz, timestamptz, uuid[]) to authenticated, service_role;
