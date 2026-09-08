-- Um atendimento pode envolver varias vendedoras - separa a nota por
-- funcionaria da resposta geral (NPS/comentarios), que fica 1x por envio.
create table if not exists satisfaction_survey_employee_ratings (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references satisfaction_survey_responses(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_name text not null,
  service_rating smallint not null check (service_rating between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists satisfaction_survey_employee_ratings_tenant_idx
  on satisfaction_survey_employee_ratings(tenant_id, employee_name);

alter table satisfaction_survey_employee_ratings enable row level security;

create policy "tenant members read own employee ratings"
  on satisfaction_survey_employee_ratings
  for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
