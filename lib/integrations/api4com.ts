const API4COM_BASE_URL = "https://api.api4com.com/api/v1";

export class Api4comError extends Error {
  status: number;
  details: string;

  constructor(status: number, details: string) {
    super(friendlyApi4comError(status, details));
    this.name = "Api4comError";
    this.status = status;
    this.details = details;
  }
}

function friendlyApi4comError(status: number, details: string) {
  const normalized = details.toLowerCase();

  if (status === 422 && normalized.includes("user not registered")) {
    return "Ramal nao registrado na Api4com. Confira se este ramal existe na Api4com, se pertence ao usuario logado e se o Webphone/extensao esta online antes de ligar.";
  }

  if (status === 401 || status === 403) {
    return "Token da Api4com recusado. Confira a credencial da integracao.";
  }

  return `Falha ao iniciar ligacao na Api4com (${status}).`;
}

export type Api4comCall = {
  id: string;
  domain: string;
  call_type: "inbound" | "outbound" | string;
  started_at: string;
  ended_at: string | null;
  from: string;
  to: string;
  duration: number;
  hangup_cause: string;
  record_url: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  BINA: string | null;
  metadata: Record<string, unknown> | null;
};

// Cache curto em memoria: o polling do chat chama fetchApi4comCalls a cada
// ~1.2s quando ha atividade, e cada chamada varre ate 10 paginas da API da
// Api4com sem cache. Uma falha/timeout transitorio em qualquer pagina fazia o
// contador de ligacoes cair pra 0 (bolinha oscilando entre verde e amarelo) e
// voltar no poll seguinte. TTL curto reduz a carga na API externa e evita que
// uma falha isolada apague o resultado ja calculado.
const CALLS_CACHE_TTL_MS = 20_000;
let callsCache: { data: Api4comCall[]; expiresAt: number } | null = null;

export async function fetchApi4comCalls(): Promise<Api4comCall[]> {
  const token = process.env.API4COM_TOKEN;
  if (!token) return [];

  if (callsCache && callsCache.expiresAt > Date.now()) {
    return callsCache.data;
  }

  const calls: Api4comCall[] = [];
  let page = 1;
  let totalPageCount = 1;
  let hadFailure = false;

  do {
    const res = await fetch(`${API4COM_BASE_URL}/calls?page=${page}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!res.ok) {
      hadFailure = true;
      break;
    }

    const payload = (await res.json().catch(() => null)) as {
      data?: Api4comCall[];
      meta?: { totalPageCount?: number };
    } | null;

    calls.push(...(payload?.data ?? []));
    totalPageCount = payload?.meta?.totalPageCount ?? 1;
    page++;
  } while (page <= totalPageCount && page <= 10);

  // Falha parcial (ex: pagina 2 caiu): mantem o cache anterior em vez de
  // publicar uma lista truncada que faria o contador oscilar pra baixo.
  if (hadFailure && callsCache) {
    return callsCache.data;
  }

  callsCache = { data: calls, expiresAt: Date.now() + CALLS_CACHE_TTL_MS };
  return calls;
}

export async function triggerApi4comCall(input: {
  extension: string;
  phone: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const token = process.env.API4COM_TOKEN;
  if (!token) throw new Error("API4COM_TOKEN nao configurado");

  const res = await fetch(`${API4COM_BASE_URL}/dialer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      extension: input.extension,
      phone: input.phone,
      metadata: input.metadata ?? {},
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Api4comError(res.status, text);
  }

  return res.json();
}
