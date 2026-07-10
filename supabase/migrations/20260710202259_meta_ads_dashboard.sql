alter table public.tenants
  add column if not exists meta_ads_access_token text;
