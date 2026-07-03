-- Marca quais tenants ja foram semeados (mensagens rapidas), pra nunca reinserir depois de excluir tudo
alter table public.tenants add column if not exists quick_messages_seeded_at timestamptz;
update public.tenants set quick_messages_seeded_at = now() where quick_messages_seeded_at is null;

-- Itens de valor do lead (cursos etc) -- leads.value_cents vira a soma
create table if not exists public.lead_value_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  label text not null,
  amount_cents bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lead_value_items_lead_idx on public.lead_value_items (tenant_id, lead_id);

alter table public.lead_value_items enable row level security;

drop policy if exists "lead_value_items_all" on public.lead_value_items;
create policy "lead_value_items_all" on public.lead_value_items
  for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

create or replace function public.recalc_lead_value() returns trigger language plpgsql as $$
declare target_lead uuid := coalesce(new.lead_id, old.lead_id);
begin
  update public.leads set value_cents = coalesce((
    select sum(amount_cents) from public.lead_value_items where lead_id = target_lead
  ), 0) where id = target_lead;
  return null;
end; $$;

drop trigger if exists lead_value_items_recalc on public.lead_value_items;
create trigger lead_value_items_recalc
  after insert or update or delete on public.lead_value_items
  for each row execute function public.recalc_lead_value();

-- Backfill: leads que ja tinham valor setado na criacao viram 1 item "Valor inicial"
insert into public.lead_value_items (tenant_id, lead_id, label, amount_cents)
select tenant_id, id, 'Valor inicial', value_cents
from public.leads
where value_cents > 0
  and not exists (select 1 from public.lead_value_items where lead_id = leads.id);
