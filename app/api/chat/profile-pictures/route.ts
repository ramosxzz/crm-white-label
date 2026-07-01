import { NextRequest, NextResponse } from "next/server";
import { requireContext } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import {
  getCachedWhatsAppProfilePicture,
  syncLeadWhatsAppProfilePicture,
} from "@/lib/whatsapp/profile-picture";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  const body = (await req.json().catch(() => null)) as { leadIds?: unknown } | null;
  const leadIds = Array.isArray(body?.leadIds)
    ? [...new Set(body.leadIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 30)
    : [];

  if (leadIds.length === 0) return NextResponse.json({ avatars: {} });

  const supabase = createServiceClient();
  const { data: accounts } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  const account = (accounts?.[0] as WhatsAppAccount | undefined) ?? null;
  if (!account) return NextResponse.json({ avatars: {} });

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, tenant_id, phone, custom_fields")
    .eq("tenant_id", ctx.tenantId)
    .in("id", leadIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const avatars: Record<string, string | null> = {};
  for (const lead of leads ?? []) {
    const fields = (lead.custom_fields as Record<string, unknown> | null) ?? null;
    const avatarUrl = await syncLeadWhatsAppProfilePicture(supabase, account, {
      id: lead.id,
      tenant_id: lead.tenant_id,
      phone: lead.phone,
      custom_fields: fields,
    });
    avatars[lead.id] = avatarUrl ?? getCachedWhatsAppProfilePicture(fields);
  }

  return NextResponse.json({ avatars });
}
