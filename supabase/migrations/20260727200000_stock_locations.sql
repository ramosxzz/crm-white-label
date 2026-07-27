-- Estoque por local (ex: Loja / Fabrica) com transferencia manual entre locais.
-- products.stock_quantity continua existindo como rollup (soma de
-- product_stock), pra nao quebrar nenhum lugar que ja le esse campo
-- (lista de estoque, baixo estoque no dashboard, reservas).

create table public.stock_locations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.stock_locations (tenant_id);

create table public.product_stock (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.stock_locations(id) on delete cascade,
  quantity int not null default 0,
  unique (product_id, location_id)
);

create index on public.product_stock (tenant_id);
create index on public.product_stock (product_id);

alter table public.stock_movements add column location_id uuid references public.stock_locations(id) on delete set null;

-- Location "Principal" por tenant, recebendo o estoque atual de cada produto.
insert into public.stock_locations (tenant_id, name, is_default)
select id, 'Principal', true from public.tenants;

insert into public.product_stock (tenant_id, product_id, location_id, quantity)
select p.tenant_id, p.id, sl.id, p.stock_quantity
from public.products p
join public.stock_locations sl on sl.tenant_id = p.tenant_id and sl.is_default = true;

update public.stock_movements sm
set location_id = sl.id
from public.stock_locations sl
where sl.tenant_id = sm.tenant_id and sl.is_default = true and sm.location_id is null;

-- Reescreve a trigger: em vez de mexer direto em products.stock_quantity,
-- faz upsert em product_stock pro local do movimento e recalcula o rollup.
create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
declare
  loc_id uuid;
begin
  loc_id := coalesce(new.location_id, (select id from public.stock_locations where tenant_id = new.tenant_id and is_default limit 1));

  if loc_id is null then
    -- Tenant sem location (nao deveria acontecer apos o backfill) - cria uma default na hora.
    insert into public.stock_locations (tenant_id, name, is_default)
    values (new.tenant_id, 'Principal', true)
    returning id into loc_id;
  end if;

  if new.kind = 'in' then
    insert into public.product_stock (tenant_id, product_id, location_id, quantity)
    values (new.tenant_id, new.product_id, loc_id, new.quantity)
    on conflict (product_id, location_id) do update set quantity = public.product_stock.quantity + excluded.quantity;
  elsif new.kind = 'out' then
    insert into public.product_stock (tenant_id, product_id, location_id, quantity)
    values (new.tenant_id, new.product_id, loc_id, -new.quantity)
    on conflict (product_id, location_id) do update set quantity = public.product_stock.quantity - new.quantity;
  elsif new.kind = 'adjust' then
    insert into public.product_stock (tenant_id, product_id, location_id, quantity)
    values (new.tenant_id, new.product_id, loc_id, new.quantity)
    on conflict (product_id, location_id) do update set quantity = excluded.quantity;
  end if;

  update public.products
  set stock_quantity = coalesce((select sum(quantity) from public.product_stock where product_id = new.product_id), 0)
  where id = new.product_id;

  return new;
end; $$;

-- Move quantidade de um local pro outro: 2 stock_movements (saida/entrada)
-- numa transacao so, validando que a origem tem saldo suficiente.
create or replace function public.transfer_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_quantity int,
  p_user_id uuid,
  p_reason text default null
)
returns void
language plpgsql
as $$
declare
  available int;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade de transferencia deve ser maior que zero';
  end if;
  if p_from_location_id = p_to_location_id then
    raise exception 'Origem e destino devem ser locais diferentes';
  end if;

  select coalesce(quantity, 0) into available
  from public.product_stock
  where product_id = p_product_id and location_id = p_from_location_id;

  if coalesce(available, 0) < p_quantity then
    raise exception 'Estoque insuficiente no local de origem (disponivel: %)', coalesce(available, 0);
  end if;

  insert into public.stock_movements (tenant_id, product_id, user_id, kind, quantity, reason, location_id)
  values (p_tenant_id, p_product_id, p_user_id, 'out', p_quantity, coalesce(p_reason, 'Transferencia entre locais'), p_from_location_id);

  insert into public.stock_movements (tenant_id, product_id, user_id, kind, quantity, reason, location_id)
  values (p_tenant_id, p_product_id, p_user_id, 'in', p_quantity, coalesce(p_reason, 'Transferencia entre locais'), p_to_location_id);
end;
$$;

grant execute on function public.transfer_stock(uuid, uuid, uuid, uuid, int, uuid, text) to authenticated, service_role;

alter table public.stock_locations enable row level security;
alter table public.product_stock enable row level security;

create policy "stock_locations_tenant_select" on public.stock_locations
  for select using (public.is_tenant_member(tenant_id));
create policy "stock_locations_tenant_insert" on public.stock_locations
  for insert with check (public.is_tenant_member(tenant_id));
create policy "stock_locations_tenant_update" on public.stock_locations
  for update using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
create policy "stock_locations_tenant_delete" on public.stock_locations
  for delete using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "product_stock_tenant_select" on public.product_stock
  for select using (public.is_tenant_member(tenant_id));
create policy "product_stock_tenant_insert" on public.product_stock
  for insert with check (public.is_tenant_member(tenant_id));
create policy "product_stock_tenant_update" on public.product_stock
  for update using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
create policy "product_stock_tenant_delete" on public.product_stock
  for delete using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));
