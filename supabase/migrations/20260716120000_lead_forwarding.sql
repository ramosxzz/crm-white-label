-- "Modo ausente": quando o dono sai (visitas, compras), novos leads sao
-- encaminhados automaticamente para um vendedor especifico. NULL = desligado
-- (comportamento normal: lead cai na fila / round-robin).
alter table public.tenants
  add column if not exists lead_forward_user_id uuid references auth.users(id) on delete set null;
