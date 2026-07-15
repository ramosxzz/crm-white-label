-- Habilita realtime em pipeline_stages para o kanban refletir etapas novas/editadas
-- ao vivo, sem precisar atualizar a pagina.
alter publication supabase_realtime add table public.pipeline_stages;
