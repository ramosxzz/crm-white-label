"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Legend,
  Pie,
  PieChart,
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

function StageTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { name?: string } }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  const title = payload[0]?.payload?.name;
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-elev-2">
      {title && <p className="font-semibold">{title}</p>}
      <p className="mt-1 text-muted-foreground">
        <span className="font-medium text-foreground">{value}</span> lead{value === 1 ? "" : "s"}{" "}
        <span className="text-foreground">· {pct}%</span>
      </p>
    </div>
  );
}

// Cada estagio precisa de espaco proprio - com altura fixa e muitos estagios
// (funis com 10+ etapas) as barras viravam fiapos de 2px, ilegiveis.
const STAGE_ROW_HEIGHT = 30;

export function LeadsByStageChart({ data }: { data: { name: string; color: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const height = Math.max(220, data.length * STAGE_ROW_HEIGHT + 40);
  const longestLabel = data.reduce((max, d) => Math.max(max, d.name.length), 0);
  const axisWidth = Math.min(160, Math.max(88, longestLabel * 6));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={gridColor} />
        <XAxis type="number" allowDecimals={false} fontSize={11} stroke={axisColor} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          fontSize={11}
          stroke={axisColor}
          width={axisWidth}
          tickLine={false}
          interval={0}
        />
        <Tooltip cursor={{ fill: tooltipCursor }} content={<StageTooltip total={total} />} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            fontSize={11}
            fill={axisColor}
            formatter={(value: number) => (total > 0 ? `${value} · ${Math.round((value / total) * 100)}%` : `${value}`)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const DONUT_PALETTE_FALLBACK = "hsl(var(--brand))";

export function LeadsByStageDonut({ data }: { data: { name: string; color: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const top = [...data].sort((a, b) => b.count - a.count).slice(0, 6);
  const restCount = total - top.reduce((sum, d) => sum + d.count, 0);
  const slices = restCount > 0 ? [...top, { name: "Outras etapas", color: "hsl(var(--muted-foreground) / 0.35)", count: restCount }] : top;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="count"
          nameKey="name"
          innerRadius="58%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {slices.map((d) => (
            <Cell key={d.name} fill={d.color || DONUT_PALETTE_FALLBACK} />
          ))}
          <Label
            position="center"
            content={({ viewBox }) => {
              const cx = (viewBox as { cx?: number })?.cx ?? 0;
              const cy = (viewBox as { cy?: number })?.cy ?? 0;
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={cx} y={cy - 6} className="fill-foreground text-xl font-semibold">
                    {total}
                  </tspan>
                  <tspan x={cx} y={cy + 14} className="fill-muted-foreground text-[10px] uppercase tracking-wider">
                    leads
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <Tooltip content={<StageTooltip total={total} />} />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, lineHeight: "20px" }}
          formatter={(value: string) => <span className="text-foreground">{value}</span>}
        />
      </PieChart>
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
