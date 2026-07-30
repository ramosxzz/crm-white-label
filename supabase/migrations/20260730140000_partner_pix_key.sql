-- Chave PIX do parceiro (pauta de 2026-07-30, audio): "conseguisse cadastrar
-- o PIX dele" - pra pagar a comissao do vendedor externo sem precisar
-- perguntar de novo toda vez.
alter table public.field_service_partners
  add column if not exists pix_key text;

comment on column public.field_service_partners.pix_key is
  'Chave PIX pra pagar a comissao deste parceiro (telefone, e-mail, CPF/CNPJ ou aleatoria).';
