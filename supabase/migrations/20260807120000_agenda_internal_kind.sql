-- Agenda interna: alinhamentos da equipe, suporte a cliente que nao e venda e
-- compromissos pessoais. Hoje toda a agenda e comercial, o que mistura reuniao
-- de venda com alinhamento interno na mesma lista.
--
-- Nao precisa de tabela nova: `appointments.lead_id` ja e opcional e
-- `lib/agenda/reminders.ts` ja ignora compromisso sem lead (nao existe cliente
-- pra lembrar). Falta apenas o tipo.

alter table public.appointments
  drop constraint if exists appointments_kind_check;

alter table public.appointments
  add constraint appointments_kind_check
  check (kind = any (array['meeting'::text, 'call'::text, 'internal'::text]));

comment on column public.appointments.kind is
  'meeting/call = agenda comercial, vinculada a um lead. internal = alinhamento interno da equipe, sem lead e sem lembrete pro cliente.';
