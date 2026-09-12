# ACT Komodus-style OS Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o módulo exclusivo de Ordens de Serviço da ACT para reproduzir o fluxo operacional compacto do Komodus, mantendo a identidade visual e as regras existentes do CRM W+.

**Architecture:** A implementação mantém as rotas, tabelas e ações atuais e reorganiza a apresentação em quatro superfícies: lista, agenda completa, workspace compacto e impressão. Regras puras de exibição ficam em `lib/field-service`, componentes client ficam pequenos e focados, e as páginas server continuam responsáveis por autorização e carregamento agregado dos dados.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Radix UI, Supabase/Postgres, Node test runner e esbuild.

---

## Mapa de arquivos

- `lib/field-service/agenda.ts`: semântica das cores, posicionamento e formatação da agenda.
- `lib/field-service/os-presentation.ts`: novo módulo puro com montagem dos resumos exibidos em cartões, ficha rápida e impressão.
- `app/(app)/os/agenda/page.tsx`: consulta agregada da agenda.
- `app/(app)/os/agenda/agenda-grid.tsx`: grade por técnico, cartões, menu contextual e ficha rápida.
- `app/(app)/os/agenda/agenda-order-preview.tsx`: nova ficha operacional aberta a partir de um cartão.
- `app/(app)/os/[id]/page.tsx`: composição server do workspace compacto.
- `app/(app)/os/[id]/os-workspace-rail.tsx`: miniagenda lateral do dia.
- `app/(app)/os/[id]/os-summary-panel.tsx`: novo resumo de cliente, negociação e auditoria.
- `app/(app)/os/[id]/os-financial-column.tsx`: nova coluna de valores, pagamento, recebimento e comissões.
- `app/(app)/os/page.tsx`: lista operacional enxuta.
- `app/(app)/os/os-row-actions.tsx`: novo menu contextual da lista.
- `app/(app)/os/[id]/print/page.tsx`: ficha impressa condensada.
- `tests/field-service-agenda.test.mjs`: regras de cores e layout.
- `tests/field-service-os-presentation.test.mjs`: resumos e formatação sem depender do React.

### Task 1: Corrigir a linguagem visual da agenda ACT

**Files:**
- Modify: `lib/field-service/agenda.ts`
- Create: `tests/field-service-agenda.test.mjs`

- [ ] **Step 1: Escrever o teste que fixa verde como estado normal da ACT**

```js
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/field-service-agenda-test.mjs";
  await build({ entryPoints: ["lib/field-service/agenda.ts"], bundle: true, platform: "node", format: "esm", outfile });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

test("agenda ACT usa verde para OS agendada normal", async () => {
  const { agendaCardTone } = await loadModule();
  assert.equal(agendaCardTone({ status: "agendada", confirmedAt: null, hasPendingIssue: false }), "verde");
  assert.equal(agendaCardTone({ status: "agendada", confirmedAt: "2026-09-12T12:00:00Z", hasPendingIssue: false }), "verde");
});

test("excecoes operacionais sobrepoem o verde", async () => {
  const { agendaCardTone } = await loadModule();
  assert.equal(agendaCardTone({ status: "remarcada", confirmedAt: null, hasPendingIssue: false }), "laranja");
  assert.equal(agendaCardTone({ status: "cancelada", confirmedAt: null, hasPendingIssue: false }), "cinza");
  assert.equal(agendaCardTone({ status: "em_execucao", confirmedAt: null, hasPendingIssue: false }), "roxo");
  assert.equal(agendaCardTone({ status: "agendada", confirmedAt: null, hasPendingIssue: true }), "vermelho");
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha inicial**

Run: `node --test tests/field-service-agenda.test.mjs`

Expected: FAIL informando que `agendada` retornou `amarelo` ou `azul`, não `verde`.

- [ ] **Step 3: Ajustar o mapa de cores e rótulos**

```ts
export function agendaCardTone(order: {
  status: ServiceOrderStatus;
  confirmedAt: string | null;
  hasPendingIssue: boolean;
}): AgendaCardTone {
  if (order.hasPendingIssue) return "vermelho";
  if (order.status === "cancelada") return "cinza";
  if (order.status === "remarcada") return "laranja";
  if (order.status === "em_execucao") return "roxo";
  if (["agendada", "concluida", "conferida", "faturada"].includes(order.status)) return "verde";
  return "amarelo";
}

export const AGENDA_TONE_LABEL = {
  amarelo: "Sem agenda",
  azul: "Confirmada",
  roxo: "Em atendimento",
  verde: "Programada",
  laranja: "Remarcar",
  vermelho: "Pendência",
  cinza: "Cancelada",
} satisfies Record<AgendaCardTone, string>;
```

- [ ] **Step 4: Executar o teste da agenda**

Run: `node --test tests/field-service-agenda.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commitar a regra isolada**

