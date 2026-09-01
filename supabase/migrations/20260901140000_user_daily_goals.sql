create table if not exists user_daily_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  calls_made_target integer not null default 0,
  calls_answered_target integer not null default 0,
  meetings_scheduled_target integer not null default 0,
  meetings_attended_target integer not null default 0,
  closed_on_call_target integer not null default 0,
  closed_later_target integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

alter table user_daily_goals enable row level security;

create policy "tenant members read own tenant goals" on user_daily_goals
  for select using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

create policy "managers write tenant goals" on user_daily_goals
  for all using (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'gerente')
    )
  ) with check (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'gerente')
    )
  );
