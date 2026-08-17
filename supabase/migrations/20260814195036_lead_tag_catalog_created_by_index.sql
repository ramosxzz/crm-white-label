create index lead_tag_catalog_created_by_idx
  on public.lead_tag_catalog (created_by)
  where created_by is not null;