```bash
git add lib/field-service/agenda.ts tests/field-service-agenda.test.mjs
git commit -m "fix: align ACT agenda status colors"
```

### Task 2: Criar o modelo de apresentação da ficha operacional

**Files:**
- Create: `lib/field-service/os-presentation.ts`
- Create: `tests/field-service-os-presentation.test.mjs`

- [ ] **Step 1: Escrever testes para endereço, horário e resumo de serviço**

```js
test("monta endereco ACT sem separadores vazios", async () => {
  const { formatOperationalAddress } = await loadModule();
  assert.equal(formatOperationalAddress({ street: "Rua A", number: "10", district: "Centro", city: "Sapucaia do Sul", state: "RS" }), "Rua A, 10 · Centro · Sapucaia do Sul/RS");
});

test("resume itens e preserva quantidade", async () => {
  const { summarizeServiceItems } = await loadModule();
  assert.deepEqual(
    summarizeServiceItems([{ quantity: 2, description: "Sofá 3 lugares" }, { quantity: 1, description: "Poltrona" }], 2),
    ["2x Sofá 3 lugares", "1x Poltrona"],
  );
});

test("formata janela exata no fuso de Brasilia", async () => {
  const { formatOperationalWindow } = await loadModule();
  assert.equal(formatOperationalWindow("2026-09-12T11:30:00Z", "2026-09-12T13:30:00Z"), "08:30–10:30");
});
```

- [ ] **Step 2: Executar e confirmar que o módulo ainda não existe**

Run: `node --test tests/field-service-os-presentation.test.mjs`

Expected: FAIL ao resolver `lib/field-service/os-presentation.ts`.

- [ ] **Step 3: Implementar funções puras e tipos mínimos**

```ts
export type OperationalAddress = {
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

export function formatOperationalAddress(address: OperationalAddress): string {
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const city = [address.city, address.state].filter(Boolean).join("/");
  return [street, address.district, city].filter(Boolean).join(" · ") || "Endereço não informado";
}

export function summarizeServiceItems(items: Array<{ quantity: number; description: string }>, limit = 3): string[] {
  return items.slice(0, limit).map((item) => `${item.quantity}x ${item.description}`);
}

export function formatOperationalWindow(startAt: string | null, endAt: string | null): string {
  if (!startAt || !endAt) return "Horário não definido";
  const fmt = (value: string) => new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
  });
  return `${fmt(startAt)}–${fmt(endAt)}`;
}
```

- [ ] **Step 4: Rodar os testes do modelo de apresentação**

