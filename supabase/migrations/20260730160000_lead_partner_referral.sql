-- Triagem de lead vindo de indicacao de parceiro (audio de 2026-07-30):
-- "os clientes que forem contato de loja, e feito cadastro e distribuido
-- pela nossa coordenadora... os que entram de marketing, ja e distribuido
-- de forma aleatoria - existe essa diferenca entre os dois".
--
-- Investigado antes de mexer: TODOS os 137 leads do ACT estao sem
-- atribuicao hoje, em qualquer origem - nao so os de loja. Causa: a tabela
-- attendant_status (de onde o sorteio automatico escolhe quem esta
-- disponivel) esta vazia pro tenant inteiro, e nao ha NENHUMA tela no
-- sistema que grave nela - e uma lacuna da plataforma, nao so do ACT
-- (registrado a parte no TENANTS.md, fora do escopo desta migration).
--
-- Por causa disso, o pedido do ACT nao tem risco de quebrar uma distribuicao
-- que ja funciona: nenhuma esta funcionando pra ninguem hoje. O que fica
-- pronto aqui: quando o lead for marcado como indicado por um parceiro
-- (loja ou vendedor cadastrado), a distribuicao automatica e pulada de
-- proposito - o lead fica sem dono, esperando a coordenadora, mesmo que a
-- lacuna acima seja resolvida um dia e o sorteio volte a funcionar pros
-- outros leads.
alter table public.leads
  add column if not exists referred_by_partner_id uuid references public.field_service_partners(id) on delete set null;

comment on column public.leads.referred_by_partner_id is
  'Loja ou vendedor parceiro que indicou este cliente. Presente = pula a distribuicao automatica; a triagem e manual (coordenadora).';

create index leads_referred_by_partner_idx on public.leads (tenant_id, referred_by_partner_id) where referred_by_partner_id is not null;
