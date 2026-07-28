# Tenants — Solaire W+ CRM

Referência rápida por tenant. Uso: abrir conversa nova no Claude por tenant, colar contexto daqui pra não misturar histórico.

## Avante Digital
- id: `1ff0bf3f-3f97-49a0-a411-232a74cf7d17` · slug: `empresa`
- Flags: `calls_dashboard_enabled=true`, resto padrão (sem estoque, sem disparo)
- Pipeline principal: `bb4b014d-ac23-458c-96ac-7f6d29b42bd9`
- Contexto ativo:
  - Automação "Avanço de etapa" (`8e62e083-fad0-4d5a-9102-087f58fcbf4e`) — cadência de tentativas (3 tentativas call+msg, follow up, "passei entregáveis"). v6 publicada 2026-07-28, 10 quick_messages novas cadastradas. Pendente: confirmar se "Toque de ativação (6h/12h)" deve mover etapa (hoje só manda msg, não move).
  - Atribuição de anúncio (Meta ad-referral) não mapeia lead vindo de anúncio — causa raiz: usam Evolution API (WhatsApp não-oficial), que não expõe dado de `externalAdReply`/ctwa. Só resolve migrando pra Cloud API oficial. Usuário já tem app Meta criado, configs de embedded signup levantadas (app_id/config_id), mas decidiu não migrar ainda.

## Demoact / ACT ("Minha Empresa")
- id: `54a6a18e-27f1-45c4-993b-42707a9f150b` · slug: `demoact`
- Ramo: impermeabilização e lavagem de estofados (Porto Alegre/RS). Opera com 5-6 técnicos em campo, 2 turnos, 3-4 OS por turno.
- Flags: `stock_enabled=true`, `broadcast_enabled=true`, `lead_assignment_enabled=true`, `field_service_enabled=true`
- Contexto ativo — **ERP de serviço em campo**, construído em 3 fases, gated só pra eles:
  - Briefing de 18 perguntas respondido (2026-07-28). Definições: OS nasce da venda mas técnico faz upsell comissionado na casa do cliente; cliente = o lead (sem entidade separada); assinatura do cliente obrigatória; conferência do ADM depois do roteiro; app do técnico instalável, offline só pra ver OS + assinar; comissão de técnico só sobre upsell (dividida entre os presentes), 1% vendedora interna, comissão externa de loja parceira.
  - **Fase 1 — FEITA** (commit `0c8004d`): `/os` (lista + detalhe) e `/os/roteiro` (turnos × técnico). Tabelas `service_orders`, `service_order_items`, `service_order_technicians`, `service_order_damages`, `service_order_events`. Novo papel `tecnico`. Migrations `20260728140000`/`150000`/`160000`, já aplicadas em produção. **Ainda não deployada na VPS.**
  - **Fase 2 — a fazer**: app do técnico (`/campo`), PWA com ícone, offline via IndexedDB + fila de escrita, assinatura em canvas, foto de avaria, roteirização via Google Routes (`optimizeWaypointOrder`) + sugestão de melhor técnico por acréscimo de distância. Chave do Google Maps entra como `GOOGLE_MAPS_API_KEY` **server-only** (nunca `NEXT_PUBLIC_`).
  - **Fase 3 — a fazer**: financeiro (`finance_entries` a pagar/receber com recorrência pro mês seguinte), `commissions` + `commission_rules`, fluxo concluída → conferida → faturada gerando lançamento e comissões numa transação.
  - Preço do módulo ainda **não fechado** com o cliente (base atual: R$1.000 implantação + R$199/mês só do CRM).
  - Já usa disparo em massa (`/disparos`).

## Solaire W+ (produto próprio)
- id: `69c7ddb6-db56-4d5e-8f9e-709e75bbb177` · slug: `-olaire-`
- Flags: `stock_enabled=true`
- Tenant "casa" — usado pra testar features novas (estoque multi-local, funil, SLA) antes de liberar geral.

## Outros tenants (produção/teste, sem pendência ativa registrada)
| Nome | id | slug | Observação |
|---|---|---|---|
| Megas Perini Teste Local | `5342094d-f9dc-4a30-9250-0a3e99bd1e87` | `egas-erini-este-ocal` | ambiente de teste |
| Megas Perini | `b4afcefa-0041-413e-b4c4-6b9997d7ee07` | `egas-erini` | produção |
| Solaire Review Account | `46a1cda0-2ed0-476e-ab30-72d5c606b165` | `olaire-eview-ccount` | conta de revisão |
| Solaire Demo | `d2fa9b25-484a-42b0-95af-98e2c4e69234` | `olaire-emo` | demo |
| Solaire Demo | `d2ef833d-1294-464e-a067-228013a2dab5` | `olaire-emo-1` | demo (duplicado) |
| Super Banda Choppão | `359fdb87-4f4a-4e66-b62b-9798a1ac1d44` | `uper-anda-hopp-o` | produção |
| Vasos Fortuna | `fd0f666f-e303-4694-aa51-1190740c3d12` | `nunes-vasosfortuna` | produção |
| Atacado Moda Sul | `ec219bae-9fc8-44d8-b027-95811aa1897d` | `atacadomodasul7` | produção |
| Solaire Energia Solar | `4ef4b668-d2ea-43a6-bcb8-9f6cb076735d` | `solairesolar` | produção, sem estoque |

## Flags globais existentes (toggle por tenant)
`stock_enabled`, `broadcast_enabled`, `calls_dashboard_enabled`, `satisfaction_survey_enabled`, `lead_assignment_enabled`, `field_service_enabled`.

Checklist de fiação de uma flag nova, na ordem: migration → `Tenant` em `lib/supabase/database.types.ts` → `settings/actions.ts` (input + update + `revalidatePath`) → `settings/tenant-form.tsx` (state + submit + bloco do toggle) → `app/(app)/layout.tsx` (prop) → `components/app/sidebar.tsx` → `components/app/mobile-bottom-nav.tsx` → guarda na página e nas actions.

## Papéis (`member_role`)
`owner`, `admin`, `gerente`, `atendente`, `vendedor`, `tecnico`.

⚠️ Ao adicionar papel novo, conferir `lib/auth/roles.ts` e qualquer `ctx.role === "vendedor"` espalhado: checagem **negativa** (`role !== "vendedor"`) deixa o papel novo passar por acidente. Usar sempre allowlist.

---
*Atualizar esse arquivo quando abrir/fechar pendência de algum tenant, pra próxima conversa pegar o contexto certo.*
