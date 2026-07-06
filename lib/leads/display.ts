import { formatPhoneBR } from "@/lib/utils";
import { isValidBrazilWhatsAppPhone } from "@/lib/whatsapp/phone";

/** Nome amigável para exibição (evita "Lead 182210263023778"). */
export function displayLeadName(
  name: string | null | undefined,
  phone?: string | null,
  tenantName?: string | null,
): string {
  const n = (name ?? "").trim();
  const canShowPhone = Boolean(phone && isValidBrazilWhatsAppPhone(phone));
  if (canShowPhone && shouldUsePhoneInsteadOfName(n, tenantName)) return formatPhoneBR(phone);
  if (/^Lead \d{10,}$/i.test(n)) {
    if (canShowPhone) return formatPhoneBR(phone);
    return "Contato WhatsApp";
  }
  if (!n) {
    if (canShowPhone) return formatPhoneBR(phone);
    return "Contato";
  }
  return n;
}

export function displayLeadSubtitle(phone: string | null | undefined): string {
  if (!phone) return "Sem telefone";
  if (isValidBrazilWhatsAppPhone(phone)) return formatPhoneBR(phone);
  return "Número oculto pelo WhatsApp";
}

function shouldUsePhoneInsteadOfName(name: string, tenantName?: string | null): boolean {
  const normalizedName = normalizeDisplayName(name);
  if (!normalizedName) return false;

  const normalizedTenant = normalizeDisplayName(tenantName ?? "");
  if (normalizedTenant && normalizedName === normalizedTenant) return true;

  return ["avante digital", "solaire w", "solaire w+", "solaire w crm"].includes(normalizedName);
}

function normalizeDisplayName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
