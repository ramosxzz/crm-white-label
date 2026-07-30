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
  - Atribuição de anúncio (Meta ad-referral) não mapeia lead vindo de anúncio — causa raiz: usam Evolution API (WhatsApp não-oficial), que não expõe dado de `externalAdReply`/ctwa. Migrar pra Cloud API oficial resolveria na raiz; usuário tem app Meta criado e configs de embedded signup levantadas, mas decidiu não migrar.
  - **Contornado em 2026-07-29 sem migrar**: o tráfego já usa um emoji distinto no texto de abertura de cada criativo, e agora o CRM lê esse emoji (Configurações → "Criativos por emoji"). Saiu de **1 lead atribuído em 754** para **367**. 12 regras cadastradas, ainda com nomes provisórios ("Criativo ⌚ (renomear)") — só a Avante sabe qual anúncio é cada emoji. As de cidade (`🏙️` + texto) já estão nomeadas.
  - ⚠️ **Atribuir lead funcionou; atribuir venda ainda não.** Das 35 vendas (todas de 20-28/07), só 1 veio de lead com emoji. As primeiras mensagens de quem comprou são "Boa tarde", "Oii", "Opa" — ou quem fecha chega por outro caminho, ou chega pelo anúncio e fala noutro momento. **Não prometer painel de criativo que vendeu** até acumular dado novo. Se continuar 1 em 35, a informação é sobre o funil deles, não sobre o sistema.
  - Histórico de 60 dias preenchido pelo `scripts/backfill-ad-signatures.mjs`; os 366 leads têm `custom_fields.meta_attribution_source = 'emoji_signature_backfill'`, então dá pra desfazer por esse marcador.
  - O evento `Purchase` pro Meta CAPI já dispara ao ganhar (kanban, chat, ligações e leads — todos passam por `updateLead`), e a Avante já tem pixel e token configurados. O que a Meta usa pra creditar é o telefone com hash; o `meta_ad_id` vai como propriedade personalizada, então **não prometer que ele direciona atribuição dentro do gerenciador**.
  - **Telefones internacionais corrigidos em 2026-07-30**: a entrada do webhook, o cadastro manual e a lista de conversas validavam exclusivamente DDI 55. Agora aceitam E.164 internacional sem alterar a normalização dos números brasileiros. O caso reportado `+1 (617) 750-8340` foi recuperado no lead `daniel` (`16177508340`) dentro do tenant da Avante.

## Demoact / ACT ("ACT Impermeabilizantes | Higienização de sofás")
- id: `54a6a18e-27f1-45c4-993b-42707a9f150b` · slug: `demoact`
- Ramo: impermeabilização e lavagem de estofados. Sede em **Sapucaia do Sul/RS** (Rua Marechal Deodoro, 90 — Centro, CEP 93220-640), não Porto Alegre. Opera com 5-6 técnicos em campo, 2 turnos, 3-4 OS por turno.
- Flags em produção: `stock_enabled=true`, `broadcast_enabled=true`, `lead_assignment_enabled=true`, `field_service_enabled=true`.
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
  - **FASE 4 — FEITA em 2026-07-30.** Os 4 itens da foto da OS de papel foram **respondidos por áudio pelo cliente em 2026-07-28**:
    1. **Tabela de preço** — catálogo configurável por Lavagem / Impermeabilização / Couro / Outro, integrado aos itens da OS. Preço abaixo da tabela exige aprovação de `owner`, `admin` ou `gerente`.
    2. **Parcelamento** — cada forma configura número de parcelas, taxa e parcela mínima. `bill_service_order` gera N títulos mensais sem perder centavos e mantém faturamento + comissões na mesma transação.
    3. **Deslocamento** — campo próprio em R$ na OS, separado da base de upsell.
    4. **Horário da visita** — ✅ **nada a fazer.** Confirmaram que fica no turno manhã/tarde, como já está.
  - **Entrada da OS pelo chat (2026-07-29)**: botão de chave inglesa no cabeçalho do chat do WhatsApp abre a OS já com o lead travado, sem passar pelo `/os`. Aparece só com `field_service_enabled` ligada **e** papel em `canManageServiceOrders` (vendedor não vê). Vale pra qualquer tenant do ERP, não só ACT. Serve o "OS nasce da venda" do briefing pelo caminho que a Iris usa de fato.
  - **CEP autopreenche o endereço (2026-07-29)**: 8 dígitos no CEP puxam rua/bairro/cidade/UF do ViaCEP e o foco pula pro número. API pública, sem chave e sem custo — **não gasta cota do Google**, que continua só pra geocoding e rota. CEP não encontrado ou fora do ar só avisa; digitar na mão continua valendo.
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
- **5a — FEITA (2026-07-29)**: `/os/mapa`, um mapa só, filtro de turno + chip por técnico (clicar isola, clicar de novo volta pra todos). Pino numerado com a posição na rota, cor por técnico, popup com cliente/OS/status/valor e link pra OS; base da empresa marcada. Linha tracejada liga as paradas na ordem — **é traço reto entre pontos, não o caminho pelas ruas**, porque o trajeto real exigiria a Routes API paga e aqui o que importa é a sequência. Só entra OS já geocodificada; a tela avisa quantas ficaram de fora.
- **5b — rastreamento ao vivo**: posição do técnico atualizando sozinha. Exige o app `/campo` enviar GPS periodicamente, tabela nova de posições, tratamento de bateria/sinal, e **alinhamento trabalhista com o cliente** (rastrear funcionário precisa ser comunicado e limitado ao turno). Só depois de 5a.

