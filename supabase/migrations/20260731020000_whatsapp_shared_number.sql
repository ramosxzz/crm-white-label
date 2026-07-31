-- Numero de WhatsApp usado pela equipe inteira.
--
-- O escopo por vendedor (20260730195536) partiu de "cada vendedor tem seu
-- proprio numero". A Atacado Moda Sul opera do jeito oposto: UM numero, varios
-- vendedores atendendo nele. Como esse numero nao tem responsavel, os
-- vendedores passaram a nao enxergar conversa nenhuma - a regra "vendedor so ve
-- os numeros dele" com zero numeros atribuidos resulta em lista vazia.
--
-- "Sem responsavel" e "de todo mundo" sao coisas diferentes e nao dava pra
-- inferir uma da outra: numero recem-cadastrado tambem fica sem responsavel, e
-- liberar esse pra todos por conta propria vazaria conversa em quem de fato quer
-- separacao. Por isso a escolha e explicita.
alter table public.whatsapp_accounts
  add column if not exists shared_with_all boolean not null default false;

comment on column public.whatsapp_accounts.shared_with_all is
  'Numero atendido pela equipe toda: todo membro do tenant ve as conversas dele, mesmo com escopo por vendedor ligado. Diferente de assigned_to nulo, que significa apenas "ainda sem responsavel".';

-- Backfill de quem ja opera em modo compartilhado hoje: tenant com distribuicao
-- de leads DESLIGADA declarou que nao quer separacao por pessoa (a RLS de leads
-- ja libera tudo pra eles). Marcar o numero sem dono desses tenants como
-- compartilhado devolve o que eles enxergavam antes do escopo por vendedor, sem
-- tocar em quem escolheu separar.
update public.whatsapp_accounts wa
set shared_with_all = true
from public.tenants t
where t.id = wa.tenant_id
  and wa.assigned_to is null
  and t.lead_assignment_enabled = false;
