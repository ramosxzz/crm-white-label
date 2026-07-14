-- IA W+: agente de IA conversacional configuravel por tenant, responde
-- automaticamente no WhatsApp quando ninguem da equipe assumiu a conversa.

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null default 'IA W+',
  system_prompt text not null default '',
  model text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index on public.ai_agents (tenant_id);

create trigger ai_agents_touch
  before update on public.ai_agents
  for each row execute function public.touch_updated_at();

alter table public.ai_agents enable row level security;

create policy "tenant members read ai agent"
  on public.ai_agents for select
  using (is_tenant_member(tenant_id));

create policy "tenant admins manage ai agent"
  on public.ai_agents for all
  using (has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

-- Marca mensagens respondidas automaticamente pelo agente, para exibir na UI do chat.
alter table public.messages
  add column if not exists is_ai_generated boolean not null default false;
