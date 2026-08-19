import type { ServiceOrderStatus } from "../supabase/database.types";

/** Grade da Agenda cobre esse intervalo do dia - o turno da tarde do ACT
 * historicamente vai ate 18h, mas atendimentos podem escorregar; a margem
 * de 07h-19h evita cortar um card que comece/termine perto da borda. */
export const AGENDA_START_HOUR = 7;
export const AGENDA_END_HOUR = 19;
export const AGENDA_PX_PER_MINUTE = 1.1;
export const AGENDA_MIN_CARD_MINUTES = 30;

export function agendaGridHeightPx() {
  return (AGENDA_END_HOUR - AGENDA_START_HOUR) * 60 * AGENDA_PX_PER_MINUTE;
}

/** Minutos desde o inicio da grade (pode dar negativo/maior que a grade se
 * o horario real estiver fora da janela - o card so aparece cortado, nunca
 * quebra o layout). */
export function minutesFromGridStart(iso: string, day: string): number {
  const date = new Date(iso);
  const gridStart = new Date(`${day}T${String(AGENDA_START_HOUR).padStart(2, "0")}:00:00-03:00`);
  return (date.getTime() - gridStart.getTime()) / 60000;
}

/** OS antiga (so shift, sem horario exato) ganha um horario nominal pra
 * aparecer na grade, visualmente marcada como "sem horario definido" -
 * nunca escrito de volta no banco sozinho, so exibido. */
export function fallbackWindowForShift(
  day: string,
  shift: "manha" | "tarde" | null,
): { startAt: string; endAt: string } | null {
  if (!shift) return null;
  const hour = shift === "manha" ? 9 : 14;
  const startAt = `${day}T${String(hour).padStart(2, "0")}:00:00-03:00`;
  const end = new Date(startAt);
  end.setHours(end.getHours() + 1);
  return { startAt: new Date(startAt).toISOString(), endAt: end.toISOString() };
}

export function deriveShiftFromTime(iso: string): "manha" | "tarde" {
  const hour = new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  });
  return Number(hour) < 12 ? "manha" : "tarde";
}

export function formatHourMinute(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type AgendaCardTone = "amarelo" | "azul" | "roxo" | "verde" | "laranja" | "vermelho" | "cinza";

/** Mapa de cor pedido: cada cor tem um so significado, sobrepoe pendencia
 * por cima de tudo pra nunca esconder um problema atras da cor de status. */
export function agendaCardTone(order: {
  status: ServiceOrderStatus;
  confirmedAt: string | null;
  hasPendingIssue: boolean;
}): AgendaCardTone {
  if (order.hasPendingIssue) return "vermelho";
  if (order.status === "cancelada") return "cinza";
  if (order.status === "remarcada") return "laranja";
  if (order.status === "em_execucao") return "roxo";
  if (["concluida", "conferida", "faturada"].includes(order.status)) return "verde";
  if (order.status === "agendada") return order.confirmedAt ? "azul" : "amarelo";
  return "amarelo";
}

// Paleta pastel (fundo solido claro + texto escuro, nao so opacidade baixa
// sobre fundo escuro): esta agenda e usada por uma administradora que pediu
// cores mais suaves e de facil leitura, nao o tom vibrante/baixo-contraste
// de antes.
export const AGENDA_TONE_CLASSES: Record<AgendaCardTone, { border: string; bg: string; text: string }> = {
  amarelo: { border: "border-amber-300", bg: "bg-amber-100", text: "text-amber-800" },
  azul: { border: "border-blue-300", bg: "bg-blue-100", text: "text-blue-800" },
  roxo: { border: "border-violet-300", bg: "bg-violet-100", text: "text-violet-800" },
  verde: { border: "border-emerald-300", bg: "bg-emerald-100", text: "text-emerald-800" },
  laranja: { border: "border-orange-300", bg: "bg-orange-100", text: "text-orange-800" },
  vermelho: { border: "border-rose-300", bg: "bg-rose-100", text: "text-rose-800" },
  cinza: { border: "border-slate-300", bg: "bg-slate-100", text: "text-slate-600" },
};

export const AGENDA_TONE_LABEL: Record<AgendaCardTone, string> = {
  amarelo: "A confirmar",
  azul: "Confirmada",
  roxo: "Em atendimento",
  verde: "Finalizada",
  laranja: "Remarcar",
  vermelho: "Pendência",
  cinza: "Cancelada",
};

export function brtDay(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function offsetDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00-03:00`);
  date.setDate(date.getDate() + amount);
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function humanDay(day: string): string {
  return new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}
