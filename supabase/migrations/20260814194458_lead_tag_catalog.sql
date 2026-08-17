create table public.lead_tag_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  color text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lead_tag_catalog_name_valid check (
    length(btrim(name)) between 1 and 40
    and name = btrim(name)
  ),
  constraint lead_tag_catalog_color_valid check (
    color is null or color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  constraint lead_tag_catalog_tenant_name_key unique (tenant_id, normalized_name)
);

create index lead_tag_catalog_tenant_name_idx
  on public.lead_tag_catalog (tenant_id, normalized_name);

alter table public.lead_tag_catalog enable row level security;

create policy lead_tag_catalog_tenant_select
  on public.lead_tag_catalog
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy lead_tag_catalog_tenant_insert
  on public.lead_tag_catalog
  for insert
  to authenticated
  with check (public.is_tenant_member(tenant_id));

grant select, insert on public.lead_tag_catalog to authenticated;
grant all on public.lead_tag_catalog to service_role;

insert into public.lead_tag_catalog (tenant_id, name)
select distinct on (lead.tenant_id, lower(btrim(tag.value)))
  lead.tenant_id,
  btrim(tag.value)
from public.leads as lead
cross join lateral unnest(lead.tags) as tag(value)
where btrim(tag.value) <> ''
  and tag.value not like '__close_channel:%'
order by lead.tenant_id, lower(btrim(tag.value)), lead.created_at
on conflict (tenant_id, normalized_name) do nothing;

create or replace function public.sync_lead_tags_to_catalog()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  insert into public.lead_tag_catalog (tenant_id, name, created_by)
  select distinct on (lower(btrim(tag.value)))
    new.tenant_id,
    btrim(tag.value),
    auth.uid()
  from unnest(new.tags) as tag(value)
  where btrim(tag.value) <> ''
    and tag.value not like '__close_channel:%'
  order by lower(btrim(tag.value)), btrim(tag.value)
  on conflict (tenant_id, normalized_name) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_lead_tags_to_catalog() from public, anon;
grant execute on function public.sync_lead_tags_to_catalog() to authenticated, service_role;

create trigger leads_sync_tag_catalog
after insert or update of tags on public.leads
for each row
when (cardinality(new.tags) > 0)
execute function public.sync_lead_tags_to_catalog();
