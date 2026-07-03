-- Respostas/citacoes de mensagens no chat (estilo WhatsApp)
alter table public.messages
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null,
  add column if not exists reply_to_external_id text,
  add column if not exists reply_to_body text,
  add column if not exists reply_to_sender_name text;

create index if not exists messages_reply_to_message_idx
  on public.messages (reply_to_message_id);
