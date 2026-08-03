-- Vendedor/atendente conseguia ler QUALQUER conversa/mensagem do tenant no
-- banco (RLS so checava is_tenant_member), mesmo quando o numero de
-- WhatsApp tem dono (whatsapp_accounts.assigned_to). A restricao existia
-- SO na tela de lista de conversas (lib/chat/list-conversation-items.ts) -
-- quem abrisse o lead direto (via /leads, que lista todos) ou o mini-chat
-- do kanban via outra pessoa ainda enxergava as mensagens de um numero que
-- nao era dele. Reportado: vendedor da Vasos Fortuna via conversas de
-- numeros de outros atendentes/admin.
--
-- Numero sem dono (assigned_to null) continua visivel pra todo mundo -
-- e o caso normal de tenant com um numero so compartilhado.

drop policy if exists conversations_tenant_select on conversations;
create policy conversations_tenant_select on conversations
  for select
  using (
    is_tenant_member(tenant_id)
    and (
      has_tenant_role(tenant_id, array['owner', 'admin', 'gerente']::member_role[])
      or whatsapp_account_id is null
      or exists (
        select 1 from whatsapp_accounts wa
        where wa.id = conversations.whatsapp_account_id
          and (wa.assigned_to is null or wa.assigned_to = auth.uid())
      )
    )
  );

drop policy if exists messages_tenant_select on messages;
create policy messages_tenant_select on messages
  for select
  using (
    is_tenant_member(tenant_id)
    and (
      has_tenant_role(tenant_id, array['owner', 'admin', 'gerente']::member_role[])
      or not exists (
        select 1 from conversations c
        where c.id = messages.conversation_id and c.whatsapp_account_id is not null
      )
      or exists (
        select 1 from conversations c
        join whatsapp_accounts wa on wa.id = c.whatsapp_account_id
        where c.id = messages.conversation_id
          and (wa.assigned_to is null or wa.assigned_to = auth.uid())
      )
    )
  );
