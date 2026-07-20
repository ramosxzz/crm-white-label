import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS: { key: "feita" | "passou_valor" | "qualificado" | "fechado"; label: string }[] = [
  { key: "feita", label: "Ligações feitas" },
  { key: "passou_valor", label: "Passou valor" },
  { key: "qualificado", label: "Qualificado" },
  { key: "fechado", label: "Fechado" },
];

export function CallsFunnel({ counts }: { counts: Record<string, number> }) {
  const total = counts.feita ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de ligações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {STEPS.map((step, idx) => {
          const value = counts[step.key] ?? 0;
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          const widthPct = idx === 0 ? 100 : Math.max(6, pct);
          return (
            <div key={step.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">{step.label}</span>
                <span className="tabular-nums text-muted-foreground">{value} {idx > 0 && `(${pct}%)`}</span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-md bg-muted/50">
                <div className="h-full rounded-md bg-brand/70" style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
