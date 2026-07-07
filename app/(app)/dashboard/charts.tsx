"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export function LeadsByStageChart({ data }: { data: { name: string; color: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={gridColor} />
        <XAxis type="number" allowDecimals={false} fontSize={11} stroke={axisColor} tickLine={false} />
        <YAxis type="category" dataKey="name" fontSize={11} stroke={axisColor} width={108} tickLine={false} />
        <Tooltip cursor={{ fill: tooltipCursor }} content={<ChartTooltip />} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LeadsPerDayChart({ data }: { data: { date: string; count: number }[] }) {
  const formatted = data.map((d) => ({ ...d, label: d.label ?? d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={formatted}>
        <defs>
          <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="label" fontSize={11} stroke={axisColor} tickLine={false} />
        <YAxis fontSize={11} allowDecimals={false} stroke={axisColor} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ stroke: "hsl(var(--brand))", strokeWidth: 1 }} content={<ChartTooltip />} />
        <Area type="monotone" dataKey="count" stroke="hsl(var(--brand))" strokeWidth={2} fill="url(#brandGradient)" />
      </AreaChart>
    </ResponsiveContainer>
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
