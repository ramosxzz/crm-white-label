/** Valida telefone brasileiro para WhatsApp (12–13 dígitos, DDI 55). */
export function isValidBrazilWhatsAppPhone(phone: string): boolean {
  const n = phone.replace(/\D/g, "");
  if (n.length < 12 || n.length > 13) return false;
  if (!n.startsWith("55")) return false;

  const ddd = Number(n.slice(2, 4));
  if (ddd < 11 || ddd > 99) return false;

  const local = n.slice(4);
  if (local.length === 9 && local[0] === "9") return true;
  if (local.length === 8) return true;
  return false;
}

/**
 * Valida um telefone internacional no formato usado pelo WhatsApp:
 * somente dígitos, com DDI, respeitando o limite do E.164.
 *
 * A validação detalhada de DDD/nono dígito continua existindo para o Brasil.
 * Para outros países não tentamos manter uma tabela própria de planos de
 * numeração, porque ela muda e o WhatsApp já entrega o wa_id com DDI.
 */
export function isValidWhatsAppPhone(phone: string): boolean {
  const n = phone.replace(/\D/g, "");
  if (n.length < 8 || n.length > 15 || n.startsWith("0")) return false;
  if (n.startsWith("55")) return isValidBrazilWhatsAppPhone(n);
  return true;
}

/** Normaliza telefone para WhatsApp (DDI + número). Retorna vazio se inválido. */
export function normalizeWhatsAppPhone(phone: string, defaultCountryCode = "55"): string {
  const raw = phone.trim();
  if (!raw || raw.includes("@lid") || raw.includes("@")) return "";

  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");

  // IDs longos do WhatsApp (LID sem @) — não são telefone
  if (digits.length > 15) return "";

  const cc = defaultCountryCode.replace(/\D/g, "");

  // "+" torna o DDI explícito. Webhooks dos provedores normalmente mandam
  // só os dígitos, mas já com DDI; por isso tentamos primeiro o Brasil local
  // e, se ele não formar um número BR válido, preservamos o número
  // internacional recebido (ex.: 16177508340).
  if (raw.startsWith("+")) {
    return isValidWhatsAppPhone(digits) ? digits : "";
  }

  if (isValidBrazilWhatsAppPhone(digits)) return digits;

  if (cc && digits.length >= 10 && digits.length <= 11) {
    const withDefaultCountry = cc + digits;
    if (isValidBrazilWhatsAppPhone(withDefaultCountry)) return withDefaultCountry;
  }

  return isValidWhatsAppPhone(digits) ? digits : "";
}

/** Chaves equivalentes para buscar o mesmo número no banco. */
export function phoneMatchKeys(phone: string): string[] {
  const canonical = normalizeWhatsAppPhone(phone);
  if (!canonical) return [];

  const keys = new Set<string>([canonical]);
  // As variações sem DDI são legado exclusivamente brasileiro. Cortar os
  // primeiros dois dígitos de um telefone internacional confundiria o DDI
  // com parte do número e poderia vincular clientes de países diferentes.
  if (canonical.startsWith("55")) {
    keys.add(canonical.slice(2));
    keys.add(canonical.slice(-11));
    if (canonical.length >= 10) keys.add(canonical.slice(-10));
  }
  return [...keys];
}

export function phonesEquivalent(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ka = new Set(phoneMatchKeys(a));
  return phoneMatchKeys(b).some((k) => ka.has(k));
}
