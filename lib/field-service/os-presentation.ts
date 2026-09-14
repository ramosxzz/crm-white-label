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

export function summarizeServiceItems(
  items: Array<{ quantity: number; description: string }>,
  limit = 3,
): string[] {
  return items.slice(0, limit).map((item) => `${item.quantity}x ${item.description}`);
}

export function formatOperationalWindow(startAt: string | null, endAt: string | null): string {
  if (!startAt || !endAt) return "Horário não definido";
  const format = (value: string) =>
    new Date(value).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${format(startAt)}–${format(endAt)}`;
}
