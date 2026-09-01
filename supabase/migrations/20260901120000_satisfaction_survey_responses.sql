create table if not exists satisfaction_survey_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_name text,
  service_rating smallint check (service_rating between 1 and 5),
  nps_score smallint not null check (nps_score between 0 and 10),
  comments text,
  created_at timestamptz not null default now()
);

create index if not exists satisfaction_survey_responses_tenant_created_idx
  on satisfaction_survey_responses(tenant_id, created_at desc);

alter table satisfaction_survey_responses enable row level security;

create policy "tenant members read own survey responses"
  on satisfaction_survey_responses
  for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
