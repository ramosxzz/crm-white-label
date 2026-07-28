# Tenants — Solaire W+ CRM

Referência rápida por tenant. Uso: abrir conversa nova no Claude por tenant, colar contexto daqui pra não misturar histórico.

> ⚠️ **O deploy é automático.** `.github/workflows/ci.yml` roda em todo push pra `main`: build, testes, `rsync` pra VPS e `docker compose up --build`. **Dar push já é deployar** — não existe passo manual. Uma versão anterior deste arquivo dizia que as fases do ERP de campo "ainda não foram deployadas", o que era falso e custou tempo numa sessão seguinte. Se precisar segurar uma feature de um cliente, o controle é a **flag do tenant**, não o deploy.
>
> Variável de ambiente nova só entra em produção recriando o container — o `rsync` do CI não altera o `.env.production`:
> `ssh root@187.77.60.161`, depois `cd /opt/solaire-crm/app-src && docker compose -f docker-compose.vps.yml --env-file .env.production up -d app`.

## Avante Digital
- id: `1ff0bf3f-3f97-49a0-a411-232a74cf7d17` · slug: `empresa`
- Flags: `calls_dashboard_enabled=true`, resto padrão (sem estoque, sem disparo)
- Pipeline principal: `bb4b014d-ac23-458c-96ac-7f6d29b42bd9`
- Contexto ativo:
  - Automação "Avanço de etapa" (`8e62e083-fad0-4d5a-9102-087f58fcbf4e`) — cadência de tentativas (3 tentativas call+msg, follow up, "passei entregáveis"). v6 publicada 2026-07-28, 10 quick_messages novas cadastradas. Pendente: confirmar se "Toque de ativação (6h/12h)" deve mover etapa (hoje só manda msg, não move).
  - Atribuição de anúncio (Meta ad-referral) não mapeia lead vindo de anúncio — causa raiz: usam Evolution API (WhatsApp não-oficial), que não expõe dado de `externalAdReply`/ctwa. Só resolve migrando pra Cloud API oficial. Usuário já tem app Meta criado, configs de embedded signup levantadas (app_id/config_id), mas decidiu não migrar ainda.

