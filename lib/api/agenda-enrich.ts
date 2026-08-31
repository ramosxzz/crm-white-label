import type { createServiceClient } from "@/lib/supabase/server";

export const AGENDA_SELECT =
  "id, lead_id, assigned_to, professional_id, service_id, starts_at, duration_minutes, notes, kind, status, created_at, updated_at";

export const AGENDA_SELECT_WITH_NAMES = `${AGENDA_SELECT}, leads(name, phone), professionals(name)`;

export type AgendaRow = {
  lead_id: string | null;
  assigned_to: string | null;
  leads?: { name: string | null; phone: string | null } | null;
  professionals?: { name: string | null } | null;
  [key: string]: unknown;
};

export async function withAssigneeNames(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  rows: AgendaRow[],
) {
  const assigneeIds = [...new Set(rows.map((r) => r.assigned_to).filter((v): v is string => !!v))];
  const namesById = new Map<string, string | null>();
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assigneeIds);
    for (const p of profiles ?? []) {
      namesById.set(p.id, p.full_name ?? null);
    }
  }
  return rows.map((row) => {
    const { leads, professionals, ...rest } = row;
    return {
      ...rest,
      lead_id: row.lead_id,
      assigned_to: row.assigned_to,
      lead_name: leads?.name ?? null,
      lead_phone: leads?.phone ?? null,
      assigned_to_name: row.assigned_to ? (namesById.get(row.assigned_to) ?? null) : null,
      professional_name: professionals?.name ?? null,
    };
  });
}
