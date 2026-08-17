import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, User, Calendar, Tag, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const ctx = await requireContext();
  const isAdmin = canManageUsers(ctx.role);

  if (!isAdmin) {
    redirect("/settings");
  }

  const supabase = await createClient();
  const { data: logs } = await (supabase as any)
    .from("tenant_audit_logs")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  const auditLogs = (logs || []) as Array<{
    id: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    actor_name: string | null;
    actor_email: string | null;
    ip_address: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-normal flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand" />
            Trilha de Auditoria (Audit Log)
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro imutável de eventos críticos e ações realizadas na sua empresa.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Eventos Recentes ({auditLogs.length})</CardTitle>
              <CardDescription>Últimas 100 ações registradas</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5 py-1">
              <Activity className="h-3.5 w-3.5 text-success" />
              Auditoria Ativa
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-foreground">Nenhum evento registrado ainda</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ações importantes como exportações, exclusões e alterações de permissões aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {auditLogs.map((log: any) => {
                const date = new Date(log.created_at);
                const formattedDate = date.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <div key={log.id} className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {log.resource_type}
                          {log.resource_id ? `: ${log.resource_id}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <User className="h-3 w-3" />
                          {log.actor_name || log.actor_email || "Sistema / API"}
                        </span>
                        {log.ip_address && (
                          <span>• IP: {log.ip_address}</span>
                        )}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="text-xs font-mono bg-muted/60 rounded p-1.5 mt-1 text-muted-foreground max-w-2xl overflow-x-auto">
                          {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 sm:text-right shrink-0">
                      <Calendar className="h-3.5 w-3.5" />
                      {formattedDate}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
