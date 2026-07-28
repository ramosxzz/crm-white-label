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
- Flags: `stock_enabled=true`, `broadcast_enabled=true`
- Contexto ativo:
  - Pediram ERP de serviço completo: cadastro, agendamento, financeiro, app técnico (roteiro/foto/OS). Decisão: construir gated só pra esse tenant (toggle novo, igual `broadcast_enabled`), não pro sistema todo.
  - Status: briefing de perguntas já enviado pro cliente, **aguardando respostas** — nada implementado ainda.
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
`stock_enabled`, `broadcast_enabled`, `calls_dashboard_enabled` — mesmo padrão a seguir se ACT precisar de módulo exclusivo (ex: `field_service_enabled`).

---
*Atualizar esse arquivo quando abrir/fechar pendência de algum tenant, pra próxima conversa pegar o contexto certo.*
