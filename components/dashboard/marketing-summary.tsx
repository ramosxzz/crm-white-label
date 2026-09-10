"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, DollarSign, Megaphone, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import type { MetaAdsDashboardData } from "@/lib/meta/ads-insights";
import { MetaAdsPanel } from "@/components/dashboard/meta-ads-panel";

/**
 * Meta Ads ocupava a tela inteira, zerado, mesmo sem conta conectada -
 * virava a maior secao da dashboard sem ter dado nenhum. Aqui so um resumo
 * de 4 numeros sempre visivel; o painel completo (que ja existia e continua
 * igual) so aparece se a pessoa abrir - e substitui o resumo, em vez de
 * cartao dentro de cartao.
 */
export function MarketingSummary({ data }: { data: MetaAdsDashboardData }) {
  const [expanded, setExpanded] = useState(false);
  const configured = data.status !== "not_configured";

  if (!configured) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand ring-1 ring-brand/20">
              <Megaphone className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Meta Ads não configurado</p>
              <p className="text-xs text-muted-foreground">Conecte sua conta para acompanhar campanhas.</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations/facebook">Configurar Meta</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (expanded) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5 rotate-180" /> Recolher
        </button>
        <MetaAdsPanel data={data} />
      </div>
    );
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => setExpanded(true)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded(true)}
      className="cursor-pointer border-border/60 bg-card/80 transition-colors hover:border-brand/40"
    >
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4 text-brand" /> Meta Ads
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
            Ver análise completa <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
          </span>
        </div>
        {data.status === "error" ? (
          <EmptyState compact message={data.error ?? "Meta Ads não respondeu no período."} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat icon={<DollarSign className="h-3.5 w-3.5" />} label="Investimento" value={formatCurrencyBRL(data.totals.spendCents)} />
            <MiniStat icon={<Users className="h-3.5 w-3.5" />} label="Leads" value={`${data.totals.leads}`} />
            <MiniStat icon={<Users className="h-3.5 w-3.5" />} label="CPL" value={formatCurrencyBRL(data.totals.cplCents)} />
            <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="ROAS" value={`${data.totals.roas.toFixed(2)}x`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
