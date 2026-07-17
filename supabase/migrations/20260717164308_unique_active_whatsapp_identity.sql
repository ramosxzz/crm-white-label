-- Extra guard against cross-tenant WhatsApp leaks.
-- The previous guard indexes each known key separately. This normalized index
-- also blocks a duplicate where one row stores the same Evolution identity in
-- "instance" and another stores it in "instance_id".

create unique index if not exists whatsapp_accounts_active_evolution_identity_uidx
  on public.whatsapp_accounts (
    lower(nullif(btrim(coalesce(credentials ->> 'instance', credentials ->> 'instance_id')), ''))
  )
  where provider = 'evolution'
    and is_active = true
    and nullif(btrim(coalesce(credentials ->> 'instance', credentials ->> 'instance_id')), '') is not null;

create unique index if not exists whatsapp_accounts_active_cloud_identity_uidx
  on public.whatsapp_accounts (
    nullif(btrim(coalesce(credentials ->> 'phone_number_id', credentials ->> 'phoneNumberId')), '')
  )
  where provider = 'cloud_api'
    and is_active = true
    and nullif(btrim(coalesce(credentials ->> 'phone_number_id', credentials ->> 'phoneNumberId')), '') is not null;

create index if not exists whatsapp_accounts_active_provider_identity_lookup_idx
  on public.whatsapp_accounts (provider, tenant_id)
  where is_active = true;
