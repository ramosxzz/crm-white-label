alter table public.tenants
  add column if not exists hidden_navigation_items text[] not null default '{}';

comment on column public.tenants.hidden_navigation_items is
  'IDs dos itens operacionais ocultos na navegacao e bloqueados para o tenant.';

update public.tenants
set hidden_navigation_items = (
  select array_agg(distinct item order by item)
  from unnest(hidden_navigation_items || array['tasks', 'meetings']::text[]) as item
)
where slug = 'frigigold';
