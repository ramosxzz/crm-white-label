-- SLA de atendimento por atendente.
--
-- Tempo de resposta = do momento em que o cliente ficou esperando (primeira
-- mensagem de uma sequencia de entrada sem resposta) ate a primeira resposta
-- enviada. Agrupa por "out_grp" (quantas mensagens de saida existiam antes
-- da mensagem), o que junta varias mensagens seguidas do cliente numa unica
-- espera - e nao conta a mesma resposta varias vezes.
create or replace function public.attendant_sla_metrics(
  p_tenant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  user_id uuid,
  responses bigint,
  avg_response_seconds numeric,
  median_response_seconds numeric,
  slowest_response_seconds numeric,
  messages_sent bigint,
  conversations bigint
)
language sql
stable
set search_path = public
as $$
  with ordered as (
    select
      m.conversation_id,
      m.user_id,
      m.direction,
      m.created_at,
      sum(case when m.direction = 'outbound' then 1 else 0 end)
        over (partition by m.conversation_id order by m.created_at
              rows between unbounded preceding and current row) as out_grp
    from public.messages m
    where m.tenant_id = p_tenant_id
      and m.created_at >= p_from
      and m.created_at < p_to
  ),
  waits as (
    select conversation_id, out_grp, min(created_at) as asked_at
    from ordered
    where direction = 'inbound'
    group by conversation_id, out_grp
  ),
  replies as (
    select
      conversation_id,
      out_grp,
      min(created_at) as replied_at,
      (array_agg(user_id order by created_at))[1] as replied_by
    from ordered
    where direction = 'outbound'
    group by conversation_id, out_grp
  ),
  response_times as (
    select
      r.replied_by as user_id,
      extract(epoch from (r.replied_at - w.asked_at)) as secs
    from waits w
    join replies r
      on r.conversation_id = w.conversation_id
     and r.out_grp = w.out_grp + 1
    where r.replied_by is not null
  ),
  per_user_response as (
    select
      user_id,
      count(*)::bigint as responses,
      avg(secs)::numeric as avg_response_seconds,
      percentile_cont(0.5) within group (order by secs)::numeric as median_response_seconds,
      max(secs)::numeric as slowest_response_seconds
    from response_times
    group by user_id
  ),
  per_user_volume as (
    select
      o.user_id,
      count(*)::bigint as messages_sent,
      count(distinct o.conversation_id)::bigint as conversations
    from ordered o
    where o.direction = 'outbound' and o.user_id is not null
    group by o.user_id
  )
  select
    v.user_id,
    coalesce(r.responses, 0),
    coalesce(r.avg_response_seconds, 0),
    coalesce(r.median_response_seconds, 0),
    coalesce(r.slowest_response_seconds, 0),
    v.messages_sent,
    v.conversations
  from per_user_volume v
  left join per_user_response r on r.user_id = v.user_id
  order by v.messages_sent desc;
$$;

grant execute on function public.attendant_sla_metrics(uuid, timestamptz, timestamptz) to authenticated, service_role;
