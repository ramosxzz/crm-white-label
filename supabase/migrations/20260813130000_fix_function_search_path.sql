-- Linter de seguranca do Supabase acusa search_path mutavel nessas 6
-- funcoes (risco teorico de sequestro via search_path). Todas ja
-- referenciam tudo como public.xxx, entao travar o search_path nao muda
-- comportamento - so fecha o vetor.
alter function public.apply_stock_movement() set search_path = '';
alter function public.touch_campaigns_updated_at() set search_path = '';
alter function public.touch_message_templates_updated_at() set search_path = '';
alter function public.recalc_lead_value() set search_path = '';
alter function public.transfer_stock(uuid, uuid, uuid, uuid, integer, uuid, text) set search_path = '';
alter function public.produce_product(uuid, uuid, uuid, integer, uuid) set search_path = '';
