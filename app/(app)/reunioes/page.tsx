import Link from "next/link";
import { redirect } from "next/navigation";
import { canSeeFullDashboard } from "@/lib/auth/roles";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Handshake,
  Clock,
  UserX,
  TrendingUp,
  DollarSign,
  Target,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

type Appt = {
  status: string;
  outcome: string | null;
  deal_value_cents: number | null;
  cost_cents: number | null;
  starts_at: string;
  closed_at: string | null;
};

const RANGES = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "12 meses" },
];

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pct(n: number, d: number) {
  if (!d) return "0%";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const ctx = await requireContext();
  // Painel mostra receita, custo e ROI do tenant inteiro - dado financeiro
  // que vendedor e tecnico nao devem ver, mesmo agregado. Faltava essa
  // checagem: a pagina so filtrava por tenant_id, sem olhar o papel.
  if (!canSeeFullDashboard(ctx.role)) redirect("/dashboard");
  const params = await searchParams;
  const range = RANGES.some((r) => r.value === params?.range) ? params!.range! : "30";
  const days = Number(range);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("status, outcome, deal_value_cents, cost_cents, starts_at, closed_at")
    .eq("tenant_id", ctx.tenantId)
    .gte("starts_at", since);

  const appts = (data ?? []) as Appt[];

  const canceladas = appts.filter((a) => a.status === "cancelled").length;
  const marcadas = appts.length - canceladas;
  const noShow = appts.filter((a) => a.outcome === "no_show").length;
  const feitas = appts.filter((a) =>
    ["done", "closed_on_call", "closed_later"].includes(a.outcome ?? ""),
  ).length;
  const fechouNaCall = appts.filter((a) => a.outcome === "closed_on_call").length;
  const fechouDepois = appts.filter((a) => a.outcome === "closed_later").length;
  const fechamentos = fechouNaCall + fechouDepois;

  const receita = appts.reduce((s, a) => s + (a.deal_value_cents ?? 0), 0);
  const custo = appts.reduce((s, a) => s + (a.cost_cents ?? 0), 0);
  const ticket = fechamentos ? receita / fechamentos : 0;
  const cac = fechamentos ? custo / fechamentos : 0;
  const lucro = receita - custo;
  const roi = custo ? (lucro / custo) * 100 : 0;

  const diasParaFechar = appts
    .filter((a) => a.outcome === "closed_later" && a.closed_at)
    .map((a) => (new Date(a.closed_at!).getTime() - new Date(a.starts_at).getTime()) / 86400000)
    .filter((d) => d >= 0);
  const mediaDias = diasParaFechar.length
    ? Math.round((diasParaFechar.reduce((s, d) => s + d, 0) / diasParaFechar.length) * 10) / 10
    : 0;

  const funnel = [
    { label: "Reuniões marcadas", value: marcadas, icon: CalendarClock, color: "bg-blue-500", base: marcadas },
    { label: "Reuniões feitas", value: feitas, icon: CalendarCheck, color: "bg-violet-500", base: marcadas },
    { label: "Fechamentos", value: fechamentos, icon: Handshake, color: "bg-emerald-500", base: marcadas },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Comercial"
        title="Dashboard de Reuniões"
        description="Funil de reuniões, taxas de conversão e retorno financeiro."
        actions={
          <div className="flex items-center gap-3">
          <Button asChild variant="brand" size="sm">
            <Link href="/agenda"><CalendarPlus className="h-4 w-4" /> Agendar reuniao</Link>
          </Button>
          <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
            {RANGES.map((r) => (
              <Link
                key={r.value}
                href={`/reunioes?range=${r.value}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  range === r.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {/* Funil */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-5 text-sm font-semibold text-muted-foreground">Funil de reuniões</h2>
            <div className="space-y-3">
              {funnel.map((step) => {
                const Icon = step.icon;
                const widthPct = step.base ? Math.max(8, (step.value / step.base) * 100) : 8;
                return (
                  <div key={step.label} className="flex items-center gap-4">
                    <div className="flex w-44 shrink-0 items-center gap-2 text-sm">
                      <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-white", step.color)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {step.label}
                    </div>
                    <div className="flex-1">
                      <div className="h-9 overflow-hidden rounded-lg bg-muted/40">
                        <div
                          className={cn("flex h-full items-center justify-end rounded-lg px-3 text-sm font-semibold text-white transition-all", step.color)}
                          style={{ width: `${widthPct}%` }}
                        >
                          {step.value}
                        </div>
                      </div>
                    </div>
                    <div className="w-16 shrink-0 text-right text-sm font-medium text-muted-foreground">
                      {pct(step.value, step.base)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detalhe das etapas */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={CalendarClock} color="text-blue-500" label="Marcadas" value={String(marcadas)} hint={`${canceladas} canceladas`} />
          <Stat icon={CalendarCheck} color="text-violet-500" label="Feitas" value={String(feitas)} hint={`Comparecimento ${pct(feitas, marcadas)}`} />
          <Stat icon={UserX} color="text-red-500" label="No-show" value={String(noShow)} hint={`${pct(noShow, marcadas)} dos marcados`} />
          <Stat icon={Handshake} color="text-emerald-500" label="Fechamentos" value={String(fechamentos)} hint={`Conversão ${pct(fechamentos, feitas)} das feitas`} />
        </div>

        {/* Tipos de fechamento */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={TrendingUp} color="text-emerald-500" label="Fechou na reunião" value={String(fechouNaCall)} hint={`${pct(fechouNaCall, feitas)} das feitas`} />
          <Stat icon={Clock} color="text-amber-500" label="Fechou depois" value={String(fechouDepois)} hint={mediaDias ? `Média de ${mediaDias} dias` : "—"} />
          <Stat icon={Percent} color="text-violet-500" label="Taxa de fechamento" value={pct(fechamentos, feitas)} hint="Fechamentos / feitas" />
          <Stat icon={Target} color="text-blue-500" label="Comparecimento" value={pct(feitas, marcadas)} hint="Feitas / marcadas" />
        </div>

        {/* Financeiro */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-5 text-sm font-semibold text-muted-foreground">Taxas e custos</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Money label="Receita gerada" value={brl(receita)} accent="text-emerald-600 dark:text-emerald-400" />
              <Money label="Custo total" value={brl(custo)} accent="text-red-600 dark:text-red-400" />
              <Money label="Lucro" value={brl(lucro)} accent={lucro >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
              <Money label="Ticket médio" value={brl(ticket)} accent="text-foreground" />
              <Money label="CAC (custo por fechamento)" value={brl(cac)} accent="text-foreground" />
              <Money label="ROI" value={`${Math.round(roi)}%`} accent={roi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Registre o desfecho de cada reunião na{" "}
          <Link href="/agenda" className="text-brand hover:underline">Agenda</Link>{" "}
          (feita, fechou na reunião, fechou depois) e informe valor e custo para alimentar este painel.
        </p>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  color,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Money({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <DollarSign className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn("mt-1.5 font-display text-xl font-semibold tabular-nums", accent)}>{value}</p>
    </div>
  );
}
