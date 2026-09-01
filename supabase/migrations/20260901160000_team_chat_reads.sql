-- Marca de "lido ate aqui" por usuario no chat da equipe, pra badge de
-- nao lidas na sidebar.

create table public.team_message_reads (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

alter table public.team_message_reads enable row level security;

create policy team_message_reads_own_select on public.team_message_reads
  for select using (user_id = auth.uid());

create policy team_message_reads_own_upsert on public.team_message_reads
  for insert with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));

create policy team_message_reads_own_update on public.team_message_reads
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
