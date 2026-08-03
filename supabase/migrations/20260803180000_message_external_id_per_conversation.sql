-- external_id (id da mensagem no WhatsApp) era unico GLOBALMENTE. Quebra
-- quando duas contas conectadas do MESMO tenant conversam entre si (ex: duas
-- atendentes se falando pelos proprios numeros comerciais): o WhatsApp gera
-- o MESMO id de mensagem, mas cada instancia entrega seu proprio webhook -
-- uma achando "outbound", outra achando "inbound" - cada uma pertencendo a
-- uma conversa diferente. A trava global so deixava a primeira entrega
-- gravar; a segunda virava conversa fantasma sem nenhuma mensagem dentro
-- (reportado na ACT: "aparece no WhatsApp mas nao no sistema").
--
-- A unicidade de verdade e por conversa (evitar reentrega duplicada dentro
-- da MESMA conversa), nao global.

drop index if exists messages_external_id_unique_idx;

create unique index messages_external_id_per_conversation_idx
  on messages (conversation_id, external_id)
  where (external_id is not null and external_id <> '');