Run: `node --test tests/field-service-os-presentation.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commitar o modelo puro**

```bash
git add lib/field-service/os-presentation.ts tests/field-service-os-presentation.test.mjs
git commit -m "feat: add ACT service order presentation model"
```

### Task 3: Redesenhar a agenda completa por técnico

**Files:**
- Modify: `app/(app)/os/agenda/page.tsx`
- Modify: `app/(app)/os/agenda/agenda-grid.tsx`
- Create: `app/(app)/os/agenda/agenda-order-preview.tsx`

- [ ] **Step 1: Ampliar a consulta server da agenda em uma única carga**

Adicionar aos dados de `AgendaOrder` os campos já existentes necessários à ficha: parceiro, consultor, forma de pagamento, observações, confirmação, auditoria e os itens resumidos. Buscar perfis em lote pelos IDs encontrados, sem consultas por cartão.

```ts
export type AgendaOrder = {
  id: string;
  codeSeq: number;
  status: ServiceOrderStatus;
  leadName: string;
  leadPhone: string | null;
  addressLine: string;
  serviceItems: Array<{ quantity: number; description: string }>;
  partnerName: string | null;
  consultantName: string | null;
  paymentMethod: string | null;
  observations: string | null;
  confirmedAt: string | null;
  confirmedByName: string | null;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  serviceDate: string | null;
  shift: "manha" | "tarde" | null;
  hasPendingIssue: boolean;
  technicianIds: string[];
};
```

- [ ] **Step 2: Criar a ficha rápida sem novas consultas**

`AgendaOrderPreview` recebe o objeto já carregado e renderiza seções Serviço, Cliente, Loja/Parceiro, Venda, Confirmação, Auditoria, Observações e Horário. O componente deve ter ação primária `Abrir OS completa` e fechamento por botão, Escape e clique fora.

- [ ] **Step 3: Tornar os cartões legíveis e estáveis**

No `AgendaCard`, mostrar horário, cidade/bairro, cliente, primeiro serviço e indicador textual de confirmação. Preservar `layoutOverlappingCards`; usar `minmax(176px, 1fr)` para evitar colunas excessivamente largas e manter cabeçalho/eixo de horários fixos.

- [ ] **Step 4: Evitar mudanças de geometria durante busca e transições**

Aplicar largura estável ao campo de busca, reservar a área da legenda e usar `aria-busy={pending}` com redução leve de opacidade somente na grade. Não substituir a grade inteira por um spinner.

- [ ] **Step 5: Verificar tipos e testes da agenda**

Run: `node --test tests/field-service-agenda.test.mjs && npx tsc --noEmit --pretty false`

Expected: testes PASS e TypeScript sem erros.

- [ ] **Step 6: Commitar a agenda completa**

```bash
git add app/(app)/os/agenda/page.tsx app/(app)/os/agenda/agenda-grid.tsx app/(app)/os/agenda/agenda-order-preview.tsx
git commit -m "feat: rebuild ACT technician agenda"
```

### Task 4: Montar o workspace administrativo compacto

**Files:**
- Modify: `app/(app)/os/[id]/page.tsx`
- Modify: `app/(app)/os/[id]/os-workspace-rail.tsx`
- Create: `app/(app)/os/[id]/os-summary-panel.tsx`
- Create: `app/(app)/os/[id]/os-financial-column.tsx`
- Reuse: `app/(app)/os/[id]/items-panel.tsx`
- Reuse: `app/(app)/os/[id]/schedule-panel.tsx`
- Reuse: `app/(app)/os/[id]/settlement-panel.tsx`
- Reuse: `app/(app)/os/[id]/commissions-panel.tsx`
- Reuse: `app/(app)/os/[id]/registros-panel.tsx`
- Reuse: `app/(app)/os/[id]/status-actions.tsx`

- [ ] **Step 1: Extrair o resumo operacional do arquivo de página**

Criar `OsSummaryPanel` com propriedades explícitas para cliente, endereço, parceiro, consultores, técnicos, agenda, prazo, voltagem, observações e auditoria. O componente não consulta o banco e não replica regras financeiras.

- [ ] **Step 2: Criar a coluna financeira única**

Compor `SettlementPanel` e `CommissionsPanel` dentro de `OsFinancialColumn`, mantendo as ações existentes e apresentando no topo o resumo abaixo.

```ts
export type OsFinancialSummary = {
  serviceBaseCents: number;
  travelFeeCents: number;
  discountCents: number;
  totalCents: number;
  expectedReceiptCents: number;
  receivedCents: number;
  paymentMethod: string | null;
};
```

- [ ] **Step 3: Reorganizar a página em três regiões**

Usar o grid desktop `xl:grid-cols-[18rem_minmax(34rem,1fr)_22rem]`: miniagenda à esquerda, conteúdo/itens/registros no centro e financeiro/comissões à direita. Em largura menor, o layout vira uma única coluna na ordem operacional, sem esconder seções em abas.

- [ ] **Step 4: Compactar o cabeçalho e manter ações fixas**

Manter status e impressão no cabeçalho. A barra inferior continua fixa, mas passa a reunir também os atalhos de remarcar/reabrir/cancelar já autorizados por `StatusActions`, sem criar transições novas fora de `transitionServiceOrder`.

- [ ] **Step 5: Melhorar a miniagenda lateral**

Mostrar horário, cliente, cidade e indicador textual de status; destacar a OS atual; adicionar links de data anterior/próxima e `Agenda completa`. As consultas continuam filtradas por `tenant_id` e dia.

- [ ] **Step 6: Executar testes e verificação de tipos**

Run: `npm test && npx tsc --noEmit --pretty false`

Expected: todos os testes PASS e TypeScript sem erros.

- [ ] **Step 7: Commitar o workspace**

```bash
git add app/(app)/os/[id]/page.tsx app/(app)/os/[id]/os-workspace-rail.tsx app/(app)/os/[id]/os-summary-panel.tsx app/(app)/os/[id]/os-financial-column.tsx
git commit -m "feat: add compact ACT service order workspace"
```

### Task 5: Compactar a lista e reunir ações administrativas

**Files:**
- Modify: `app/(app)/os/page.tsx`
- Create: `app/(app)/os/os-row-actions.tsx`

- [ ] **Step 1: Ampliar a consulta da lista sem N+1**

Carregar atribuições e nomes de técnicos em lote e montar um mapa por OS. A tabela passa a exibir horário, cliente, cidade, técnico, serviço, confirmação, valor e status.

- [ ] **Step 2: Criar o menu de ações por linha**

`OsRowActions` recebe `id`, `status`, permissões e os dados necessários para imprimir/confirmar. Reutilizar `transitionServiceOrder`, `confirmServiceOrder` e `unconfirmServiceOrder`; não duplicar validação de transição no componente.

- [ ] **Step 3: Preservar largura durante filtros**

Definir colunas estáveis, skeleton com as mesmas dimensões da tabela e links de filtro que atualizam o conteúdo sem deslocar o cabeçalho. Manter o número de resultados visível.

- [ ] **Step 4: Verificar tipos e build da rota**

Run: `npx tsc --noEmit --pretty false && npm run build`

Expected: TypeScript e build concluídos sem erros.

- [ ] **Step 5: Commitar a lista operacional**

```bash
git add app/(app)/os/page.tsx app/(app)/os/os-row-actions.tsx
git commit -m "feat: compact ACT service order list"
```

### Task 6: Refazer a ficha de impressão operacional

**Files:**
- Modify: `app/(app)/os/[id]/print/page.tsx`
- Modify: `app/(app)/os/[id]/print/print-on-open.tsx`

- [ ] **Step 1: Completar a carga dos dados impressos**

Buscar parceiro, responsáveis, confirmação e eventos essenciais em paralelo com itens e atribuições. Aplicar sempre `tenant_id` à OS raiz e usar apenas IDs derivados dessa OS nas consultas relacionadas.

- [ ] **Step 2: Montar a ficha condensada**

Estruturar a página com cabeçalho ACT, linha de parceiro/técnico/consultor, bloco do cliente, tabela de peças, quadro de valores, conferência, observações e rodapé de agenda/auditoria. Usar bordas simples, texto preto e realces discretos compatíveis com impressão monocromática.

- [ ] **Step 3: Definir regras de quebra de página**

Aplicar `break-inside-avoid` aos blocos críticos e `@page { size: A4; margin: 8mm; }`. Permitir duas fichas por página somente quando a altura real couber; uma OS longa deve ocupar a página sem cortar itens ou observações.

- [ ] **Step 4: Verificar renderização e tipos**

Run: `npx tsc --noEmit --pretty false && npm run build`

Expected: TypeScript e build concluídos sem erros; rota `/os/[id]/print` presente no resumo do build.

- [ ] **Step 5: Commitar a impressão**

```bash
git add app/(app)/os/[id]/print/page.tsx app/(app)/os/[id]/print/print-on-open.tsx
git commit -m "feat: rebuild ACT operational OS print sheet"
```

### Task 7: Confirmar exclusividade ACT e validar ponta a ponta

**Files:**
- Modify only if evidence requires: `lib/tenant.ts`
- Modify only if evidence requires: `app/(app)/layout.tsx`
- Modify only if evidence requires: `middleware.ts`
- Modify: `docs/superpowers/plans/2026-09-12-act-komodus-os-workspace.md`

- [ ] **Step 1: Auditar a configuração dos tenants no Supabase**

Consultar `tenants.id`, `tenants.name` e `tenants.field_service_enabled`. Confirmar que somente ACT possui o módulo ativo. Se outro tenant estiver ativo, não alterar silenciosamente: identificar uso real e restringir a navegação por configuração persistida, não por comparação frágil do nome.

- [ ] **Step 2: Executar a suíte completa**

Run: `npm test`

Expected: todos os testes PASS.

- [ ] **Step 3: Executar checagem de tipos e build de produção**

Run: `npx tsc --noEmit --pretty false`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 e todas as rotas de OS geradas.

- [ ] **Step 4: Validar visualmente no navegador**

Abrir a aplicação com a conta administrativa ACT e conferir em desktop: lista, troca de filtro sem salto, agenda cheia com colunas por técnico, ficha rápida, workspace compacto, ações administrativas e impressão. Repetir em viewport menor para confirmar a sequência vertical e ausência de conteúdo inacessível.

- [ ] **Step 5: Registrar evidências e atualizar os checkboxes**

Marcar no plano somente os passos efetivamente concluídos e registrar no handoff os comandos executados, resultados e qualquer diferença de dados encontrada no tenant ACT.

- [ ] **Step 6: Commitar os ajustes finais**

```bash
git add lib/tenant.ts app/(app)/layout.tsx middleware.ts docs/superpowers/plans/2026-09-12-act-komodus-os-workspace.md
git commit -m "chore: verify ACT service order rollout"
```

O `git add` final deve incluir apenas arquivos realmente modificados; caminhos sem mudanças devem ser omitidos.
