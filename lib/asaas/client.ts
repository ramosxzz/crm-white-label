const ASAAS_API = "https://api.asaas.com/v3";

function apiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY nao configurada");
  return key;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASAAS_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Asaas API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
}

export async function createAsaasCustomer(input: {
  name: string;
  email?: string;
  cpfCnpj?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  status: string;
  nextDueDate: string;
}

/** Cria uma assinatura recorrente mensal - o valor e por tenant (planos
 * diferentes: cliente inicial paga menos, cliente novo paga o cheio). */
export async function createAsaasSubscription(input: {
  customerId: string;
  valueCents: number;
  nextDueDate: string; // YYYY-MM-DD
  description: string;
  billingType?: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
  externalReference?: string;
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType ?? "UNDEFINED",
      value: input.valueCents / 100,
      nextDueDate: input.nextDueDate,
      cycle: "MONTHLY",
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export async function getAsaasSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}`);
}
