import type { WhatsAppAccount } from "@/lib/supabase/database.types";

/**
 * NUNCA assume uma conta por default (nem quando ha so uma ativa, nem quando
 * todas as contas ativas sao do mesmo tenant): exige match explicito por
 * identificador seguro (instance/instanceId/phone_number_id). Sem match, o
 * payload e ignorado - jamais atribuido a um tenant "palpite", que foi
 * exatamente a causa de vazamentos reais entre tenants.
 */

export function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function normalizeUrl(v: unknown): string {
  return norm(v).replace(/\/+$/, "");
}

export function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return [];
}

export function collectNestedStringValues(input: unknown, keys: string[], maxDepth = 4): string[] {
  const values: string[] = [];
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set<unknown>();

  function visit(value: unknown, depth: number) {
    if (!value || depth > maxDepth || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (wanted.has(key.toLowerCase()) && typeof nested === "string" && nested.trim().length > 0) {
        values.push(nested);
      }
      if (nested && typeof nested === "object") visit(nested, depth + 1);
    }
  }

  visit(input, 0);
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function getEvolutionAccountIdentities(account: WhatsAppAccount): string[] {
  const creds = (account.credentials ?? {}) as Record<string, unknown>;
  return Array.from(
    new Set(
      [
        creds.instance,
        creds.instance_id,
        creds.instanceName,
        creds.instanceId,
        creds.previous_instance,
        ...stringList(creds.instance_aliases),
        ...stringList(creds.instanceAliases),
      ]
        .map(norm)
        .filter(Boolean),
    ),
  );
}

/**
 * Se houver mais de uma conta candidata (match ambiguo), retorna null em vez
 * de escolher uma arbitrariamente - ambiguidade tambem e tratada como "sem
 * match" para nao atribuir por palpite.
 */
export function pickSingleMatch(matches: WhatsAppAccount[]): WhatsAppAccount | null {
  const unique = Array.from(new Map(matches.map((item) => [item.id, item])).values());
  return unique.length === 1 ? (unique[0] ?? null) : null;
}

export function matchCloudApiAccount(
  accounts: WhatsAppAccount[],
  metadata: { phone_number_id?: string; display_phone_number?: string } | undefined,
): WhatsAppAccount | null {
  const phoneNumberId = metadata?.phone_number_id;
  const phone = metadata?.display_phone_number?.replace(/\D/g, "");

  const matchedByPhoneNumberId = phoneNumberId
    ? pickSingleMatch(
        accounts.filter((a) => {
          const creds = a.credentials as { phone_number_id?: string };
          return creds.phone_number_id && norm(creds.phone_number_id) === norm(phoneNumberId);
        }),
      )
    : null;
  const matchedByPhone = phone
    ? pickSingleMatch(accounts.filter((a) => a.phone_number.replace(/\D/g, "") === phone))
    : null;
  return matchedByPhoneNumberId ?? matchedByPhone ?? null;
}

export function matchZapiAccount(accounts: WhatsAppAccount[], instanceId: string | undefined): WhatsAppAccount | null {
  if (!instanceId) return null;
  return pickSingleMatch(
    accounts.filter((a) => {
      const creds = a.credentials as { instance_id?: string };
      return creds.instance_id && norm(creds.instance_id) === norm(instanceId);
    }),
  );
}

export function matchEvolutionAccount(
  accounts: WhatsAppAccount[],
  input: { instanceCandidates: string[]; apikey?: string; server_url?: string },
): WhatsAppAccount | null {
  if (input.instanceCandidates.length === 0) return null;

  let matches = accounts.filter((a) => {
    const identities = getEvolutionAccountIdentities(a);
    return input.instanceCandidates.some((candidate) => identities.includes(norm(candidate)));
  });

  const apiKey = norm(input.apikey);
  if (matches.length > 1 && apiKey) {
    const narrowed = matches.filter((a) => {
      const creds = a.credentials as { api_key?: string };
      return creds.api_key && norm(creds.api_key) === apiKey;
    });
    if (narrowed.length > 0) matches = narrowed;
  }

  const serverUrl = normalizeUrl(input.server_url);
  if (matches.length > 1 && serverUrl) {
    const narrowed = matches.filter((a) => {
      const creds = a.credentials as { base_url?: string };
      return creds.base_url && normalizeUrl(creds.base_url) === serverUrl;
    });
    if (narrowed.length > 0) matches = narrowed;
  }

  return pickSingleMatch(matches);
}

/**
 * external_id e o id da mensagem no WhatsApp e so pode existir uma vez em
 * toda a tabela (busca global, sem filtro de tenant_id). Se ja existe em
 * outro tenant, e reentrega/retry do mesmo evento batendo em outra conta -
 * nunca deve ser inserida de novo em tenant nenhum.
 */
export function isCrossTenantDuplicate(
  existingMsg: { tenant_id: string } | null | undefined,
  currentTenantId: string,
): boolean {
  return Boolean(existingMsg) && existingMsg!.tenant_id !== currentTenantId;
}
