import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Navigation, Phone, Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  SERVICE_ORDER_SHIFT_LABEL,
  SERVICE_ORDER_STATUS_LABEL,
  formatServiceOrderCode,
  isServiceOrderLocked,
} from "@/lib/field-service/status";
import { navigationLink } from "@/lib/field-service/routing";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import { DamagesPanel } from "./damages-panel";
import { FieldStatusActions } from "./field-status-actions";
import { SignaturePad } from "./signature-pad";
import { UpsellPanel } from "./upsell-panel";

function fullAddress(order: any) {
  const street = [order.address_street, order.address_number].filter(Boolean).join(", ");
  const rest = [order.address_complement, order.address_district, order.address_city, order.address_state]
    .filter(Boolean)
    .join(" · ");
  return [street, rest].filter(Boolean).join(" — ") || "Endereço não informado";
}

export default async function CampoOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;

  const supabase = await createClient();

  // Sem linha aqui = OS inexistente OU nao atribuida a esse usuario (a RLS
  // filtra). Nos dois casos o tecnico so ve "nao encontrada".
  const { data: order } = await supabase
    .from("service_orders")
    .select("*, leads(name, phone)")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: damages }] = await Promise.all([
    supabase
      .from("service_order_items")
      .select("*")
      .eq("service_order_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("service_order_damages")
      .select("id, description, created_at")
      .eq("service_order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const status = order.status as ServiceOrderStatus;
  const locked = isServiceOrderLocked(status) || status === "concluida" || status === "conferida";
  const address = fullAddress(order);
  const mapsLink = navigationLink(order, address);

  return (
    <div className="space-y-4 p-4">
      <Link
        href="/campo"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Meu dia
      </Link>

      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold">
              {order.leads?.name ?? "Cliente"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {formatServiceOrderCode(order.code_seq)}
              {order.shift ? ` · ${SERVICE_ORDER_SHIFT_LABEL[order.shift as "manha" | "tarde"]}` : ""}
            </p>
          </div>
          <Badge variant={status === "em_execucao" ? "warning" : "outline"}>
            {SERVICE_ORDER_STATUS_LABEL[status]}
          </Badge>
        </div>

        <p className="text-sm">{address}</p>

        <div className="flex flex-wrap gap-2">
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground"
            >
              <Navigation className="h-4 w-4" /> Navegar
            </a>
          )}
          {order.leads?.phone && (
            <a
              href={`tel:${order.leads.phone}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium"
            >
              <Phone className="h-4 w-4" /> Ligar
            </a>
          )}
          {order.voltage && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium">
              <Plug className="h-4 w-4 text-muted-foreground" /> {order.voltage}
            </span>
          )}
        </div>
      </header>

      {order.observations && (
        <section className="rounded-xl border border-border/70 bg-muted/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Combinado na venda
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{order.observations}</p>
        </section>
      )}

      <UpsellPanel
        serviceOrderId={order.id}
        items={(items ?? []) as any[]}
        readOnly={locked}
      />

      <DamagesPanel
        serviceOrderId={order.id}
        damages={(damages ?? []) as any[]}
        readOnly={locked}
      />

      <SignaturePad
        serviceOrderId={order.id}
        signedAt={order.signed_at}
        signerName={order.signer_name}
      />

      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-elev-1">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total da OS</span>
          <span className="text-lg font-semibold">{formatCurrencyBRL(order.total_cents)}</span>
        </div>
        <FieldStatusActions
          serviceOrderId={order.id}
          status={status}
          hasSignature={Boolean(order.signed_at)}
        />
      </section>
    </div>
  );
}