✅ **Armadilha de chave resolvida escolhendo a opção sem chave.** O mapa é MapLibre GL + **OpenFreeMap** (`tiles.openfreemap.org`, tiles de OpenStreetMap, sem cadastro, sem chave, liberado pra uso comercial). **Nenhuma chave vai pro client e o Google não é chamado nesta tela** — verificado no browser: zero requisições a domínio Google. Trocar de basemap é trocar uma URL em `BASEMAP_STYLES` (`app/(app)/os/mapa/map-canvas.tsx`).

⚠️ **O mapa exige WebGL2, e nem toda máquina tem.** Aconteceu de verdade em 2026-07-29: `GPUInitializationError: WebGL2 is required to display this map`, lançado de dentro de um efeito, derrubava a tela inteira no error boundary da rota. Causas comuns: aceleração de hardware desligada no navegador, vídeo antigo em micro de escritório, VM sem GPU, extensão de privacidade bloqueando canvas — exatamente o perfil do administrativo. Agora `supportsWebGL2()` (`lib/browser/webgl.ts`) checa antes de montar e, se não houver, a tela cai pra `StopsFallback`: as mesmas paradas em lista, na ordem da rota, com os filtros funcionando. Um `MapBoundary` segura qualquer outra falha do mapa no tamanho do próprio mapa. **Testado negando WebGL2 no navegador.**

⚠️ **O "mapa borrado" era o próprio aviso de carregamento.** O componente mapcn cobria o mapa inteiro com `backdrop-blur` até o evento `load` do MapLibre. Esse evento exige estilo **e** primeiras tiles desenhadas, e não chega quando a GPU é lenta, a aba não está pintando (`requestAnimationFrame` parado) ou um tile demora — aí o desfoque fica permanente e o usuário vê um borrão com três pontinhos, achando que o mapa não carregou. O mapa estava desenhado embaixo o tempo todo. Agora o aviso é uma pílula de canto, não bloqueia clique, sai com `load`/`idle`/`render` ou com timeout de 5s.

⚠️ **O "mapa preto" era o estilo `dark` do OpenFreeMap, não bug de renderização.** Ele desenha preto sobre preto: fundo `rgb(12,12,12)`, água `rgb(27,27,29)` (17 tons de diferença) e via na **mesma cor do fundo**. O mapa renderizava certo e parecia um retângulo preto com os pinos boiando. Trocado por `fiord` (fundo `#45516E`, vias em tons distintos, rótulos claros). Estilos disponíveis e contraste água↔fundo: `positron` 48 · `liberty` alto · `bright` alto · `fiord` alto · **`dark` 17 (não usar)**. Ao trocar de basemap, medir contraste antes — o mapa é ferramenta de trabalho, legibilidade vale mais que combinar com o tema.

