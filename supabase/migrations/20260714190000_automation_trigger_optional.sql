-- Automacao pode ser criada sem gatilho pre-definido; o gatilho passa a ser
-- apenas mais um bloco escolhido livremente dentro do editor (como Datacrazy).
alter table public.automation_flows alter column trigger_kind drop not null;