## Demoact / ACT ("ACT Impermeabilizantes | Higienização de sofás")
- id: `54a6a18e-27f1-45c4-993b-42707a9f150b` · slug: `demoact`
- Ramo: impermeabilização e lavagem de estofados. Sede em **Sapucaia do Sul/RS** (Rua Marechal Deodoro, 90 — Centro, CEP 93220-640), não Porto Alegre. Opera com 5-6 técnicos em campo, 2 turnos, 3-4 OS por turno.
- Flags: `stock_enabled=true`, `broadcast_enabled=true`, `lead_assignment_enabled=true`, `field_service_enabled=` **`false`** (desligada em 2026-07-28 a pedido do usuário: o módulo não pode aparecer pra eles antes da reunião de apresentação de 2026-07-29).
- Usuários: owner `demoact@solairew.com`, gerente `michele@solairew.com`, vendedor `irisact@solairew.com.br`, técnico `acttecnico@gmail.com`.
- Contexto ativo — **ERP de serviço em campo**, construído em 3 fases, gated só pra eles:
  - Briefing de 18 perguntas respondido (2026-07-28). Definições: OS nasce da venda mas técnico faz upsell comissionado na casa do cliente; cliente = o lead (sem entidade separada); assinatura do cliente obrigatória; conferência do ADM depois do roteiro; app do técnico instalável, offline só pra ver OS + assinar; comissão de técnico só sobre upsell (dividida entre os presentes), 1% vendedora interna, comissão externa de loja parceira.
  - **Fase 1 — FEITA** (commit `0c8004d`): `/os` (lista + detalhe) e `/os/roteiro` (turnos × técnico). Tabelas `service_orders`, `service_order_items`, `service_order_technicians`, `service_order_damages`, `service_order_events`. Novo papel `tecnico`. Migrations `20260728140000`/`150000`/`160000`, já aplicadas em produção. **Já está em produção na VPS** (ver aviso de deploy no topo deste arquivo).
  - **Fase 2 — FEITA**: app do técnico em `/campo` (fora do grupo `(app)`, layout mobile próprio). Técnico é redirecionado pra lá no login — não entra no CRM. Offline via IndexedDB (`lib/field-service/offline.ts` + fila pura testada em `offline-queue.ts`), assinatura em canvas, foto de avaria com resize, upsell em campo. Roteirização em `lib/field-service/routing.ts` (Geocoding + Routes `optimizeWaypointOrder`) com botão "Otimizar rota" e "Sugerir técnico" no `/os/roteiro`. Migration `20260728170000` adiciona endereço base da empresa. **Já está em produção na VPS** (ver aviso de deploy no topo deste arquivo).
    - `GOOGLE_MAPS_API_KEY` é **server-only** — vai só no `.env.production` (o compose já faz `env_file`), **nunca** com prefixo `NEXT_PUBLIC_` nem como build arg do Docker.
    - Otimização de rota é **sob demanda por botão**, não no carregamento: cada clique é chamada paga.
    - Sem `field_service_base_address` cadastrado em Configurações, os botões de rota nem aparecem.
  - **Fase 3 — FEITA**: `/financeiro` (só owner/admin). `finance_entries` a pagar/receber com vencimento e conta fixa projetando o mês seguinte; `commissions` + `commission_rules` (percentuais editáveis na tela, não hardcoded). Migration `20260728180000`. **Já está em produção na VPS** (ver aviso de deploy no topo deste arquivo).
    - Faturar não é só mudar status: `conferida → faturada` chama a função Postgres `bill_service_order`, que gera o lançamento a receber **e** as comissões numa transação só. Meio caminho aqui deixaria comissão sem faturamento no fechamento do mês.
    - Técnico comissiona **só sobre o upsell aprovado**, dividido entre os técnicos presentes (sobra de centavo vai pros primeiros). Vendedora interna sobre o total, loja parceira só quando há indicação.
    - Faturar duas vezes é recusado (a função exige status `conferida`), e há unique em `(OS, papel, pessoa)` nas comissões.
  - **FASE 4 — escopo definido, nada construído ainda.** Os 4 itens da foto da OS de papel foram **respondidos por áudio pelo cliente em 2026-07-28**:
    1. **Tabela de preço** — eles **já têm** as tabelas (Imper / Lavagem / Couro) com valores padronizados. O preço pode ser alterado na negociação, mas **abaixo da tabela exige autorização**. Ou seja: não é só catálogo, é catálogo **+ fluxo de aprovação de desconto**. É o item maior, e o peso está na aprovação, não no cadastro. Falta definir: quem autoriza (owner/admin? gerente?) e se a OS trava aguardando ou segue com a autorização registrada depois.
    2. **Parcelamento** — eles já têm as formas de pagamento cadastradas e existe **valor mínimo de parcela** a respeitar. Hoje `bill_service_order` gera **1** lançamento a receber; precisa gerar N parcelas. ⚠️ Mexer nessa função é o ponto mais delicado do sistema (faturamento + comissões na mesma transação).
    3. **Deslocamento** — o trecho do áudio ficou com ruído e **não foi possível recuperar**. Assumido: campo próprio na OS (é o que a OS de papel mostra, e evita poluir a base de comissão do upsell). **Confirmar com o cliente antes de construir.**
    4. **Horário da visita** — ✅ **nada a fazer.** Confirmaram que fica no turno manhã/tarde, como já está.
  - **Estoque saiu da prioridade** (dito pelo cliente em 2026-07-28): "não é tão relevante nesse primeiro momento". Volta depois, e o objetivo declarado é controlar **valor gasto de produto**. Hoje peças da OS não baixam do estoque (itens são texto livre, não movimentam `products`).
  - ⚠️ **"Integração com o ERP" no áudio do cliente NÃO é sistema externo.** O "ERP" é este próprio módulo de serviço em campo que estamos construindo pra eles. "Boa comunicação entre o CRM e o ERP" = OS nascendo da venda e cliente = lead, que é como já foi feito. Não existe integração com terceiro no escopo.
  - Preço do módulo ainda **não fechado** com o cliente (base atual: R$1.000 implantação + R$199/mês só do CRM).
  - Já usa disparo em massa (`/disparos`).

