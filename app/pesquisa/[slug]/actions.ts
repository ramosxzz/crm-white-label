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
    .min(1, "Avalie pelo menos uma funcionária"),
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
  const validRatings = parsed.data.ratings.filter((r) => employees.includes(r.employee_name));
  if (validRatings.length === 0) {
    return { ok: false as const, error: "Avalie pelo menos uma funcionária valida." };
  }

  const { data: response, error } = await supabase
    .from("satisfaction_survey_responses")
    .insert({
      tenant_id: form.tenant_id,
      nps_score: parsed.data.nps_score,
      comments: parsed.data.comments || null,
      channel: parsed.data.slug,
    })
    .select("id")
    .single();

  if (error || !response) {
    return { ok: false as const, error: "Nao foi possivel enviar. Tenta de novo em instantes." };
  }

  const { error: ratingsError } = await supabase.from("satisfaction_survey_employee_ratings").insert(
    validRatings.map((r) => ({
      response_id: response.id,
      tenant_id: form.tenant_id,
      employee_name: r.employee_name,
      service_rating: r.service_rating,
    })),
  );

  if (ratingsError) {
    return { ok: false as const, error: "Nao foi possivel enviar. Tenta de novo em instantes." };
  }

  return { ok: true as const };
}
