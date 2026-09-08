create table if not exists satisfaction_survey_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  slug text not null unique,
  title text not null,
  subtitle text,
  employees jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table satisfaction_survey_responses add column if not exists channel text;

alter table satisfaction_survey_forms enable row level security;

create policy "tenant members read own survey forms"
  on satisfaction_survey_forms
  for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
