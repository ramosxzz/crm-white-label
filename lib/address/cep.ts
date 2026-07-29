export type CepAddress = {
  street: string;
  district: string;
  city: string;
  state: string;
};

export function cepDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

/** Formata conforme digita: "93220640" -> "93220-640". Apagar continua livre. */
export function formatCep(value: string) {
  const digits = cepDigits(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Consulta o ViaCEP direto do browser: API publica, sem chave e com CORS
 * liberado, entao nao precisa passar pelo servidor nem gastar cota do Google.
 *
 * Devolve null quando o CEP nao existe - preencher na mao continua valendo,
 * porque o endereco nunca foi obrigatorio na OS.
 */
export async function lookupCep(value: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const digits = cepDigits(value);
  if (digits.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    erro?: boolean | string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  // CEP inexistente vem 200 com { "erro": true } (ja veio como string "true"
  // em algumas respostas), nao com status de erro.
  if (data.erro) return null;

  return {
    street: data.logradouro?.trim() ?? "",
    district: data.bairro?.trim() ?? "",
    city: data.localidade?.trim() ?? "",
    state: data.uf?.trim() ?? "",
  };
}
