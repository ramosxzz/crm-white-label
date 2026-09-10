import Link from "next/link";
import {
  Target,
  Megaphone,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  BadgeCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import type { MetaAdsDashboardData } from "@/lib/meta/ads-insights";
import { MetaAdsDateFilter } from "@/components/dashboard/meta-ads-date-filter";

export function MetaAdsPanel({ data }: { data: MetaAdsDashboardData }) {
  const configured = data.status !== "not_configured";
  const hasRows = data.rows.length > 0;
  const hasMetaLeads = data.totals.leads > 0;
  const hasCrmAttribution = (data.totals.crmSales ?? 0) > 0 || (data.totals.crmRevenueCents ?? 0) > 0;

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/50">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-brand" />
            Meta Ads
          </CardTitle>
          <CardDescription>
            ROAS, CAC, gasto e desempenho de campanhas conectadas ao workspace.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetaAdsDateFilter current={data.datePreset} />
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations/facebook">Configurar Meta</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {!configured && (
          <MetaNotice
            title="Conecte a conta de anúncios"
            message="Informe o ID da conta de anúncios e um token com permissão ads_read para habilitar o dashboard de mídia paga."
          />
        )}

        {data.status === "error" && (
          <MetaNotice
            tone="danger"
            title="Meta Ads não respondeu"
            message={data.error ?? "Revise o token, a conta de anúncios e as permissões da Marketing API."}
          />
        )}

        {data.status === "ready" && hasMetaLeads && !hasCrmAttribution && (
          <MetaNotice
            title="Atribuição do CRM em aprendizado"
            message="A Meta retornou leads/conversas no período, mas nenhum negócio ganho do CRM está vinculado a um anúncio ainda. Novas conversas vindas de anúncio serão salvas com a referência da campanha para calcular vendas e ROAS do CRM."
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <MiniMetric icon={<DollarSign className="h-4 w-4" />} label="Gasto" value={formatCurrencyBRL(data.totals.spendCents)} />
          <MiniMetric icon={<ShoppingCart className="h-4 w-4" />} label="Conversões (Meta)" value={`${data.totals.purchases}`} hint={`${formatCurrencyBRL(data.totals.revenueCents)} em vendas`} />
          <MiniMetric icon={<TrendingUp className="h-4 w-4" />} label="ROAS" value={`${data.totals.roas.toFixed(2)}x`} hint={formatCurrencyBRL(data.totals.revenueCents)} />
          <MiniMetric icon={<Users className="h-4 w-4" />} label="CPL" value={formatCurrencyBRL(data.totals.cplCents)} hint={`${data.totals.leads} lead(s) · custo por lead`} />
          <MiniMetric icon={<Target className="h-4 w-4" />} label="CAC" value={formatCurrencyBRL(data.totals.cacCents)} hint={`${data.totals.purchases} venda(s) · custo por cliente`} />
          <MiniMetric icon={<MousePointerClick className="h-4 w-4" />} label="Cliques / Conversas" value={`${data.totals.clicks} / ${data.totals.leads}`} hint={`${data.totals.impressions} impressoes`} />
          <MiniMetric
            icon={<BadgeCheck className="h-4 w-4" />}
            label="Vendas no CRM"
            value={`${data.totals.crmSales ?? 0}`}
            hint={`${formatCurrencyBRL(data.totals.crmRevenueCents ?? 0)} · negócios ganhos com anúncio vinculado`}
          />
        </div>

        {configured && !hasRows ? (
          <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
            Nenhum anúncio com gasto encontrado no período.
          </div>
        ) : (
          hasRows && (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Anúncio</th>
                    <th className="px-4 py-2.5 font-medium">Campanha</th>
                    <th className="px-4 py-2.5 font-medium text-right">Gasto</th>
                    <th className="px-4 py-2.5 font-medium text-right">Leads</th>
                    <th className="px-4 py-2.5 font-medium text-right">Vendas (Meta)</th>
                    <th className="px-4 py-2.5 font-medium text-right">Vendas (CRM)</th>
                    <th className="px-4 py-2.5 font-medium text-right">CPL</th>
                    <th className="px-4 py-2.5 font-medium text-right">CAC</th>
                    <th className="px-4 py-2.5 font-medium text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.rows.slice(0, 8).map((row) => {
                    const cplCents = row.leads > 0 ? Math.round(row.spendCents / row.leads) : 0;
                    const cacCents = row.purchases > 0 ? Math.round(row.spendCents / row.purchases) : 0;
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-brand/8 dark:hover:bg-brand/12">
                        <td className="max-w-[18rem] px-4 py-3">
                          <p className="truncate font-semibold">{row.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{row.adsetName}</p>
                        </td>
                        <td className="max-w-[16rem] truncate px-4 py-3 text-muted-foreground">{row.campaignName}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrencyBRL(row.spendCents)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.leads}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.purchases}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="tabular-nums font-semibold">{row.crmSales ?? 0}</span>
                          {(row.crmRevenueCents ?? 0) > 0 && (
                            <p className="text-xs text-muted-foreground">{formatCurrencyBRL(row.crmRevenueCents ?? 0)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{cplCents > 0 ? formatCurrencyBRL(cplCents) : "—"}</td>
                        <td className="px-4 py-3 text-right">{cacCents > 0 ? formatCurrencyBRL(cacCents) : "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold">{row.roas.toFixed(2)}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

export function MetaNotice({
  title,
  message,
  tone = "neutral",
}: {
  title: string;
  message: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-brand/20 bg-brand/10 text-foreground",
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className={cn("mt-0.5 text-xs", tone === "danger" ? "text-destructive/85" : "text-muted-foreground")}>
          {message}
        </p>
      </div>
    </div>
  );
}

export function MiniMetric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand/12 text-brand ring-1 ring-brand/20">
        {icon}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
