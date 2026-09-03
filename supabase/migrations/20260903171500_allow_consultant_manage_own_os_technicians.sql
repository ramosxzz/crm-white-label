-- Depois de liberar o trigger (migration anterior), a vendedora ainda
-- travava no passo seguinte de scheduleServiceOrder:
-- setServiceOrderTechniciansInternal faz delete+insert em
-- service_order_technicians, e a unica policy de escrita da tabela so
-- deixava owner/admin/gerente/atendente - sem excecao pra consultora dona
-- da propria OS, mesmo esse fluxo sendo intencional no codigo.
create policy service_order_technicians_consultant_own
on public.service_order_technicians
for all
using (
  is_tenant_member(tenant_id)
  and exists (
    select 1 from public.service_orders so
    where so.id = service_order_technicians.service_order_id
      and so.tenant_id = service_order_technicians.tenant_id
      and so.consultant_id = auth.uid()
  )
)
with check (
  is_tenant_member(tenant_id)
  and exists (
    select 1 from public.service_orders so
    where so.id = service_order_technicians.service_order_id
      and so.tenant_id = service_order_technicians.tenant_id
      and so.consultant_id = auth.uid()
  )
);
