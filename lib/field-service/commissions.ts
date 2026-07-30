/**
 * Calculo de comissao da ordem de servico.
 *
 * Regras vindas do briefing do ACT:
 *   - Tecnico comissiona SO sobre o que ele vendeu na residencia (upsell),
 *     nunca sobre o servico que a vendedora ja tinha fechado. Se foram dois
 *     tecnicos na mesma casa, a comissao e dividida entre eles.
 *   - Vendedora interna comissiona sobre o total da OS (1%, configuravel).
 *   - Loja parceira comissiona sobre o total quando a OS veio por indicacao.
 *
 * Tudo em centavos inteiros, como o resto do sistema. Nada de float no
 * dinheiro.
 *
 * ⚠️ O calculo de verdade (o que gera comissao real) vive no banco, na
 * function compute_service_order_commissions/bill_service_order. As funcoes
 * deste arquivo (calculateCommissions, splitCents) nao sao chamadas por
 * nenhum fluxo do app - so pelo teste delas mesmas - e ja divergem do banco
 * (nao sabem de vendedor_externo nem de split loja/vendedor). Nao confiar
 * nelas como fonte de verdade; se forem reativadas um dia, reescrever pra
 * chamar o banco em vez de duplicar a regra em TypeScript.
 */

import type { CommissionParty } from "@/lib/supabase/database.types";

export type CommissionPartyKind = "tecnico" | "vendedora_interna" | "loja_parceira";

export type CommissionRules = {
  /** Percentual do tecnico sobre o upsell aprovado. Ex: 10 = 10%. */
  tecnicoPercent: number;
  /** Percentual da vendedora interna sobre o total da OS. Ex: 1 = 1%. */
  vendedoraInternaPercent: number;
  /** Percentual da loja parceira sobre o total da OS. */
  lojaParceiraPercent: number;
};

export const DEFAULT_COMMISSION_RULES: CommissionRules = {
  tecnicoPercent: 10,
  vendedoraInternaPercent: 1,
  lojaParceiraPercent: 5,
};

export type CommissionInput = {
  /** Total da OS (soma dos itens aprovados). */
  totalCents: number;
  /** Soma so dos itens kind='upsell' que o ADM aprovou. */
  approvedUpsellCents: number;
  /** Tecnicos que estiveram na residencia. */
  technicianIds: string[];
  /** Consultora que fechou a venda, se houver. */
  consultantId: string | null;
  /** Nome da loja parceira que indicou, se houver. */
  partnerStore: string | null;
  rules: CommissionRules;
};

export type CommissionLine = {
  partyKind: CommissionPartyKind;
  userId: string | null;
  partnerName: string | null;
  baseCents: number;
  percent: number;
  amountCents: number;
};

function percentOf(baseCents: number, percent: number) {
  // Arredonda pra centavo inteiro; base e percentual sao ambos exatos aqui.
  return Math.round((baseCents * percent) / 100);
}

/**
 * Divide um valor em centavos entre N pessoas sem perder nem criar centavo:
 * os centavos que sobram da divisao vao pros primeiros da lista.
 */
export function splitCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function calculateCommissions(input: CommissionInput): CommissionLine[] {
  const lines: CommissionLine[] = [];

  // Tecnico: base e so o upsell aprovado. OS sem venda em campo nao gera
  // comissao de tecnico nenhuma - e o combinado com eles.
  if (input.approvedUpsellCents > 0 && input.technicianIds.length > 0) {
    const pool = percentOf(input.approvedUpsellCents, input.rules.tecnicoPercent);
    const shares = splitCents(pool, input.technicianIds.length);
    input.technicianIds.forEach((technicianId, index) => {
      const amount = shares[index];
      if (amount <= 0) return;
      lines.push({
        partyKind: "tecnico",
        userId: technicianId,
        partnerName: null,
        baseCents: input.approvedUpsellCents,
        percent: input.rules.tecnicoPercent,
        amountCents: amount,
      });
    });
  }

  if (input.consultantId && input.totalCents > 0) {
    const amount = percentOf(input.totalCents, input.rules.vendedoraInternaPercent);
    if (amount > 0) {
      lines.push({
        partyKind: "vendedora_interna",
        userId: input.consultantId,
        partnerName: null,
        baseCents: input.totalCents,
        percent: input.rules.vendedoraInternaPercent,
        amountCents: amount,
      });
    }
  }

  const partner = input.partnerStore?.trim();
  if (partner && input.totalCents > 0) {
    const amount = percentOf(input.totalCents, input.rules.lojaParceiraPercent);
    if (amount > 0) {
      lines.push({
        partyKind: "loja_parceira",
        userId: null,
        partnerName: partner,
        baseCents: input.totalCents,
        percent: input.rules.lojaParceiraPercent,
        amountCents: amount,
      });
    }
  }

  return lines;
}

export function totalCommissionCents(lines: CommissionLine[]) {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

// CommissionPartyKind (deste arquivo) ficou pra tras do enum real do banco:
// nunca ganhou 'vendedor_externo' porque nada aqui chama o calculo do banco -
// esse tipo local e so um label map hoje. Usa CommissionParty (o tipo real,
// de lib/supabase/database.types) pra nao repetir esse descompasso.
export const COMMISSION_PARTY_LABEL: Record<CommissionParty, string> = {
  tecnico: "Técnico",
  vendedora_interna: "Vendedora interna",
  loja_parceira: "Loja parceira",
  vendedor_externo: "Vendedor externo",
};
