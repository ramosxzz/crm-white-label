-- Agenda visual (hora x tecnico) pro ACT. O sistema de papel que eles usavam
-- antes ja tinha horario exato (Inicio 10:30 / Fim 11:30) e confirmacao com
-- contato + data/hora - confirmado por print do sistema antigo. shift
-- (manha/tarde) continua existindo e sendo a fonte de verdade pro roteiro,
-- mapa e otimizacao de rota (63 usos espalhados, nao vale a pena trocar);
-- os campos novos sao so pra desenhar a grade da agenda por cima do que ja
-- existe.
alter table public.service_orders
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_contact_name text,
  add column if not exists has_pending_issue boolean not null default false,
  add column if not exists pending_issue_note text;

create index if not exists service_orders_tenant_scheduled_start_idx
  on public.service_orders (tenant_id, scheduled_start_at);
