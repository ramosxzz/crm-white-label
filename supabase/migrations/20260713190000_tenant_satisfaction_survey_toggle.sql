alter table public.tenants
  add column if not exists satisfaction_survey_enabled boolean not null default false;

update public.tenants
set satisfaction_survey_enabled = true
where name = 'Atacado Moda Sul';
