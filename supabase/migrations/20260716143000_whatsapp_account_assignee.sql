alter table public.whatsapp_accounts
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create index if not exists whatsapp_accounts_assigned_to_idx
  on public.whatsapp_accounts (tenant_id, assigned_to)
  where assigned_to is not null;
