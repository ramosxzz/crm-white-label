const API4COM_BASE_URL = "https://api.api4com.com/api/v1";

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
    throw new Error(`Falha ao iniciar ligacao (${res.status}): ${text}`);
  }

  return res.json();
}
