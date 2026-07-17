-- Prevent tenant leaks caused by two active WhatsApp connections sharing the
-- same provider-side identity. Phone numbers can be copied or stale; these ids
-- are the stable identities used by provider webhooks.

create unique index if not exists whatsapp_accounts_active_evolution_instance_uidx
  on public.whatsapp_accounts (lower(btrim(credentials ->> 'instance')))
  where provider = 'evolution'
    and is_active = true
    and nullif(btrim(credentials ->> 'instance'), '') is not null;

create unique index if not exists whatsapp_accounts_active_evolution_instance_id_uidx
  on public.whatsapp_accounts (lower(btrim(credentials ->> 'instance_id')))
  where provider = 'evolution'
    and is_active = true
    and nullif(btrim(credentials ->> 'instance_id'), '') is not null;

create unique index if not exists whatsapp_accounts_active_zapi_instance_uidx
  on public.whatsapp_accounts (lower(btrim(credentials ->> 'instance_id')))
  where provider = 'zapi'
    and is_active = true
    and nullif(btrim(credentials ->> 'instance_id'), '') is not null;

create unique index if not exists whatsapp_accounts_active_cloud_phone_number_uidx
  on public.whatsapp_accounts (btrim(credentials ->> 'phone_number_id'))
  where provider = 'cloud_api'
    and is_active = true
    and nullif(btrim(credentials ->> 'phone_number_id'), '') is not null;
