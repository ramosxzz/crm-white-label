-- Chat interno da empresa: um grupo unico por tenant pra funcionarios
-- conversarem, com mencao (@usuario) e audio, igual pedido pelo dono.

create table public.team_messages (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  media_url text,
  media_type text check (media_type in ('audio', 'image', 'document')),
  mentions uuid[] not null default '{}',
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or media_url is not null)
);

create index on public.team_messages (tenant_id, created_at);
create index on public.team_messages using gin (mentions);

alter table public.team_messages enable row level security;

create policy team_messages_tenant_select on public.team_messages
  for select using (public.is_tenant_member(tenant_id));

create policy team_messages_tenant_insert on public.team_messages
  for insert with check (
    public.is_tenant_member(tenant_id) and sender_id = auth.uid()
  );

create policy team_messages_own_update on public.team_messages
  for update using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

alter publication supabase_realtime add table public.team_messages;
