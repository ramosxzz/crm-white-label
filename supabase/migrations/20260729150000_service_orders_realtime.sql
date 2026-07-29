-- Tempo real das ordens de servico.
--
-- O tecnico concluia a OS no app de campo e a tela do escritorio so mostrava
-- depois de um F5: as paginas sao renderizadas no servidor, e a aba que ja
-- estava aberta nao tinha como saber que algo mudou.
--
-- A RLS continua valendo no tempo real: cada assinante so recebe as linhas que
-- ja poderia enxergar, entao tecnico nao passa a ver OS de outro tenant.
alter publication supabase_realtime add table public.service_orders;
