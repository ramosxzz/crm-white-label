create table public.automation_round_robin_cursors (
  flow_id uuid not null references public.automation_flows(id) on delete cascade,
  block_id text not null,
  last_index int not null default -1,
  updated_at timestamptz not null default now(),
  primary key (flow_id, block_id)
);

alter table public.automation_round_robin_cursors enable row level security;

create policy automation_round_robin_cursors_tenant_all on public.automation_round_robin_cursors
  for all using (
    exists (
      select 1 from public.automation_flows f
      where f.id = automation_round_robin_cursors.flow_id
        and public.is_tenant_member(f.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.automation_flows f
      where f.id = automation_round_robin_cursors.flow_id
        and public.is_tenant_member(f.tenant_id)
    )
  );
