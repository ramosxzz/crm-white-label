-- Rastreia qual mensagem rapida foi usada ao enviar, para permitir automacoes
-- com gatilho "mensagem enviada" filtrado por mensagem rapida especifica.
alter table public.messages
  add column if not exists quick_message_id uuid references public.quick_messages(id) on delete set null;
