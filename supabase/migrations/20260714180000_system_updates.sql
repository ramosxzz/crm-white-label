create table if not exists public.system_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

alter table public.system_updates enable row level security;

create policy "system_updates_select_authenticated"
  on public.system_updates for select
  to authenticated
  using (true);

alter table public.profiles
  add column if not exists last_seen_update_at timestamptz not null default now();
