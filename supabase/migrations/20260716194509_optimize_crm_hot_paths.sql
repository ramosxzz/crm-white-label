-- Hot-path indexes for dashboard, chat list and app notifications.
-- These are intentionally narrow: they match the queries that showed up in
-- pg_stat_statements during the Supabase incident review.

create index if not exists messages_tenant_direction_created_idx
  on public.messages (tenant_id, direction, created_at desc);

create index if not exists messages_tenant_user_direction_created_idx
  on public.messages (tenant_id, user_id, direction, created_at desc);

create index if not exists leads_tenant_created_idx
  on public.leads (tenant_id, created_at desc);

create index if not exists leads_tenant_unassigned_created_idx
  on public.leads (tenant_id, created_at desc)
  where assigned_to is null;

create index if not exists leads_tenant_won_at_idx
  on public.leads (tenant_id, won_at desc)
  where won_at is not null;

create index if not exists conversations_tenant_last_message_idx
  on public.conversations (tenant_id, last_message_at desc)
  where last_message_at is not null;

create index if not exists pipeline_stages_tenant_position_idx
  on public.pipeline_stages (tenant_id, position);

create index if not exists pipeline_stages_tenant_pipeline_position_idx
  on public.pipeline_stages (tenant_id, pipeline_id, position);

create index if not exists pipelines_tenant_default_idx
  on public.pipelines (tenant_id, is_default);

create index if not exists whatsapp_accounts_tenant_active_idx
  on public.whatsapp_accounts (tenant_id, is_active)
  where is_active = true;

create index if not exists notifications_tenant_user_read_created_idx
  on public.notifications (tenant_id, user_id, is_read, created_at desc);

create index if not exists tasks_tenant_status_due_idx
  on public.tasks (tenant_id, status, due_at)
  where status = 'open';
