alter table public.tenants
  add column if not exists calls_dashboard_enabled boolean not null default false;

update public.tenants
set calls_dashboard_enabled = true
where name = 'Avante Digital';
