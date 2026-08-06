-- Receita de producao (BOM): produto acabado consome quantidades de outros
-- produtos (materia-prima). "Fabricar" da baixa na materia-prima e entrada
-- do produto acabado no mesmo local, numa transacao so (mesmo padrao de
-- transfer_stock).

create table public.product_recipe_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  material_product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (product_id, material_product_id)
);

create index on public.product_recipe_items (tenant_id);
create index on public.product_recipe_items (product_id);

alter table public.product_recipe_items enable row level security;

create policy "product_recipe_items_tenant_select" on public.product_recipe_items
  for select using (public.is_tenant_member(tenant_id));
create policy "product_recipe_items_tenant_insert" on public.product_recipe_items
  for insert with check (public.is_tenant_member(tenant_id));
create policy "product_recipe_items_tenant_update" on public.product_recipe_items
  for update using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
create policy "product_recipe_items_tenant_delete" on public.product_recipe_items
  for delete using (public.is_tenant_member(tenant_id));

-- Flag separada de stock_enabled: so tenant que pediu esse fluxo (Vasos
-- Fortuna) deve ver o modal de baixa ao fechar - outros tenants com estoque
-- ligado nao usam esse fluxo de venda.
alter table public.tenants add column stock_deduct_on_won boolean not null default false;

create or replace function public.produce_product(
  p_tenant_id uuid,
  p_product_id uuid,
  p_location_id uuid,
  p_quantity int,
  p_user_id uuid
)
returns void
language plpgsql
as $$
declare
  item record;
  needed int;
  available int;
  material_name text;
  product_name text;
  has_recipe boolean;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade a fabricar deve ser maior que zero';
  end if;

  select exists(select 1 from public.product_recipe_items where product_id = p_product_id and tenant_id = p_tenant_id) into has_recipe;
  if not has_recipe then
    raise exception 'Produto sem receita cadastrada';
  end if;

  select name into product_name from public.products where id = p_product_id and tenant_id = p_tenant_id;

  for item in
    select material_product_id, quantity from public.product_recipe_items
    where product_id = p_product_id and tenant_id = p_tenant_id
  loop
    needed := item.quantity * p_quantity;

    select coalesce(quantity, 0) into available
    from public.product_stock
    where product_id = item.material_product_id and location_id = p_location_id;

    if coalesce(available, 0) < needed then
      select name into material_name from public.products where id = item.material_product_id;
      raise exception 'Materia-prima insuficiente: % (disponivel: %, necessario: %)', coalesce(material_name, 'desconhecida'), coalesce(available, 0), needed;
    end if;

    insert into public.stock_movements (tenant_id, product_id, user_id, kind, quantity, reason, location_id)
    values (p_tenant_id, item.material_product_id, p_user_id, 'out', needed, format('Producao de %s', coalesce(product_name, 'produto')), p_location_id);
  end loop;

  insert into public.stock_movements (tenant_id, product_id, user_id, kind, quantity, reason, location_id)
  values (p_tenant_id, p_product_id, p_user_id, 'in', p_quantity, 'Producao', p_location_id);
end;
$$;

grant execute on function public.produce_product(uuid, uuid, uuid, int, uuid) to authenticated, service_role;
