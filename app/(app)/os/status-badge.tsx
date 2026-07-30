import { Badge } from "@/components/ui/badge";
import { SERVICE_ORDER_STATUS_LABEL } from "@/lib/field-service/status";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";

type BadgeVariant = "outline" | "info" | "warning" | "success" | "brand" | "destructive" | "secondary";

const variantByStatus: Record<ServiceOrderStatus, BadgeVariant> = {
  rascunho: "outline",
  agendada: "info",
  em_execucao: "warning",
  concluida: "brand",
  conferida: "secondary",
  faturada: "success",
  cancelada: "destructive",
  remarcada: "outline",
  assistencia: "info",
};

export function ServiceOrderStatusBadge({ status }: { status: ServiceOrderStatus }) {
  return <Badge variant={variantByStatus[status]}>{SERVICE_ORDER_STATUS_LABEL[status]}</Badge>;
}
