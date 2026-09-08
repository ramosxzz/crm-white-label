"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const submitSchema = z.object({
  slug: z.string().min(1),
  employee_name: z.string().trim().min(1).max(200),
  service_rating: z.number().int().min(1).max(5).optional(),
  nps_score: z.number().int().min(0).max(10),
  comments: z.string().trim().max(4000).optional(),
  // honeypot - campo invisivel pro humano, se vier preenchido e bot
  website: z.string().max(0).optional(),
});

export async function submitSatisfactionSurvey(input: z.infer<typeof submitSchema>) {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Dados invalidos. Confira o formulario e tente de novo." };
  }
  if (parsed.data.website) {
    // honeypot preenchido - finge sucesso, nao insere nada
    return { ok: true as const };
  }

  const supabase = createServiceClient();
  const { data: form } = await supabase
    .from("satisfaction_survey_forms")
    .select("id, tenant_id, employees, is_active")
    .eq("slug", parsed.data.slug)
    .maybeSingle();

  if (!form || !form.is_active) {
    return { ok: false as const, error: "Formulario nao encontrado ou desativado." };
  }

  const employees = (form.employees as string[] | null) ?? [];
  if (!employees.includes(parsed.data.employee_name)) {
    return { ok: false as const, error: "Selecione uma funcionaria valida." };
  }

  const { error } = await supabase.from("satisfaction_survey_responses").insert({
    tenant_id: form.tenant_id,
    employee_name: parsed.data.employee_name,
    service_rating: parsed.data.service_rating ?? null,
    nps_score: parsed.data.nps_score,
    comments: parsed.data.comments || null,
    channel: parsed.data.slug,
  });

  if (error) {
    return { ok: false as const, error: "Nao foi possivel enviar. Tenta de novo em instantes." };
  }

  return { ok: true as const };
}
