import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitExceededResponse, applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { getIdempotentResponse, saveIdempotentResponse } from "@/lib/api/idempotency";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Idempotency-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const apiKey = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");

  // Rate limit por IP e chave (limite de 60 requisições por minuto)
  const rateLimitKey = `intake:${apiKey || "anonymous"}:${ip}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, { limit: 60, windowMs: 60_000 });

  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult, cors);
  }

  if (!apiKey) {
    const res = NextResponse.json({ error: "Missing x-api-key" }, { status: 401, headers: cors });
    applyRateLimitHeaders(res.headers, rateLimitResult);
    return res;
  }

  const supabase = createServiceClient();
  const { data: keyRow, error: keyErr } = await supabase
    .from("lead_intake_keys")
    .select("id, tenant_id, source_label, is_active")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (keyErr || !keyRow || !keyRow.is_active) {
    const res = NextResponse.json({ error: "Invalid or inactive key" }, { status: 401, headers: cors });
    applyRateLimitHeaders(res.headers, rateLimitResult);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) body = await req.json();
    else if (ct.includes("form")) {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
    } else body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  // Idempotency Check
  const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const { cached, conflict } = await getIdempotentResponse(supabase, {
      key: idempotencyKey,
      tenantId: keyRow.tenant_id,
      endpoint: "/api/intake/lead",
      payload: body,
    });

    if (conflict) {
      const res = NextResponse.json(
        { error: "Idempotency key conflict", message: "Esta chave de idempotencia ja foi usada com parâmetros diferentes." },
        { status: 422, headers: cors }
      );
      applyRateLimitHeaders(res.headers, rateLimitResult);
      return res;
    }

    if (cached) {
      const res = NextResponse.json(cached.responseBody, {
        status: cached.responseStatus,
        headers: { ...cors, "X-Cache": "HIT-IDEMPOTENT" },
      });
      applyRateLimitHeaders(res.headers, rateLimitResult);
      return res;
    }
  }

  const name = String(body.name || body.fullName || body.full_name || "").trim();
  if (!name) {
    const res = NextResponse.json({ error: "Missing 'name'" }, { status: 400, headers: cors });
    applyRateLimitHeaders(res.headers, rateLimitResult);
    return res;
  }

  const email = body.email ? String(body.email) : null;
  const phone = body.phone ? String(body.phone) : null;
  const valueRaw = body.value ?? body.amount;
  const value = typeof valueRaw === "number" ? valueRaw : valueRaw ? Number(valueRaw) || null : null;
  const notes = body.notes ? String(body.notes) : body.message ? String(body.message) : null;
  const source = body.source ? String(body.source) : keyRow.source_label || "web";

  const { data: pipe } = await supabase
    .from("pipelines")
    .select("id")
    .eq("tenant_id", keyRow.tenant_id)
    .eq("is_default", true)
    .maybeSingle();

  // Sem pipeline padrao configurado pro tenant, nao ha etapa inicial pra
  // buscar - segue sem stage_id em vez de mandar undefined pro filtro.
  const { data: stage } = pipe?.id
    ? await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("tenant_id", keyRow.tenant_id)
        .eq("pipeline_id", pipe.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      tenant_id: keyRow.tenant_id,
      pipeline_id: pipe?.id,
      stage_id: stage?.id,
      name,
      email,
      phone,
      // Coluna real e value_cents (inteiro). "value" nao existe na tabela -
      // o Supabase vinha descartando o valor em silencio em toda integracao
      // externa que mandasse esse campo, sem erro nenhum no retorno.
      value_cents: value != null ? Math.round(value * 100) : null,
      notes,
      source,
    })
    .select("id")
    .single();

  if (leadErr) {
    const res = NextResponse.json({ error: leadErr.message }, { status: 500, headers: cors });
    applyRateLimitHeaders(res.headers, rateLimitResult);
    return res;
  }

  const responseBody = { ok: true, lead_id: lead.id };

  if (idempotencyKey) {
    await saveIdempotentResponse(supabase, {
      key: idempotencyKey,
      tenantId: keyRow.tenant_id,
      endpoint: "/api/intake/lead",
      payload: body,
      status: 201,
      body: responseBody,
    });
  }

  const res = NextResponse.json(responseBody, { status: 201, headers: cors });
  applyRateLimitHeaders(res.headers, rateLimitResult);
  return res;
}