⚠️ **Não dá pra validar renderização de mapa pelo navegador embutido do Claude Code**: o painel não compõe frames, então `requestAnimationFrame` não roda e o MapLibre nunca pinta — o mapa parece quebrado mesmo estando certo. Dá pra checar DOM, rede e estado; pra ver pixel, tem que ser em navegador real.

⚠️ **Pegadinha do componente do mapa:** `components/ui/mapcn-map-marker.tsx` exporta um componente chamado `Map`, que **sombreia o `Map` nativo do JavaScript**. Um `new Map()` no mesmo arquivo vira `new (componente)()` e quebra em runtime — já aconteceu e custou uma sessão de debug. Importar sempre com alias: `import { Map as MapView } from ...`.

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

## Instalação de dependências (armadilha resolvida em 2026-07-29)
O projeto tinha um `.npmrc` com `legacy-peer-deps=true` (adicionado em 26/06 por um problema de build do Cloudflare), mas **o Dockerfile não copia o `.npmrc`** — só `package.json` e `package-lock.json`. Os dois lados resolviam diferente:
- `npm install` local **apagava as peer deps do lock** — sumiam `webpack`, `@webassemblyjs/*` e mais 40 pacotes.
- `npm ci` do Docker rodava estrito e falhava com `Missing: webpack@... from lock file`.
- Pior: o `npm run build` local **não pegava** (o `node_modules` já está populado) e o `npm ci` do CI também não, porque o CI enxerga o `.npmrc`. Só o container quebrava — deploy caiu com o CI verde.

**Resolvido**: o `.npmrc` foi removido (verificado que a resolução estrita passa sem `ERESOLVE`, então a flag não era mais necessária). Local, CI e Docker agora resolvem igual, e o `npm install` normal já gera lock válido.

Além disso o CI ganhou o passo **"Validar package-lock como o Docker instala"**: copia `package.json` + `package-lock.json` pra uma pasta limpa e roda `npm ci --omit=dev --dry-run`. Testado contra o lock que derrubou o deploy — reprova. Se alguém reintroduzir um `.npmrc` (ou qualquer config que mude a resolução), quebra no CI em vez de quebrar no deploy.

## Flags globais existentes (toggle por tenant)
`stock_enabled`, `broadcast_enabled`, `calls_dashboard_enabled`, `satisfaction_survey_enabled`, `lead_assignment_enabled`, `field_service_enabled`.

⚠️ `field_service_enabled` aparece pro cliente como **"ERP W+"** em Configurações (renomeado em 2026-07-29). A coluna, a flag e os nomes no código seguem `field_service_*` — só o rótulo mudou.

Checklist de fiação de uma flag nova, na ordem: migration → `Tenant` em `lib/supabase/database.types.ts` → `settings/actions.ts` (input + update + `revalidatePath`) → `settings/tenant-form.tsx` (state + submit + bloco do toggle) → `app/(app)/layout.tsx` (prop) → `components/app/sidebar.tsx` → `components/app/mobile-bottom-nav.tsx` → guarda na página e nas actions.

## Papéis (`member_role`)
`owner`, `admin`, `gerente`, `atendente`, `vendedor`, `tecnico`.

⚠️ Ao adicionar papel novo, conferir `lib/auth/roles.ts` e qualquer `ctx.role === "vendedor"` espalhado: checagem **negativa** (`role !== "vendedor"`) deixa o papel novo passar por acidente. Usar sempre allowlist.

---
*Atualizar esse arquivo quando abrir/fechar pendência de algum tenant, pra próxima conversa pegar o contexto certo.*

## Fase 5b — posição ao vivo do técnico (feita em 2026-07-29)
Tabela `technician_locations`, uma linha por técnico (`primary key (tenant_id, user_id)`), gravada por upsert.

⚠️ **Guarda só a posição atual, nunca o trajeto** — e isso é decisão, não simplificação. O administrativo pediu "onde ele está agora"; histórico de deslocamento de funcionário é dado sensível que a operação não precisa e que viraria passivo trabalhista pro cliente. Se algum dia pedirem trajeto, é conversa jurídica antes de ser técnica.

