drop function if exists public.list_chat_conversations(uuid, integer);
drop function if exists public.list_chat_conversations(uuid, integer, text, text);

create function public.list_chat_conversations(
  p_tenant_id uuid,
  p_limit integer default 100,
  p_search text default null,
  p_status text default null
)
returns table (
  id uuid,
  lead_id uuid,
  channel text,
  last_message_at timestamptz,
  unread_count integer,
  status text,
  lead_name text,
  lead_phone text,
  lead_whatsapp_lid text,
  lead_custom_fields jsonb,
  last_body text,
  last_direction text,
  whatsapp_account_id uuid,
  lead_tags text[],
  lead_stage_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      nullif(trim(coalesce(p_search, '')), '') as search_text,
      nullif(regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g'), '') as search_digits,
      nullif(trim(coalesce(p_status, '')), '') as status_filter
  )
  select
    c.id,
    c.lead_id,
    c.channel,
    c.last_message_at,
    c.unread_count,
    c.status,
    l.name as lead_name,
    l.phone as lead_phone,
    l.whatsapp_lid as lead_whatsapp_lid,
    l.custom_fields as lead_custom_fields,
    last_message.body as last_body,
    last_message.direction::text as last_direction,
    c.whatsapp_account_id,
    l.tags as lead_tags,
    l.stage_id as lead_stage_id
  from public.conversations c
  join public.leads l
    on l.id = c.lead_id
   and l.tenant_id = c.tenant_id
  left join lateral (
    select m.body, m.direction
    from public.messages m
    where m.tenant_id = c.tenant_id
      and m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last_message on true
  cross join params
  where c.tenant_id = p_tenant_id
    and (
      params.status_filter is null
      or params.status_filter = 'todas'
      or c.status::text = params.status_filter
    )
    and (
      params.search_text is null
      or l.name ilike '%' || params.search_text || '%'
      or l.phone ilike '%' || params.search_text || '%'
      or last_message.body ilike '%' || params.search_text || '%'
      or (
        params.search_digits is not null
        and regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')
          like '%' || params.search_digits || '%'
      )
    )
  order by c.last_message_at desc nulls last, c.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

grant execute on function public.list_chat_conversations(uuid, integer, text, text)
  to authenticated, service_role;
