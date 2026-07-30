-- Projetos antigos ainda concedem privilegios amplos por default aos objetos
-- novos do schema public. RLS cobre linhas, mas TRUNCATE nao passa por RLS.
revoke truncate, references, trigger
  on table public.service_catalog_items
  from authenticated;

grant select, insert, update, delete
  on table public.service_catalog_items
  to authenticated;
