-- Marca quando um lead entrou em uma etapa de "ganho/fechou", para contabilizar
-- os ganhos por dia na dashboard independente da data de criacao do lead.
alter table public.leads
  add column if not exists won_at timestamptz;

create index if not exists leads_tenant_won_at_idx
  on public.leads (tenant_id, won_at);
