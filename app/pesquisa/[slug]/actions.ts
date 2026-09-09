"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const submitSchema = z.object({
  slug: z.string().min(1),
  ratings: z
    .array(
      z.object({
        employee_name: z.string().trim().min(1).max(200),
        service_rating: z.number().int().min(1).max(5),
      }),
    )
    .min(1, "Avalie pelo menos uma funcionária")
    .max(100)
    .refine((ratings) => new Set(ratings.map((r) => r.employee_name)).size === ratings.length,
      "Cada funcionária pode ser avaliada uma vez"),
  nps_score: z.number().int().min(0).max(10),
  comments: z.string().trim().max(4000).optional(),
  // honeypot - campo invisivel pro humano, se vier preenchido e bot
  website: z.string().max(2000).optional(),
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
  const validRatings = parsed.data.ratings.filter((r) => employees.includes(r.employee_name));
  if (validRatings.length === 0) {
    return { ok: false as const, error: "Avalie pelo menos uma funcionária valida." };
  }

  const { data: response, error } = await supabase.rpc("submit_satisfaction_survey_atomic", {
    p_slug: parsed.data.slug,
    p_nps_score: parsed.data.nps_score,
    p_comments: parsed.data.comments || "",
    p_ratings: validRatings,
  });

  if (error || !response) {
    console.error("[pesquisa] erro ao inserir response:", error);
    return { ok: false as const, error: "Nao foi possivel enviar. Tenta de novo em instantes." };
  }

  return { ok: true as const };
}
