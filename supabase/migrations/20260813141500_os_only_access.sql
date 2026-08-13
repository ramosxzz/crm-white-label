-- Login restrito a Agenda/OS: a pessoa que faz conferencia de OS no ACT
-- precisa de permissao de admin (conferir/faturar), mas NAO deve ver o
-- resto do CRM (chat, leads, kanban etc). E' independente do papel (role),
-- por isso fica na membership, nao vira um MemberRole novo - um admin pode
-- ou nao estar restrito, sem duplicar toda a matriz de permissao existente.
alter table public.tenant_members
  add column if not exists os_only_access boolean not null default false;
