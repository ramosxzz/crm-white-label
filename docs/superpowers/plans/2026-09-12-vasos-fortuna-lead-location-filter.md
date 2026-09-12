# Vasos Fortuna Lead Location Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a Vasos Fortuna filtre leads por qualquer trecho do endereço, inclusive cidade.

**Architecture:** Uma pequena função de domínio identifica o tenant habilitado e normaliza o termo. A página server-side aplica o termo ao JSONB `custom_fields.address`, enquanto o componente cliente mantém o parâmetro na URL e nos filtros ativos.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase/PostgREST, Node test runner.

---

### Task 1: Regra de localização

**Files:**
- Create: `lib/leads/location-filter.ts`
- Create: `tests/leads-location-filter.test.mjs`

- [ ] **Step 1: Write the failing test**

Testar o ID da Vasos Fortuna, um tenant diferente e a normalização de texto vazio, espaços repetidos e entrada longa.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/leads-location-filter.test.mjs`
Expected: FAIL porque `lib/leads/location-filter.ts` ainda não existe.

- [ ] **Step 3: Write minimal implementation**

Exportar `VASOS_FORTUNA_TENANT_ID`, `canFilterLeadsByLocation` e `normalizeLeadLocationFilter`, limitando a busca a 120 caracteres.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/leads-location-filter.test.mjs`
Expected: PASS.

### Task 2: Consulta e interface

**Files:**
- Modify: `app/(app)/leads/page.tsx`
- Modify: `app/(app)/leads/leads-filters.tsx`
- Modify: `tests/leads-location-filter.test.mjs`

- [ ] **Step 1: Write the failing integration assertions**

Verificar no código-fonte que `localizacao` faz parte dos parâmetros, do `useDirectCount`, do filtro `custom_fields->>address`, da paginação e da interface exclusiva.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/leads-location-filter.test.mjs`
Expected: FAIL porque a página e a interface ainda não conhecem `localizacao`.

- [ ] **Step 3: Implement the server and client flow**

Aplicar o filtro em `leadsQuery` e `qualificationCountQuery`, preservar o parâmetro na paginação e adicionar o campo com debounce, chip ativo e limpeza na interface.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test tests/leads-location-filter.test.mjs`, `npm test`, `npx tsc --noEmit --pretty false`, `npm run build`.
Expected: todos encerram com código 0.