Cortes, os dois no **servidor** (relógio de celular pode estar errado ou ser burlado):
1. Fora da janela de expediente (`lib/field-service/tracking-window.ts`, 6h–20h BRT) a action recusa.
2. Sem OS pra hoje com status `agendada`/`em_execucao`, recusa — sem finalidade, sem coleta.

Ao sair do expediente o app **apaga** a última posição. Posição com mais de 10 minutos aparece como desatualizada, não como "ao vivo".

O app do técnico mostra aviso permanente dizendo que está compartilhando, em que janela, e que o trajeto **não** é guardado. A permissão do navegador é o consentimento; se ele negar, a tela explica pra que serve em vez de insistir.

Leitura da posição: só `owner`, `admin`, `gerente`, `atendente`. Vendedor e outros técnicos não veem ninguém.

## Comissão do vendedor externo (2026-07-29)
Pedido do ACT por áudio: *"fui indicado por uma loja, e aí tem que pagar uma comissão pro vendedor externo (…) isso já sai certo na OS, com a porcentagem negociada."*

Faltavam duas coisas: **quem** recebe (só havia o nome da loja) e **quanto** (só havia um percentual global por empresa). Agora a OS tem `partner_seller_name` e `partner_commission_percent`.

- O percentual da OS **vence** a regra global. O teste é por **nulo**, não por zero — "essa indicação não paga" é decisão válida e precisa ser respeitada.
- Beneficiário = vendedor externo; sem vendedor informado, cai no nome da loja (é como as OS antigas funcionam).
- `commissions.partner_store` guarda de onde veio a indicação, separado de quem recebe.

⚠️ **`bill_service_order` foi reescrita.** Conferido linha a linha contra a original: só mudou o trecho da comissão externa. Dois pontos que quase passaram:
1. Eu tinha escrito `security definer` — a original é **`security invoker`**. Definer faria a função rodar como dono e **furar o isolamento entre tenants**. Ao mexer nessa função, conferir sempre.
2. Foi adicionado `for update` no SELECT da OS. A versão anterior não travava a linha: duas chamadas simultâneas podiam passar as duas pelo teste de status. As comissões escapavam pelo unique, mas o lançamento a receber **não tem unique** e podia sair duplicado.

Testado em produção dentro de transação com `rollback`: R$1.000 com 7,5% negociado → Carlos Vendedor recebe R$75,00, loja registrada à parte; OS no formato antigo → 5% globais, R$50,00, loja como beneficiária. Nada persistiu.

## Seleção em massa no chat e filtro de mês no funil (2026-07-29)
Dois pedidos separados do usuário, resolvidos juntos por reaproveitarem o que já existia.

**Selecionar várias conversas pra mover de etapa** — `app/(app)/chat/conversation-list.tsx` ganhou o mesmo padrão de seleção que o Kanban já tinha (`selectMode`/`selectedIds`, ícone de check no cabeçalho, clique no item marca em vez de navegar). Reaproveita `moveLeadsToStage` de `app/(app)/leads/actions.ts`, que já existia e já cuidava de posição, `won_at`, log de atividade e automações — nenhuma lógica de servidor nova.

**Dashboard "entrou X leads esse mês, Y% em cada etapa"** — a página `/funil` já existia com a RPC `funnel_metrics` fazendo exatamente essa semântica (leads **criados** no período, agrupados pela etapa **atual**), só faltava o filtro de mês e o percentual visível. Adicionados: `getBRTMonthBounds(offset)` em `lib/date/brt.ts` (testado nas viradas de mês e de ano), filtros "Este mês"/"Mês passado" na tela, e `%` do total do período junto da contagem de cada etapa no card.

Validado em produção, só leitura, contra a Avante Digital (779 leads no mês): distribuição por etapa bate com o formato do exemplo do áudio do cliente.

## Vídeo travado no PWA da Atacado Moda Sul (2026-07-29)
Relato: enviou um vídeo, ficou "enviando" por minutos sem sair, e ao sair da conversa o sistema todo travou. Conta é Evolution API.

