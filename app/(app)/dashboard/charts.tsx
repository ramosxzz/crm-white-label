"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axisColor = "hsl(var(--foreground) / 0.78)";
const gridColor = "hsl(var(--foreground) / 0.16)";
const tooltipCursor = "hsl(var(--foreground) / 0.06)";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { name?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const value = Number(payload[0]?.value ?? 0);
  const title = payload[0]?.payload?.name ?? label;

  return (
    <div className="rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-elev-2">
      {title && <p className="font-semibold">{title}</p>}
      <p className="mt-1 text-muted-foreground">
        <span className="font-medium text-foreground">{value}</span> lead{value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const leads = payload.find((p) => p.dataKey === "leads")?.value ?? 0;
  const won = payload.find((p) => p.dataKey === "won")?.value ?? 0;

  return (
    <div className="rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-elev-2">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-muted-foreground">
        <span className="font-medium text-foreground">{leads}</span> lead{leads === 1 ? "" : "s"} recebido{leads === 1 ? "" : "s"}
      </p>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{won}</span> venda{won === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function LeadsTodayHourChart({ data }: { data: { hour: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="hour" fontSize={10} stroke={axisColor} tickLine={false} />
        <YAxis allowDecimals={false} fontSize={10} stroke={axisColor} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: tooltipCursor }} content={<ChartTooltip />} />
        <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * "Atividade comercial": leads recebidos x vendas fechadas, mesma janela de
 * 7 dias, pra responder uma pergunta real (o volume de entrada esta virando
 * venda?) em vez de so mostrar uma curva bonita.
 */
export function CommercialActivityChart({
  leadsTrend,
  wonTrend,
}: {
  leadsTrend: { date: string; label: string; count: number }[];
  wonTrend: { date: string; label: string; count: number }[];
}) {
  const wonByDate = new Map(wonTrend.map((d) => [d.date, d.count]));
  const data = leadsTrend.map((d) => ({
    label: d.label,
    leads: d.count,
    won: wonByDate.get(d.date) ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="label" fontSize={11} stroke={axisColor} tickLine={false} />
        <YAxis fontSize={11} allowDecimals={false} stroke={axisColor} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ stroke: "hsl(var(--brand))", strokeWidth: 1 }} content={<ActivityTooltip />} />
        <Area type="monotone" dataKey="leads" name="Leads recebidos" stroke="hsl(var(--brand))" strokeWidth={2} fill="url(#brandGradient)" />
        <Area type="monotone" dataKey="won" name="Vendas" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#successGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
