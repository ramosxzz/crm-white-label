import Link from "next/link";
import { AlertTriangle, Bell, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "@/lib/leads/dashboard-metrics";

const TONE_STYLES: Record<AttentionItem["tone"], { icon: React.ComponentType<{ className?: string }>; badge: string; iconColor: string }> = {
  critical: { icon: AlertTriangle, badge: "bg-destructive/10 text-destructive", iconColor: "text-destructive" },
  warning: { icon: Bell, badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400", iconColor: "text-amber-600 dark:text-amber-400" },
  info: { icon: Info, badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400", iconColor: "text-sky-600 dark:text-sky-400" },
};

/**
 * O que realmente precisa de acao agora - nao e mais um cartao de metrica,
 * e uma lista de coisas clicaveis. So entra aqui o que da pra calcular com
 * dado real (ver lib/leads/dashboard-metrics.ts / page.tsx pra origem de
 * cada item); nada de numero inventado.
 */
export function AttentionRequired({ items }: { items: AttentionItem[] }) {
  const pending = items.filter((item) => item.count > 0);

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle>Precisa da sua atenção</CardTitle>
        <CardDescription>O que está pendente agora, com link direto pra resolver.</CardDescription>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <EmptyState compact message="Tudo em dia — nada pendente no momento." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {pending.map((item) => {
              const style = TONE_STYLES[item.tone];
              const Icon = style.icon;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3.5 py-3 transition-colors hover:border-brand/40 hover:bg-brand/5"
                  >
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", style.badge)}>
                      <Icon className={cn("h-4 w-4", style.iconColor)} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <strong className="tabular-nums">{item.count}</strong> {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
