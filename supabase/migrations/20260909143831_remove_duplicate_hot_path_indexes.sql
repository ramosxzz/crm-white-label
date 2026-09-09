-- Estes indices repetem exatamente indices mantidos com nomes mais claros.
-- A remocao reduz custo de escrita sem alterar os planos de leitura.
drop index if exists public.appointments_tenant_id_starts_at_idx;
drop index if exists public.leads_tenant_id_phone_idx;
