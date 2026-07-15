-- Automacoes: um fluxo agora pode ter varios gatilhos (bloco "Inicio" com
-- lista de eventos, disparando com semantica "OU"), em vez de um unico
-- trigger_kind fixo. Mantem a coluna antiga para nao quebrar fluxos ja
-- salvos; trigger_kinds e a fonte de verdade a partir de agora.
alter table public.automation_flows
  add column if not exists trigger_kinds text[];

update public.automation_flows
  set trigger_kinds = array[trigger_kind]
  where trigger_kind is not null and trigger_kinds is null;

create index if not exists automation_flows_trigger_kinds_idx
  on public.automation_flows using gin (trigger_kinds);
