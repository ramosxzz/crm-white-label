import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Tira acento, caixa e espaco duplo/asterisco de negrito pra comparar frase
 * digitada com frase configurada sem depender de formatacao exata. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Move o lead sozinho quando o atendente manda uma mensagem que contem a
 * frase configurada na etapa (Cláusula da Atacado Moda Sul: "*tudo bem?*"
 * -> Em atendimento, "segue chave Pix" -> Orcamento etc). Primeira etapa do
 * tenant cuja frase bater com o texto enviado vence; sem falar nada quando
 * nenhuma etapa tem frase configurada (custo zero pra quem nao usa).
 */
export async function applyStageTriggerPhrase(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  leadId: string,
  messageBody: string,
): Promise<void> {
  const body = messageBody?.trim();
  if (!body) return;

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, pipeline_id, trigger_phrase")
    .eq("tenant_id", tenantId)
    .not("trigger_phrase", "is", null);
  if (!stages || stages.length === 0) return;

  const normalizedBody = normalize(body);
  const match = stages.find((stage) => {
    const phrase = (stage as { trigger_phrase: string | null }).trigger_phrase;
    if (!phrase?.trim()) return false;
    return normalizedBody.includes(normalize(phrase));
  });
  if (!match) return;

  const { data: lead } = await supabase
    .from("leads")
    .select("stage_id")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  // Ja esta na etapa - nao ha o que mover, e evita disparo repetido de
  // automacao de mudanca de etapa a cada mensagem com a mesma frase.
  if (!lead || lead.stage_id === match.id) return;

  await supabase
    .from("leads")
    .update({ stage_id: match.id, pipeline_id: match.pipeline_id })
    .eq("id", leadId)
    .eq("tenant_id", tenantId);
}
