-- Qualquer membro do tenant precisa ler a conexao (pra abrir emails do lead
-- ou a caixa de entrada), so conectar/desconectar fica restrito a admin.
drop policy "google_accounts_admin_select" on public.google_accounts;

create policy "google_accounts_member_select" on public.google_accounts
  for select using (public.is_tenant_member(tenant_id));
