export type EvolutionPresenceUpdate = {
  /** Telefone (so digitos) de quem esta digitando/gravando. */
  phone: string;
  state: "composing" | "recording" | null;
};

/** Converte o evento presence.update da Evolution API (Baileys) num estado
 * simples: composing (digitando), recording (gravando audio), ou null
 * (parou - "paused"/"available"). Grupo (@g.us) e ignorado, so 1:1. */
export function parseEvolutionPresenceUpdate(payload: unknown): EvolutionPresenceUpdate | null {
  const p = payload as {
    event?: string;
    data?: {
      id?: string;
      presences?: Record<string, { lastKnownPresence?: string }>;
    };
  };
  if (p.event !== "presence.update" || !p.data) return null;

  const remote = p.data.id ?? "";
  if (!remote || remote.includes("@g.us")) return null;
  const phone = remote.split("@")[0]?.replace(/\D/g, "") ?? "";
  if (!phone) return null;

  const presences = p.data.presences ?? {};
  const raw = Object.values(presences)[0]?.lastKnownPresence;
  const state = raw === "composing" || raw === "recording" ? raw : null;

  return { phone, state };
}
