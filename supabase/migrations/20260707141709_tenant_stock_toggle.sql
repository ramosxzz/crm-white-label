alter table public.tenants
  add column if not exists stock_enabled boolean not null default true;

update public.tenants
set stock_enabled = false
where name = 'Avante Digital';
