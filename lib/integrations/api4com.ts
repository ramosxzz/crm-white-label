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

export async function fetchApi4comCalls(): Promise<Api4comCall[]> {
  const token = process.env.API4COM_TOKEN;
  if (!token) return [];

  const calls: Api4comCall[] = [];
  let page = 1;
  let totalPageCount = 1;

  do {
    const res = await fetch(`${API4COM_BASE_URL}/calls?page=${page}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!res.ok) break;

    const payload = (await res.json().catch(() => null)) as {
      data?: Api4comCall[];
      meta?: { totalPageCount?: number };
    } | null;

    calls.push(...(payload?.data ?? []));
    totalPageCount = payload?.meta?.totalPageCount ?? 1;
    page++;
  } while (page <= totalPageCount && page <= 10);

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
