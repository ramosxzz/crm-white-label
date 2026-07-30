import Link from "next/link";
import { ChevronRight, MapPin, Sun, Sunset } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { formatCurrencyBRL } from "@/lib/utils";
import { formatServiceOrderCode, SERVICE_ORDER_STATUS_LABEL } from "@/lib/field-service/status";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import { OfflineCache } from "./offline-cache";
import { cn } from "@/lib/utils";

function brtDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const SHIFTS = [
  { value: "manha" as const, label: "Manhã", Icon: Sun },
  { value: "tarde" as const, label: "Tarde", Icon: Sunset },
];

function shortAddress(order: any) {
  return (
    [
      [order.address_street, order.address_number].filter(Boolean).join(", "),
      order.address_district,
    ]
      .filter(Boolean)
      .join(" · ") || "Endereço não informado"
  );
}

export default async function CampoPage({
  searchParams,
}: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const ctx = await requireContext();
  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day ?? "") ? params!.day! : brtDay();

  const supabase = await createClient();

  // A RLS ja limita: tecnico so recebe as OS em que ele esta alocado.
  const { data: orders } = await supabase
    .from("service_orders")
    .select("*, leads(name, phone)")
    .eq("tenant_id", ctx.tenantId)
    .eq("service_date", day)
    .order("route_position", { ascending: true, nullsFirst: false });

  const rows = (orders ?? []) as any[];

  return (
    <div className="space-y-6 p-4">
      {/* Guarda o turno no celular pra abrir sem rede na casa do cliente. */}
      <OfflineCache orders={rows} storagePrefix={ctx.tenantId} />

      <div>
        <h1 className="font-display text-xl font-semibold">Meu dia</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
          })}
        </p>
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
          <p className="font-medium">Nenhuma OS pra hoje</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando o escritório montar o roteiro, suas visitas aparecem aqui.
          </p>
        </div>
      )}

      {SHIFTS.map(({ value, label, Icon }) => {
        const list = rows.filter((order) => order.shift === value);
        if (list.length === 0) return null;
        return (
          <section key={value} className="space-y-2">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
              <Icon className="h-4 w-4 text-brand" /> {label}
              <span className="text-muted-foreground">({list.length})</span>
            </h2>
            <ul className="space-y-2">
              {list.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/campo/${order.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card p-4 shadow-elev-1 transition-colors active:bg-brand/5",
                      ["concluida", "conferida", "faturada"].includes(order.status)
                        ? "border-success/40 bg-success/5"
                        : order.status === "assistencia"
                          ? "border-info/40 bg-info/5"
                          : "border-border/70",
                    )}
                  >
                    {order.route_position != null && (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                        {order.route_position}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{order.leads?.name ?? "Cliente"}</p>
                      <p className="mt-0.5 inline-flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{shortAddress(order)}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatServiceOrderCode(order.code_seq)} ·{" "}
                        {SERVICE_ORDER_STATUS_LABEL[order.status as ServiceOrderStatus]} ·{" "}
                        {formatCurrencyBRL(order.total_cents)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
