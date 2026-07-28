-- Endereco base da empresa: ponto de partida e de retorno do roteiro dos
-- tecnicos. Sem isso a otimizacao teria que assumir a primeira parada como
-- origem, o que nao reflete a operacao (os tecnicos saem da loja).
--
-- lat/lng ficam gravados pra nao pagar geocoding do Google a cada roteiro.

alter table public.tenants
  add column if not exists field_service_base_address text,
  add column if not exists field_service_base_lat double precision,
  add column if not exists field_service_base_lng double precision;
