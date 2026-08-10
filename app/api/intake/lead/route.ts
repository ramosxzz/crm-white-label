import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-api-key" }, { status: 401, headers: cors });
  }

  const supabase = createServiceClient();
  const { data: keyRow, error: keyErr } = await supabase
    .from("lead_intake_keys")
    .select("id, tenant_id, source_label, is_active")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (keyErr || !keyRow || !keyRow.is_active) {
    return NextResponse.json({ error: "Invalid or inactive key" }, { status: 401, headers: cors });
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

  const name = String(body.name || body.fullName || body.full_name || "").trim();
  if (!name) return NextResponse.json({ error: "Missing 'name'" }, { status: 400, headers: cors });

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
    return NextResponse.json({ error: leadErr.message }, { status: 500, headers: cors });
  }

  return NextResponse.json({ ok: true, lead_id: lead.id }, { status: 201, headers: cors });
}