**Evidência antes de mexer**: consultei `messages` em produção (só leitura) — **nenhuma linha** foi criada pra essa tentativa de vídeo. Isso descarta o WhatsApp/Evolution como causa: o processo nunca saiu do **upload do arquivo pro Supabase Storage**, que é client-side e acontece antes de qualquer chamada de servidor.

Causa raiz: o app aceitava até **1GB** em qualquer mídia. Vídeo de celular de poucos minutos passa fácil de 200-500MB — em conexão de loja, isso é upload de vários minutos **destinado a falhar de qualquer forma**, porque o WhatsApp em si só aceita vídeo até **16MB** (limite real da rede, documentado na Cloud API da Meta — vale também pro Evolution, que entrega pra dentro da mesma infraestrutura). O usuário esperava minutos por um envio que nunca teria como dar certo do outro lado.

Corrigido:
- `lib/whatsapp/media-limits.ts` — teto real por tipo (imagem 5MB, vídeo 16MB, áudio 16MB, documento 100MB), validado **antes** de iniciar o upload, com mensagem explicando o motivo.
- `lib/whatsapp/fetch-with-timeout.ts` — nenhuma chamada aos provedores (Evolution, Cloud API, Z-API) tinha timeout; `fetch` nativo espera pra sempre. Ficou 45s pra texto, 90s pra mídia — se o provedor travar, agora falha com erro claro em vez de pendurar a Server Action e o `await` do cliente indefinidamente. Esse era um risco sistêmico separado do vídeo (qualquer envio por qualquer provedor podia travar assim), corrigido nos três provedores.
- `lib/async/with-timeout.ts` — teto de 4 minutos no upload do cliente pro Storage. Não cancela a rede de verdade (não tem como abortar limpo o upload do `@supabase/storage-js` nesta versão), mas garante que a **tela** nunca fica travada esperando — depois do prazo, erro claro e o usuário pode tentar de novo.

Não expliquei o "travou o sistema todo" com certeza total — mais provável é o upload de centenas de MB saturando a conexão móvel da loja, fazendo qualquer outra coisa parecer travada até o navegador desistir. O corte de tamanho pra 16MB em vídeo torna esse cenário via anexo de chat bem mais raro.

## Pauta da reunião ACT de 2026-07-29 (5 itens)
⚠️ **ERP W+ agora está SÓ no ACT.** `field_service_enabled` desligada no tenant Solaire W+ (era o único outro; nenhum cliente tinha). Consequência: não há mais tenant pra testar o ERP pela interface — religar é um toggle em Configurações.

**1. Vendedora ter acesso às rotas — FEITO.** Ela abre `/os/roteiro` e `/os/mapa` em leitura. Novo `canViewServiceRoutes` em `lib/auth/roles.ts`. Na RLS a liberação é restrita a OS com `service_date` preenchido: ela vê o roteiro do dia, mas **não** rascunho nem negociação em aberto de outra vendedora. Escrita (otimizar, sugerir técnico, alocar, reagendar) segue em `canManageServiceOrders` e os controles nem são renderizados pra ela. Testado por simulação de JWT em transação desfeita: vê agendada de outro (1), não vê rascunho de outro (0), não vê nada de outro tenant (0).

**2. Cadastrar vendedores e parceiros responsáveis — PENDENTE, e maior do que o que já existe.** Hoje `partner_store` + `partner_seller_name` são **texto livre por OS**, com **um** percentual negociado. O áudio pede outra coisa: um **cadastro** de lojas parceiras e dos vendedores de cada loja, e **divisão da comissão entre a loja e o vendedor** (ex.: Benoit indica, o vendedor da Benoit é o responsável → parte pra loja, parte pra ele; ou 100% pro vendedor). Isso exige tabela nova de parceiros/vendedores + `commissions` aceitando dois beneficiários na mesma indicação, o que mexe em `bill_service_order` **de novo**. Ver avisos dessa função na seção de comissão do vendedor externo.

