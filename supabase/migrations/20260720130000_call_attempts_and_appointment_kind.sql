-- Local record of call outcomes (for the calls funnel/metrics), separate from
-- the raw Api4com call log which has no notion of pipeline outcome.
create table public.call_attempts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  api4com_call_id text,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  outcome text not null default 'feita'
    check (outcome in ('feita', 'sem_resposta', 'passou_valor', 'qualificado', 'fechado', 'perdido')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index call_attempts_tenant_created_idx on public.call_attempts (tenant_id, created_at desc);
create index call_attempts_tenant_lead_idx on public.call_attempts (tenant_id, lead_id);
create index call_attempts_tenant_outcome_idx on public.call_attempts (tenant_id, outcome);

alter table public.call_attempts enable row level security;

create policy "call_attempts_tenant_select" on public.call_attempts
  for select using (public.is_tenant_member(tenant_id));
create policy "call_attempts_tenant_insert" on public.call_attempts
  for insert with check (public.is_tenant_member(tenant_id));
create policy "call_attempts_tenant_update" on public.call_attempts
  for update using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
create policy "call_attempts_tenant_delete" on public.call_attempts
  for delete using (
    public.has_tenant_role(tenant_id, array['owner','admin','gerente']::public.member_role[])
  );

-- Distinguish scheduled phone calls from meetings within the same appointments
-- table/UI (Agenda), instead of a separate table.
alter table public.appointments
  add column kind text not null default 'meeting' check (kind in ('meeting', 'call'));
