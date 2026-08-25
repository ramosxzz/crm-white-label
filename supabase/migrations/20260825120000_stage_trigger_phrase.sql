-- Frase que, ao ser enviada pelo atendente no chat, move o lead sozinho pra
-- essa etapa - pedido da Atacado Moda Sul: "tudo bem?" -> Em atendimento,
-- "segue chave Pix" -> Orcamento, etc. Uma etapa por frase, opcional.
alter table public.pipeline_stages
  add column if not exists trigger_phrase text;

comment on column public.pipeline_stages.trigger_phrase is
  'Se a mensagem enviada pelo atendente contiver essa frase, o lead move automaticamente pra essa etapa.';
