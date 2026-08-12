-- Grupos do WhatsApp com contador atomico, realtime e escopo por numero.

alter table public.whatsapp_groups
  add column if not exists unread_count integer not null default 0
  check (unread_count >= 0);

-- Evolution pode reenviar o mesmo webhook varias vezes. Conserva a primeira
-- copia historica e remove apenas reentregas com a mesma identidade externa.
with repeated as (
  select
    id,
    row_number() over (
      partition by tenant_id, whatsapp_account_id, contact_lid, payload ->> 'external_id'
      order by created_at, id
    ) as occurrence
  from public.whatsapp_webhook_logs
  where event_type = 'GROUP_MESSAGE'
    and nullif(payload ->> 'external_id', '') is not null
)
delete from public.whatsapp_webhook_logs logs
using repeated
where logs.id = repeated.id
  and repeated.occurrence > 1;

create unique index if not exists whatsapp_group_message_external_id_uidx
  on public.whatsapp_webhook_logs (
    tenant_id,
    whatsapp_account_id,
    contact_lid,
    (payload ->> 'external_id')
  )
  where event_type = 'GROUP_MESSAGE'
    and nullif(payload ->> 'external_id', '') is not null;

create or replace function public.sync_whatsapp_group_from_message_log()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  message_direction text;
  message_time timestamptz;
begin
  if new.event_type is distinct from 'GROUP_MESSAGE' or new.contact_lid is null then
    return new;
  end if;

  message_direction := case
    when new.payload ->> 'direction' = 'outbound' or new.from_me is true then 'outbound'
    else 'inbound'
  end;

  begin
    message_time := coalesce(nullif(new.payload ->> 'message_at', '')::timestamptz, new.created_at);
  exception when others then
    message_time := new.created_at;
  end;

  update public.whatsapp_groups
  set
    whatsapp_account_id = coalesce(new.whatsapp_account_id, whatsapp_account_id),
    last_message_body = coalesce(nullif(new.payload ->> 'body', ''), last_message_body),
    last_message_direction = message_direction,
    last_message_at = message_time,
    last_event_at = message_time,
    last_event_type = 'GROUP_MESSAGE',
    unread_count = case
      when message_direction = 'outbound' then 0
      else unread_count + 1
    end,
    updated_at = now()
  where tenant_id = new.tenant_id
    and provider_group_id = new.contact_lid;

  return new;
end;
$$;

drop trigger if exists sync_whatsapp_group_from_message_log_trigger
  on public.whatsapp_webhook_logs;
create trigger sync_whatsapp_group_from_message_log_trigger
  after insert on public.whatsapp_webhook_logs
  for each row execute function public.sync_whatsapp_group_from_message_log();

-- Grupos seguem exatamente o mesmo escopo por numero do chat individual:
-- gestao ve tudo; vendedor ve numero proprio/compartilhado; atendente sem
-- numero proprio ve numeros sem responsavel e compartilhados.
drop policy if exists whatsapp_groups_tenant_select on public.whatsapp_groups;
create policy whatsapp_groups_tenant_select on public.whatsapp_groups
  for select
  using (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_role(
        tenant_id,
        array['owner', 'admin', 'gerente']::public.member_role[]
      )
      or exists (
        select 1
        from public.whatsapp_accounts wa
        where wa.id = whatsapp_groups.whatsapp_account_id
          and wa.tenant_id = whatsapp_groups.tenant_id
          and (
            wa.shared_with_all is true
            or wa.assigned_to = auth.uid()
            or (
              wa.assigned_to is null
              and public.has_tenant_role(
                whatsapp_groups.tenant_id,
                array['atendente']::public.member_role[]
              )
              and not exists (
                select 1
                from public.whatsapp_accounts owned
                where owned.tenant_id = whatsapp_groups.tenant_id
                  and owned.assigned_to = auth.uid()
              )
            )
          )
      )
    )
  );

drop policy if exists whatsapp_group_labels_tenant_select on public.whatsapp_group_labels;
create policy whatsapp_group_labels_tenant_select on public.whatsapp_group_labels
  for select using (public.is_tenant_member(tenant_id));

drop policy if exists whatsapp_group_label_assignments_tenant_select
  on public.whatsapp_group_label_assignments;
create policy whatsapp_group_label_assignments_tenant_select
  on public.whatsapp_group_label_assignments
  for select using (public.is_tenant_member(tenant_id));

-- Logs brutos tambem carregam o corpo completo da mensagem. Por isso seguem
-- o escopo do numero em todos os eventos, nao apenas em GROUP_MESSAGE.
drop policy if exists webhook_logs_tenant_select on public.whatsapp_webhook_logs;
create policy webhook_logs_tenant_select on public.whatsapp_webhook_logs
  for select
  using (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_role(
        tenant_id,
        array['owner', 'admin', 'gerente']::public.member_role[]
      )
      or whatsapp_account_id is null
      or exists (
        select 1
        from public.whatsapp_accounts wa
        where wa.id = whatsapp_webhook_logs.whatsapp_account_id
          and wa.tenant_id = whatsapp_webhook_logs.tenant_id
          and (
            wa.shared_with_all is true
            or wa.assigned_to = auth.uid()
            or (
              wa.assigned_to is null
              and public.has_tenant_role(
                whatsapp_webhook_logs.tenant_id,
                array['atendente']::public.member_role[]
              )
              and not exists (
                select 1
                from public.whatsapp_accounts owned
                where owned.tenant_id = whatsapp_webhook_logs.tenant_id
                  and owned.assigned_to = auth.uid()
              )
            )
          )
      )
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_groups'
  ) then
    alter publication supabase_realtime add table public.whatsapp_groups;
  end if;
end
$$;
