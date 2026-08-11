create table if not exists public.meta_data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  external_user_id_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.meta_data_deletion_requests enable row level security;

revoke all on table public.meta_data_deletion_requests from anon, authenticated;
grant select, insert, update on table public.meta_data_deletion_requests to service_role;

comment on table public.meta_data_deletion_requests is
  'Audit trail for Meta Platform data-deletion callbacks. Accessible only with service role.';
