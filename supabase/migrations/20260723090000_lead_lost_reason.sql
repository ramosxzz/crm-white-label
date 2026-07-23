-- Motivo da desistencia: registrado quando o lead entra numa etapa de perda
-- (pipeline_stages.is_lost), pra mapear leads perdidos e motivos no fim do mes.
alter table public.leads add column if not exists lost_reason text;
