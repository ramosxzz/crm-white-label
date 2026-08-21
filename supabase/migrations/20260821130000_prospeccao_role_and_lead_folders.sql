-- Perfil restrito novo pra quem faz prospeccao (cadastra lead/parceiro e
-- roteia pra pasta de uma vendedora) + "pastas" de lead por vendedora
-- (Primeiro contato / Reaplicacao / MKT - cada vendedora so ve os leads
-- que caem na propria pasta). Modulo pago, desligado por padrao (mesmo
-- padrao de ERP W+/Disparos).
alter type public.member_role add value if not exists 'prospeccao';

alter table public.tenants
  add column lead_folders_enabled boolean not null default false;

alter table public.leads
  add column lead_folder text check (lead_folder in ('primeiro_contato','reaplicacao','mkt'));
