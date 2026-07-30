-- Vendedora passa a ver o roteiro do dia (pauta da reuniao de 2026-07-29:
-- "a vendedora tem que ter acesso as rotas, pra que ela consiga ver o trajeto").
--
-- Antes ela so via as OS que ela mesma vendeu. Na tela de roteiro isso dava um
-- resultado pior que nada: o tecnico aparecia com 2 paradas quando tinha 6, e
-- o trajeto desenhado nao era o trajeto real.
--
-- A liberacao e restrita a OS **agendada** (service_date preenchido), que e o
-- que compoe a rota. Rascunho e negociacao em aberto de outra vendedora
-- continuam invisiveis pra ela - o que ela ganha e a visao do dia em campo,
-- nao a carteira dos colegas.
drop policy if exists "service_orders_select" on public.service_orders;

create policy "service_orders_select" on public.service_orders
  for select using (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_role(tenant_id, array['owner','admin','gerente','atendente']::public.member_role[])
      or consultant_id = auth.uid()
      or created_by = auth.uid()
      or public.is_service_order_technician(id, auth.uid())
      -- Vendedora: enxerga o roteiro, ou seja, o que ja tem dia marcado.
      or (
        service_date is not null
        and public.has_tenant_role(tenant_id, array['vendedor']::public.member_role[])
      )
    )
  );
