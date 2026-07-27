drop function if exists public.funnel_metrics(uuid, uuid);

create or replace function public.funnel_metrics(
  p_tenant_id uuid,
  p_pipeline_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  stage_id uuid,
  stage_name text,
  stage_color text,
  stage_position int,
  is_won boolean,
  is_lost boolean,
  lead_count bigint,
  value_cents bigint,
  avg_seconds numeric
)
language sql
stable
set search_path = public
as $$
  with stages as (
    select s.id, s.name, s.color, s.position, s.is_won, s.is_lost
    from public.pipeline_stages s
    where s.tenant_id = p_tenant_id
      and (p_pipeline_id is null or s.pipeline_id = p_pipeline_id)
  ),
  lead_scope as (
    select l.id, l.stage_id, l.value_cents, l.created_at
    from public.leads l
    where l.tenant_id = p_tenant_id
      and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at < p_to)
  ),
  agg as (
    select ls.stage_id, count(*)::bigint as lead_count,
           coalesce(sum(ls.value_cents), 0)::bigint as value_cents
    from lead_scope ls
    group by ls.stage_id
  ),
  events as (
    select
      la.lead_id,
      la.created_at,
      la.payload->>'to_stage_name' as to_name,
      lead(la.created_at) over (partition by la.lead_id order by la.created_at) as next_at
    from public.lead_activities la
    join lead_scope ls on ls.id = la.lead_id
    where la.tenant_id = p_tenant_id and la.kind = 'stage_changed'
  ),
  moved_durations as (
    select e.to_name as name,
           extract(epoch from (coalesce(e.next_at, now()) - e.created_at)) as secs
    from events e
    where e.to_name is not null
  ),
  never_moved as (
    select s.name, extract(epoch from (now() - ls.created_at)) as secs
    from lead_scope ls
    join stages s on s.id = ls.stage_id
    where not exists (
      select 1 from public.lead_activities la
      where la.lead_id = ls.id
        and la.tenant_id = p_tenant_id
        and la.kind = 'stage_changed'
    )
  ),
  durations as (
    select name, avg(secs) as avg_secs
    from (select * from moved_durations union all select * from never_moved) d
    group by name
  )
  select
    s.id, s.name, s.color, s.position, s.is_won, s.is_lost,
    coalesce(a.lead_count, 0),
    coalesce(a.value_cents, 0),
    coalesce(d.avg_secs, 0)::numeric
  from stages s
  left join agg a on a.stage_id = s.id
  left join durations d on d.name = s.name
  order by s.position;
$$;

grant execute on function public.funnel_metrics(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;
