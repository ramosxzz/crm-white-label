import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { Json } from "@/lib/supabase/database.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyBRL(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function normalizePhone(phone: string): string {
  return normalizeWhatsAppPhone(phone);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Marca um valor dinamico como pronto pra gravar numa coluna jsonb.
 *
 * `Json` e um tipo recursivo (string|number|boolean|null|objeto|array de Json)
 * que nenhuma interface do app satisfaz estruturalmente sozinha (ex.: um
 * array tipado como `unknown[]` nunca e `Json[]` pro TS, mesmo sendo
 * serializavel de verdade). Isso e so no boundary de escrita - depois de
 * volta do banco o dado e lido como `Json` mesmo, sem tipo proprio.
 */
export function toJson<T>(value: T): Json {
  return value as unknown as Json;
}