**3. Aprovação de desconto pela gerência — PENDENTE.** É o item 1 da Fase 4, agora confirmado e priorizado pelo cliente. Vendedora **solicita** desconto, gerência **autoriza**. Falta decidir: quem autoriza (gerente? owner/admin?) e se a OS **trava** aguardando ou segue com a autorização registrada depois.

**4. Pagamento recorrente via Sicoob — PENDENTE, e o caminho mudou.** O certo hoje **não** é integrar boleto: é **Pix Automático**, modalidade de recorrência do Banco Central (lançada jun/2025, obrigatória pras instituições desde out/2025). O cliente autoriza **uma vez** no app do banco dele e a empresa debita nos vencimentos, **sem convênio específico com cada banco**. No Sicoob, sai pelo Portal Developers (`developers.sicoob.com.br`) criando aplicação e ativando a API de Pix Recebimentos. **Não validei requisitos de credencial (certificado digital / mTLS / conta PJ) — confirmar no portal antes de estimar.**

**5. Variável "cidade" = custo de frete por cidade — PENDENTE.** O áudio esclarece o que estava com ruído no áudio anterior: **é isto que o item "deslocamento" da Fase 4 significa** — quanto se gasta de frete/deslocamento **por cidade**. Ou seja: tabela de custo por cidade, não um campo solto na OS. Fecha a dúvida que estava registrada como "confirmar com o cliente antes de construir".

## Item 2 da pauta — cadastro de parceiros com comissão dividida (FEITO, 2026-07-30)
`field_service_partners`: lojas e vendedores, com vendedor podendo apontar pra uma loja (`store_id`, opcional — vendedor autônomo não tem). Trigger no banco recusa `store_id` que não seja de fato uma loja do mesmo tenant — testado em produção, dentro de transação: tentar ligar um vendedor a outro vendedor falha com erro claro.

Tela em `/os/parceiros`, link "Parceiros" no cabeçalho de Ordens de Serviço. Leitura liberada pra quem cria OS (inclui vendedor); escrita só pra quem gerencia OS. Remover um parceiro é recusado se ele já está em alguma OS (usa "Desativar" em vez de perder o histórico).

Na criação da OS, dois selects (Loja / Vendedor) substituem o texto livre — escolher um vendedor com loja cadastrada já marca a loja dele junto, um só passo. Texto livre continua disponível só quando **nenhum** dos dois selects está preenchido, pra indicação avulsa que não vale cadastrar.

`service_orders` ganhou `partner_store_id`, `partner_seller_id`, `partner_store_split_percent` (fatia da loja na comissão; sem os dois preenchidos ela não importa, com os dois e sem valor explícito = 50/50 — negociação muda a cada indicação, não existe regra única do cliente pra isso).

`bill_service_order` reescrita de novo — comparada função por função com a anterior antes de aplicar. Agora gera **até duas** linhas de comissão (`loja_parceira` + `vendedor_externo`, papel novo) quando os dois estão preenchidos, proporcionais ao split. Só um preenchido = 100% pra ele. Nenhum dos dois = cai no texto livre antigo, comportamento inalterado.

Testado em produção com `rollback`: R$1.000, 5% global, split 30/70 → loja R$15 (1,5%), vendedor R$35 (3,5%), soma bate com os 5% originais. Só vendedor, R$500 → R$25 (5%, sozinho). OS no formato antigo (texto livre) → segue gerando R$50 (5%) como sempre gerou.

⚠️ **Achado no caminho**: `updateServiceOrder` nunca persistia `partner_seller_name`/`partner_commission_percent` ao editar uma OS existente — só `createServiceOrder` gravava. Corrigido junto.

