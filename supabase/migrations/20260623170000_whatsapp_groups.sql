-- Tabelas de grupos do WhatsApp (chegaram direto em producao sem migration
-- versionada; recriadas aqui com "if not exists" pra nao afetar producao e
-- destravar ambientes novos/branches).

create table if not exists public.whatsapp_groups (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null,
  provider_group_id text not null,
  subject text not null,
  description text,
  owner_jid text,
  participant_count int,
  last_event_type text,
  last_event_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider_group_id)
);

create index if not exists whatsapp_groups_tenant_updated_idx
  on public.whatsapp_groups (tenant_id, updated_at desc);

alter table public.whatsapp_groups enable row level security;

create table if not exists public.whatsapp_group_labels (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  color text not null default '#7c3aed',
  created_at timestamptz not null default now()
);

create unique index if not exists whatsapp_group_labels_tenant_name_idx
  on public.whatsapp_group_labels (tenant_id, lower(name));

alter table public.whatsapp_group_labels enable row level security;

create table if not exists public.whatsapp_group_label_assignments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null references public.whatsapp_groups(id) on delete cascade,
  label_id uuid not null references public.whatsapp_group_labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, label_id)
);

create index if not exists whatsapp_group_label_assignments_tenant_idx
  on public.whatsapp_group_label_assignments (tenant_id);

alter table public.whatsapp_group_label_assignments enable row level security;
