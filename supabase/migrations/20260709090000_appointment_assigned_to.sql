alter table public.appointments
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create index if not exists appointments_assigned_to_idx
  on public.appointments (tenant_id, assigned_to, starts_at);
