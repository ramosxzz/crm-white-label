-- Cliente decidiu nao usar grupos do WhatsApp no CRM. Remove tudo relacionado:
-- trigger/funcao que sincronizava whatsapp_groups a partir dos webhook logs,
-- os indices dedicados a GROUP_MESSAGE, os proprios logs de grupo (que
-- guardavam o payload bruto e chegavam a dezenas de MB por linha - a causa
-- da lentidao/erro na tela de grupos) e as tabelas de grupo.

drop trigger if exists sync_whatsapp_group_from_message_log_trigger
  on public.whatsapp_webhook_logs;
drop function if exists public.sync_whatsapp_group_from_message_log();

drop index if exists public.whatsapp_group_message_external_id_uidx;
drop index if exists public.wwl_group_msg_idx;

delete from public.whatsapp_webhook_logs where event_type = 'GROUP_MESSAGE';

drop table if exists public.whatsapp_group_label_assignments;
drop table if exists public.whatsapp_group_labels;
drop table if exists public.whatsapp_groups;