### Regras de cadastro vistas nas telas do sistema antigo do ACT (fotos de 2026-07-30)
O cliente mandou capturas do sistema de papel/desktop que usavam antes. Confirma o modelo (uma loja, vários parceiros vinculados a ela — ex. "JOLI STOFF" com 6 vendedores diferentes) e traz pistas novas:
- **"Deslocamento" é um campo em R$ digitado na OS**, na tela de fechamento ("Acerto Final"), ao lado de Lavagem/Imper/Couro/Tapete — **não** uma tabela de custo por cidade como eu tinha assumido antes de ver a captura. Ajustar a leitura do item 5 da pauta quando for construído.
- "Tabela" vs "Negociação" vs "Valores Finais" aparecem como colunas distintas no fechamento — confirma que desconto = diferença entre tabela e final, relevante pro item 3 (aprovação de desconto).
- Existe um campo "Parceiro Extra" (visto vazio em todas as linhas) — pode indicar que às vezes um terceiro entra na comissão, mas sem uso visível na amostra. Não implementado; revisitar se o cliente pedir.

## PIX e relatório de indicações por parceiro (FEITO, 2026-07-30)
Pedido por áudio: cadastrar telefone pra "ter uma chavezinha" (PIX) do parceiro, e conseguir ver o que cada um indicou — "eu entro ali, geraria relatório do que foi indicado".

`field_service_partners.pix_key` adicionado. Clicar num parceiro na lista abre `/os/parceiros/[id]`: edição (nome, telefone, PIX com botão de copiar) + lista de toda OS onde ele entrou como loja ou vendedor, com status, valor e link direto pra OS.

⚠️ **Achado antes de subir**: a RLS de `commissions` só libera leitura pra `owner`/`admin` (mesmo corte do `/financeiro`). Gerente e atendente conseguem abrir a ficha do parceiro (mesma permissão de `/os/parceiros`), mas sem ver comissão — se eu tivesse buscado o dado pra todo mundo, quem não tem permissão veria **"comissão gerada: R$0,00"**, que é enganoso (parece que não gerou nada, quando na verdade é que a tela não pode mostrar). A página checa `canReviewServiceOrder` e só busca/mostra a seção de comissão quando pode. Testado em produção com `rollback`: R$800 a 5% → R$40,00 batendo com o faturamento.

## Decisões do cliente incorporadas em 2026-07-30

1. **Tipo de produto / catálogo**: construído junto com a tabela de preços.
2. **PDF do histórico de conversa**: exportação textual com indicação de anexos, pronta para imprimir/salvar em PDF.
3. **Triagem centralizada**: somente lead indicado por parceiro fica sem dono para a Michele distribuir manualmente; lead de marketing continua no round-robin.

## Item 4 — resumo de comissão antes de faturar (FEITO, 2026-07-30)
Motivado pelo caso do Matheus (2026-07-29): a comissão saiu certa, mas ninguém sabia que ia sair antes de clicar. Agora "Faturar" mostra, num diálogo, quem recebe o quê antes de confirmar.

**Refactor de raiz pra evitar a quinta divergência**: em vez de duplicar a conta de comissão numa function de preview separada, o cálculo saiu de dentro de `bill_service_order` e virou `compute_service_order_commissions(uuid)` — só leitura, devolve as linhas sem gravar nada. `bill_service_order` passa a fazer um loop sobre essa function e inserir o que ela devolve. Resumo e faturamento são, por construção, a mesma conta — não existe mais "a tela disse uma coisa, o banco gerou outra".

⚠️ **Armadilha pega em teste, antes de aplicar**: as colunas de saída da function (`party_kind`, `amount_cents`, `percent`...) colidem em nome com colunas reais de `service_order_items`, `commission_rules`. Sem prefixo, o Postgres recusa a function com "column reference is ambiguous" na hora de *chamar*, não na hora de criar — passou pela criação e só quebrou no teste. Saída agora com prefixo `out_` (`out_party_kind`, `out_amount_cents`...), que nunca colide com nada.

Testado em produção com `rollback`, comparando as três etapas na mesma transação: preview → confere que **zero linhas** foram gravadas em `commissions` → chama `bill_service_order` de verdade → compara. Split loja/vendedor 40/60 sobre R$1.200: preview e faturado bateram byte a byte (loja R$24, vendedor R$36, vendedora interna R$12). Repetido simulando a dona do ACT via JWT (não superusuário), pra confirmar que a permissão de execução (`grant execute ... to authenticated`) funciona de verdade pra quem vai usar, não só pra mim testando como admin do banco.

