-- Telefone/JID real usado no envio da mensagem outbound. O telefone do lead
-- pode ser corrigido depois do envio, quebrando editar/apagar mensagens
-- antigas (o remoteJid recalculado a partir do telefone atual nao bate mais
-- com o que a Evolution guardou pra aquela mensagem).
alter table messages add column if not exists remote_phone text;
