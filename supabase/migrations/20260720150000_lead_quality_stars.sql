alter table public.leads
  add column quality_stars smallint not null default 0 check (quality_stars between 0 and 5);
