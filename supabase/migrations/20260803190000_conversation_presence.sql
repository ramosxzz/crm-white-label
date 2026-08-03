-- Indicador de "digitando..."/"gravando audio..." na lista de conversas,
-- usando o evento presence.update que a Evolution ja manda (so nao
-- assinavamos ainda). Estado bem efemero (unico por conversa, sobrescreve),
-- expira sozinho no cliente apos alguns segundos - nao guarda historico.

create table conversation_presence (
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid primary key references conversations(id) on delete cascade,
  state text not null check (state in ('composing', 'recording')),
  updated_at timestamptz not null default now()
);

alter table conversation_presence enable row level security;

-- Mesma regra de visibilidade de conversations: gestao ve tudo, numero sem
-- dono e livre, numero com dono so pro proprio dono.
create policy conversation_presence_tenant_select on conversation_presence
  for select
  using (
    is_tenant_member(tenant_id)
    and exists (
      select 1 from conversations c
      left join whatsapp_accounts wa on wa.id = c.whatsapp_account_id
      where c.id = conversation_presence.conversation_id
        and (
          has_tenant_role(conversation_presence.tenant_id, array['owner', 'admin', 'gerente']::member_role[])
          or c.whatsapp_account_id is null
          or wa.assigned_to is null
          or wa.assigned_to = auth.uid()
        )
    )
  );

alter publication supabase_realtime add table conversation_presence;
