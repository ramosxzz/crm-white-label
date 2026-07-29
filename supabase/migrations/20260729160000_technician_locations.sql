-- Posicao ao vivo do tecnico (Fase 5b).
--
-- DECISOES DE PRIVACIDADE, de proposito e nao por simplificacao:
--
-- 1. Guarda SO A ULTIMA posicao de cada tecnico, nao o trajeto. A chave
--    primaria e (tenant_id, user_id) e a escrita e upsert. Rastrear onde o
--    funcionario esteve o dia inteiro e dado sensivel que a operacao nao
--    precisa: o que o administrativo pediu foi "onde ele esta agora".
--    Historico de deslocamento viraria passivo trabalhista sem contrapartida.
--
-- 2. Nao existe DELETE por politica de retencao porque nao ha o que reter -
--    cada envio sobrescreve o anterior.
--
-- 3. O corte por turno e feito na escrita (server action) e na leitura
--    (posicao velha nao e mostrada como ao vivo). Fora do expediente nada
--    entra.
create table public.technician_locations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  -- Raio de erro em metros que o proprio aparelho informa: serve pra a tela
  -- nao mostrar como exata uma posicao que veio de antena, nao de GPS.
  accuracy_meters double precision,
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index technician_locations_tenant_idx
  on public.technician_locations (tenant_id, recorded_at desc);

alter table public.technician_locations enable row level security;

-- O tecnico so escreve a propria posicao, e so no proprio tenant.
create policy "technician_locations_self_write" on public.technician_locations
  for all using (
    public.is_tenant_member(tenant_id) and user_id = auth.uid()
  )
  with check (
    public.is_tenant_member(tenant_id) and user_id = auth.uid()
  );

-- Leitura: gestao e administrativo. Vendedor e outros tecnicos nao veem a
-- posicao de ninguem - so a gestao que precisa coordenar o dia.
create policy "technician_locations_manage_read" on public.technician_locations
  for select using (
    public.has_tenant_role(
      tenant_id,
      array['owner','admin','gerente','atendente']::public.member_role[]
    )
  );

alter publication supabase_realtime add table public.technician_locations;
