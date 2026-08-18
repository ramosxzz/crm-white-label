-- Conexao Gmail por tenant: guarda o refresh token pra buscar emails ligados
-- aos leads. So owner/admin podem conectar/desconectar (mesmo nivel de
-- permissao de outras integracoes, ver canManageIntegrations).
create table public.google_accounts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connected_by uuid references auth.users(id) on delete set null,
  google_email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  scope text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

alter table public.google_accounts enable row level security;

-- So owner/admin enxergam e mexem na conexao (tokens de acesso ao Gmail,
-- nao e pra vendedor ver na lista igual whatsapp_accounts).
create policy "google_accounts_admin_select" on public.google_accounts
  for select using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "google_accounts_admin_write" on public.google_accounts
  for all using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));