⚠️ **Bug achado no caminho, já em produção**: `COMMISSION_PARTY_LABEL` (usado em `/financeiro` pra mostrar o nome do papel da comissão) nunca ganhou `vendedor_externo` — o papel que criei ontem. Qualquer OS já faturada com vendedor externo estava mostrando rótulo em branco no financeiro. Corrigido junto.

⚠️ **Achado, não corrigido**: existe `lib/field-service/commissions.ts` com uma reimplementação completa do cálculo de comissão em TypeScript (`calculateCommissions`, `splitCents`), com 7 testes próprios passando — mas **nada no app chama essa função**. Só o mapa de rótulos (`COMMISSION_PARTY_LABEL`) dali é usado de verdade. É exatamente o tipo de duplicação que motivou o refactor acima, só que já tinha acontecido silenciosamente antes: essa versão TS nunca soube de `vendedor_externo` nem do split loja/vendedor. Deixei um aviso no arquivo. Se um dia for reativada, reescrever pra chamar o banco em vez de duplicar a regra.

## Fase 4 — precificação, deslocamento e comprovante do atendimento (EM IMPLEMENTAÇÃO, 2026-07-30)

- **Desconto:** cada item da venda pode receber preço de tabela. Se o valor negociado for menor, nasce como `solicitado`, com quem solicitou e quando. Enquanto estiver solicitado ou recusado, fica fora do total da OS. `owner`, `admin` e `gerente` podem aprovar; atendente não. A regra é calculada no banco, não só na interface.
- **Deslocamento:** valor separado em reais na OS, convertido para centavos e somado ao total final sem virar item de upsell.
- **Remarcação:** a confirmação posterior do cliente corrigiu o entendimento: é feita
  pelo escritório, não pelo técnico. O botão saiu do app de campo; trocar
  data/turno no administrativo exige motivo e preserva a agenda anterior no
  histórico.
- **PDF de conversa:** botão no chat WhatsApp abre uma versão de impressão com histórico textual, datas, remetente e indicação de anexos. O navegador abre a janela de impressão para salvar/encaminhar como PDF; mídias privadas não são copiadas para dentro do arquivo.

## Fechamento operacional do ACT (FEITO, 2026-07-30)

Regras confirmadas nos áudios e capturas do sistema antigo:

- O técnico fecha tudo numa única tela: laudo, observações e resultado. O
  checklist tem 16 perguntas e é **um por OS**, não um por peça.
- Resultados: `finalizado`, `finalizado_orcamento` e `assistencia`.
  Assistência/cortesia fica visualmente separada, zera a OS e tem bloqueios
  no banco contra lançamento financeiro e comissão.
- `finalizado_orcamento` mantém o orçamento ligado à OS original. Quando o
  administrativo converte, nasce uma **nova OS**, para outra data, com elo
  para a origem e no histórico do mesmo cliente.
- Remarcação é administrativa. A troca de data/turno exige motivo e grava
  data/turno anteriores e novos em `service_order_schedule_history`; o
  roteiro diário mostra a visita remarcada mesmo depois de sua data mudar.
- Reabrir conclusão/assistência ou cancelar a conferência exige motivo e é
  permitido a `owner`, `admin` e `gerente`. “Coordenador de vendas” usa o
  papel `gerente`; não foi criado papel novo.
- Acerto por OS registra previsto, recebido, pendente e forma de pagamento.
  Taxa, quantidade de parcelas e parcela mínima ficam em
  `payment_method_rates`; as taxas reais continuam zeradas até o ACT enviar a
  tabela da maquininha e podem ser configuradas sem deploy.
- A gestão controla em Configurações → Usuários quem está disponível no
  round-robin. Iris foi ativada inicialmente; lead de parceiro continua fora
  do sorteio.
- “Cancelar finalização” é uma ação separada de “Reabrir”, exige motivo,
  volta a OS para execução e preserva o laudo/evento para auditoria.
- Depois de faturamento/pagamento, mudança de acerto ou comissão não é
  aplicada diretamente: vira `financial_adjustment_requests`, com motivo.
  Somente `owner` libera ou recusa, deixando autor, motivo e data auditáveis.
