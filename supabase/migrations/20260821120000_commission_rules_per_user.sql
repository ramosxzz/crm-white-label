-- Ate aqui commission_rules tinha 1 percentual por party_kind pro tenant
-- inteiro - toda vendedora interna ganhava a mesma taxa. ACT pediu comissao
-- configuravel por vendedora individualmente. user_id null = taxa padrao do
-- tenant (fallback); user_id preenchido = override so daquela pessoa.
alter table public.commission_rules
  add column user_id uuid references auth.users(id) on delete cascade;

alter table public.commission_rules drop constraint commission_rules_tenant_id_party_kind_key;

create unique index commission_rules_tenant_party_default_uniq
  on public.commission_rules (tenant_id, party_kind) where user_id is null;

create unique index commission_rules_tenant_party_user_uniq
  on public.commission_rules (tenant_id, party_kind, user_id) where user_id is not null;

-- compute_service_order_commissions: taxa da vendedora agora prioriza um
-- override pessoal (user_id = consultant_id) e so cai pro padrao do tenant
-- se nao houver override cadastrado pra ela.
create or replace function public.compute_service_order_commissions(p_service_order_id uuid)
returns table (
  out_party_kind text,
  out_user_id uuid,
  out_partner_id uuid,
  out_partner_name text,
  out_partner_store text,
  out_base_cents bigint,
  out_percent numeric,
  out_amount_cents bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.service_orders%rowtype;
  v_upsell_cents bigint;
  v_tecnico_percent numeric(6,3);
  v_vendedora_percent numeric(6,3);
  v_parceira_percent numeric(6,3);
  v_tecnicos uuid[];
  v_tecnico_count int;
  v_pool bigint;
  v_base bigint;
  v_remainder bigint;
  v_amount bigint;
  v_index int;
  v_tecnico uuid;
  v_partner_beneficiary text;
  v_total_partner_amount bigint;
  v_store_split numeric(6,3);
  v_store_amount bigint;
  v_seller_amount bigint;
  v_store_name text;
  v_seller_name text;
begin
  select * into v_order from public.service_orders where id = p_service_order_id;
  if not found then
    raise exception 'OS nao encontrada';
  end if;

  select coalesce(sum(soi.amount_cents), 0) into v_upsell_cents
  from public.service_order_items soi
  where soi.service_order_id = p_service_order_id and soi.kind = 'upsell' and soi.approved;

  select coalesce(max(case when cr.party_kind = 'tecnico' then cr.percent end), 0),
         coalesce(max(case when cr.party_kind = 'loja_parceira' then cr.percent end), 0)
    into v_tecnico_percent, v_parceira_percent
  from public.commission_rules cr
  where cr.tenant_id = v_order.tenant_id and cr.user_id is null;

  -- Override pessoal da vendedora, senao cai pro padrao do tenant.
  select cr.percent into v_vendedora_percent
  from public.commission_rules cr
  where cr.tenant_id = v_order.tenant_id
    and cr.party_kind = 'vendedora_interna'
    and cr.user_id = v_order.consultant_id;

  if v_vendedora_percent is null then
    select cr.percent into v_vendedora_percent
    from public.commission_rules cr
    where cr.tenant_id = v_order.tenant_id
      and cr.party_kind = 'vendedora_interna'
      and cr.user_id is null;
  end if;
  v_vendedora_percent := coalesce(v_vendedora_percent, 0);

  if v_order.partner_commission_percent is not null then
    v_parceira_percent := v_order.partner_commission_percent;
  end if;

  select coalesce(array_agg(t.user_id order by t.is_primary desc, t.created_at), array[]::uuid[])
    into v_tecnicos
  from public.service_order_technicians t
  where t.service_order_id = p_service_order_id;

  v_tecnico_count := coalesce(array_length(v_tecnicos, 1), 0);

  if v_upsell_cents > 0 and v_tecnico_count > 0 and v_tecnico_percent > 0 then
    v_pool := round(v_upsell_cents * v_tecnico_percent / 100);
    v_base := v_pool / v_tecnico_count;
    v_remainder := v_pool - (v_base * v_tecnico_count);

    v_index := 0;
    foreach v_tecnico in array v_tecnicos loop
      v_amount := v_base + case when v_index < v_remainder then 1 else 0 end;
      if v_amount > 0 then
        out_party_kind := 'tecnico';
        out_user_id := v_tecnico;
        out_partner_id := null;
        out_partner_name := null;
        out_partner_store := null;
        out_base_cents := v_upsell_cents;
        out_percent := v_tecnico_percent;
        out_amount_cents := v_amount;
        return next;
      end if;
      v_index := v_index + 1;
    end loop;
  end if;

  if v_order.consultant_id is not null and v_order.total_cents > 0
     and v_vendedora_percent > 0 then
    v_amount := round(v_order.total_cents * v_vendedora_percent / 100);
    if v_amount > 0 then
      out_party_kind := 'vendedora_interna';
      out_user_id := v_order.consultant_id;
      out_partner_id := null;
      out_partner_name := null;
      out_partner_store := null;
      out_base_cents := v_order.total_cents;
      out_percent := v_vendedora_percent;
      out_amount_cents := v_amount;
      return next;
    end if;
  end if;

  if (v_order.partner_store_id is not null or v_order.partner_seller_id is not null)
     and v_order.total_cents > 0 and v_parceira_percent > 0 then

    v_total_partner_amount := round(v_order.total_cents * v_parceira_percent / 100);

    if v_order.partner_store_id is not null and v_order.partner_seller_id is not null then
      v_store_split := coalesce(v_order.partner_store_split_percent, 50);
      v_store_amount := round(v_total_partner_amount * v_store_split / 100);
      v_seller_amount := v_total_partner_amount - v_store_amount;

      if v_store_amount > 0 then
        select fp.name into v_store_name from public.field_service_partners fp where fp.id = v_order.partner_store_id;
        out_party_kind := 'loja_parceira';
        out_user_id := null;
        out_partner_id := v_order.partner_store_id;
        out_partner_name := v_store_name;
        out_partner_store := null;
        out_base_cents := v_order.total_cents;
        out_percent := round(v_store_split * v_parceira_percent / 100, 3);
        out_amount_cents := v_store_amount;
        return next;
      end if;

      if v_seller_amount > 0 then
        select fp.name into v_seller_name from public.field_service_partners fp where fp.id = v_order.partner_seller_id;
        out_party_kind := 'vendedor_externo';
        out_user_id := null;
        out_partner_id := v_order.partner_seller_id;
        out_partner_name := v_seller_name;
        out_partner_store := null;
        out_base_cents := v_order.total_cents;
        out_percent := round((100 - v_store_split) * v_parceira_percent / 100, 3);
        out_amount_cents := v_seller_amount;
        return next;
      end if;

    elsif v_order.partner_store_id is not null then
      if v_total_partner_amount > 0 then
        select fp.name into v_store_name from public.field_service_partners fp where fp.id = v_order.partner_store_id;
        out_party_kind := 'loja_parceira';
        out_user_id := null;
        out_partner_id := v_order.partner_store_id;
        out_partner_name := v_store_name;
        out_partner_store := null;
        out_base_cents := v_order.total_cents;
        out_percent := v_parceira_percent;
        out_amount_cents := v_total_partner_amount;
        return next;
      end if;

    else
      if v_total_partner_amount > 0 then
        select fp.name into v_seller_name from public.field_service_partners fp where fp.id = v_order.partner_seller_id;
        out_party_kind := 'vendedor_externo';
        out_user_id := null;
        out_partner_id := v_order.partner_seller_id;
        out_partner_name := v_seller_name;
        out_partner_store := null;
        out_base_cents := v_order.total_cents;
        out_percent := v_parceira_percent;
        out_amount_cents := v_total_partner_amount;
        return next;
      end if;
    end if;

  elsif v_order.total_cents > 0 and v_parceira_percent > 0 then
    v_partner_beneficiary := coalesce(
      nullif(btrim(v_order.partner_seller_name), ''),
      nullif(btrim(v_order.partner_store), '')
    );

    if v_partner_beneficiary is not null then
      v_amount := round(v_order.total_cents * v_parceira_percent / 100);
      if v_amount > 0 then
        out_party_kind := 'loja_parceira';
        out_user_id := null;
        out_partner_id := null;
        out_partner_name := v_partner_beneficiary;
        out_partner_store := nullif(btrim(v_order.partner_store), '');
        out_base_cents := v_order.total_cents;
        out_percent := v_parceira_percent;
        out_amount_cents := v_amount;
        return next;
      end if;
    end if;
  end if;

  return;
end;
$$;
