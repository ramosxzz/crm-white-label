-- Mantem a mensagem no historico, mas registra quando o conteudo foi
-- alterado ou removido no provedor. A exclusao logica permite que todos os
-- dispositivos exibam o mesmo tombstone sem quebrar respostas/citacoes.
alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

comment on column public.messages.edited_at is
  'Data da ultima edicao confirmada no provedor da mensagem.';

comment on column public.messages.deleted_at is
  'Data da exclusao para todos confirmada no provedor da mensagem.';
