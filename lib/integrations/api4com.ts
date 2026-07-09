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