## Solaire W+ (produto próprio)
- id: `69c7ddb6-db56-4d5e-8f9e-709e75bbb177` · slug: `-olaire-`
- Flags: `stock_enabled=true`, `field_service_enabled=true`
- Tenant "casa" — usado pra testar features novas (estoque multi-local, funil, SLA) antes de liberar geral.
- **Ambiente de demonstração do ERP de campo** montado em 2026-07-28 pra apresentação ao ACT:
  - Endereço-base = o do ACT (Rua Marechal Deodoro, 90, Sapucaia do Sul), de propósito, pra a rota ter geografia coerente com a operação deles.
  - `commission_rules`: técnico 10%, vendedora interna 1%, loja parceira 5% (mesmos do ACT).
  - Técnicos de teste: `tecnicoteste@solairew.com.br`, `tecnico2teste@solairew.com.br`.
  - 5 OS de demonstração já geocodificadas: OS-0002/0003/0004 `agendada` pra 2026-07-29 manhã (3 paradas pra demonstrar "Otimizar rota"), OS-0005 `concluida` com assinatura (pra demonstrar a conferência do ADM), OS-0006 `conferida` com upsell e 2 técnicos (pra faturar ao vivo e ver comissão dividida). `/financeiro` começa zerado de propósito.
  - **É dado de demonstração — apagar quando não precisar mais.**

## Fase 5 — mapa pro administrativo (pedido novo, 2026-07-28)
Pedido do usuário: o administrativo do ACT (Tiago) quer acompanhar os técnicos num mapa. Decidido fazer **em duas fases**:
- **5a — mapa das OS do dia**: paradas do turno plotadas, ordem da rota, pino com cliente/serviço/status. `service_orders.lat/lng` já existem e já são geocodificados, então é trabalho de tela. Formato pedido: **um mapa só**, com os técnicos distinguíveis entre si e possibilidade de isolar um de cada vez — não um mapa por técnico.
- **5b — rastreamento ao vivo**: posição do técnico atualizando sozinha. Exige o app `/campo` enviar GPS periodicamente, tabela nova de posições, tratamento de bateria/sinal, e **alinhamento trabalhista com o cliente** (rastrear funcionário precisa ser comunicado e limitado ao turno). Só depois de 5a.

⚠️ **Armadilha de chave nesta fase:** mapa interativo no browser exige chave exposta no client. **Não reusar a `GOOGLE_MAPS_API_KEY` do servidor.** Opções: (1) segunda chave restrita por referrer HTTP, (2) Maps Static API renderizada no servidor (chave segue escondida, mas sem zoom/arrastar), (3) Leaflet + OpenStreetMap, sem chave e sem custo. Não decidido ainda.

## Validação do faturamento (2026-07-28)
`bill_service_order` foi exercitado em produção com centavo quebrado e conferido número por número. Total R$1.500,05, upsell R$300,05, 2 técnicos:
- a receber R$1.500,05 · técnico principal R$15,01 · segundo técnico R$15,00 (pool R$30,01, sobra do centavo vai pro primeiro, nada some nem é criado) · vendedora R$15,00 (1% do total) · loja parceira R$75,00 (5% do total) · OS → `faturada`.
- Faturar de novo devolve `P0001: So da pra faturar uma OS conferida (status atual: faturada)`. A trava é do banco, não da UI — clique duplo ou chamada direta na API não duplica comissão.
- Base do técnico é **só o upsell aprovado**, confirmado na prática (se fosse o total daria R$150 em vez de R$30).

## Google Maps
- `GOOGLE_MAPS_API_KEY` configurada no `.env.production` da VPS em 2026-07-28. **Geocoding API e Routes API ambas testadas e funcionando** do servidor.
- Armadilha já vivida: ter a chave não basta. A **Routes API precisa estar habilitada no projeto do Google Cloud** e liberada nas restrições de API da chave — antes disso ela devolvia `403 API_KEY_SERVICE_BLOCKED` e só "Otimizar rota" quebrava, com o Geocoding funcionando normalmente.
- ⚠️ A chave foi exposta em texto aberto num chat. **Restringir por IP (`187.77.60.161`) no Google Cloud continua pendente** — enquanto não for feita, qualquer um que a tenha gera custo de billing.

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
