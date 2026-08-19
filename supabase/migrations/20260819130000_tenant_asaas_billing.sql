alter table public.tenants
  add column asaas_customer_id text,
  add column asaas_subscription_id text,
  add column subscription_price_cents integer;
