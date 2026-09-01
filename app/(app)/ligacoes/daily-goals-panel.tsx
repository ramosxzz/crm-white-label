"use client";

import { useState, useTransition } from "react";
import { Target, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setUserDailyGoals, type UserDailyGoals } from "./actions";

export type DailyGoalMetricKey =
  | "callsMade"
  | "callsAnswered"
  | "meetingsScheduled"
  | "meetingsAttended"
  | "closedOnCall"
  | "closedLater";

const METRICS: { key: DailyGoalMetricKey; label: string; targetKey: keyof UserDailyGoals }[] = [
  { key: "callsMade", label: "Ligação realizada", targetKey: "callsMadeTarget" },
  { key: "callsAnswered", label: "Ligação atendida", targetKey: "callsAnsweredTarget" },
  { key: "meetingsScheduled", label: "Reunião marcada", targetKey: "meetingsScheduledTarget" },
  { key: "meetingsAttended", label: "Reunião comparecida", targetKey: "meetingsAttendedTarget" },
  { key: "closedOnCall", label: "Fechamento na call", targetKey: "closedOnCallTarget" },
  { key: "closedLater", label: "Fechamento depois", targetKey: "closedLaterTarget" },
];

export type DailyGoalsRow = {
  userId: string;
  name: string;
  actuals: Record<DailyGoalMetricKey, number>;
  goals: UserDailyGoals | null;
};

export function DailyGoalsPanel({ rows, canManage }: { rows: DailyGoalsRow[]; canManage: boolean }) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-brand" />
          Metas do dia
        </CardTitle>
        <CardDescription>Realizado hoje x meta diária, por pessoa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) =>
          editingUserId === row.userId ? (
            <GoalsEditor
              key={row.userId}
              row={row}
              onDone={() => setEditingUserId(null)}
            />
          ) : (
            <div key={row.userId} className="rounded-lg border border-border/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{row.name}</span>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Editar metas"
                    onClick={() => setEditingUserId(row.userId)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {METRICS.map((m) => {
                  const actual = row.actuals[m.key] ?? 0;
                  const target = (row.goals?.[m.targetKey] as number | undefined) ?? 0;
                  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null;
                  return (
                    <div key={m.key} className="space-y-1">
                      <p className="truncate text-[11px] text-muted-foreground">{m.label}</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {actual}
                        {target > 0 && <span className="text-muted-foreground"> / {target}</span>}
                      </p>
                      {target > 0 && (
                        <div className="h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              (pct ?? 0) >= 100 ? "bg-emerald-500" : "bg-brand",
                            )}
                            style={{ width: `${pct ?? 0}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </CardContent>
    </Card>
  );
}

function GoalsEditor({ row, onDone }: { row: DailyGoalsRow; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, number>>({
    callsMadeTarget: row.goals?.callsMadeTarget ?? 0,
    callsAnsweredTarget: row.goals?.callsAnsweredTarget ?? 0,
    meetingsScheduledTarget: row.goals?.meetingsScheduledTarget ?? 0,
    meetingsAttendedTarget: row.goals?.meetingsAttendedTarget ?? 0,
    closedOnCallTarget: row.goals?.closedOnCallTarget ?? 0,
    closedLaterTarget: row.goals?.closedLaterTarget ?? 0,
  });

  function onSave() {
    start(async () => {
      try {
        await setUserDailyGoals({
          userId: row.userId,
          callsMadeTarget: values.callsMadeTarget,
          callsAnsweredTarget: values.callsAnsweredTarget,
          meetingsScheduledTarget: values.meetingsScheduledTarget,
          meetingsAttendedTarget: values.meetingsAttendedTarget,
          closedOnCallTarget: values.closedOnCallTarget,
          closedLaterTarget: values.closedLaterTarget,
        });
        onDone();
      } catch {
        // erro ja aparece via toast global de action; mantem o editor aberto pra tentar de novo
      }
    });
  }

  return (
    <div className="rounded-lg border border-brand/40 bg-brand/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{row.name}</span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDone} disabled={pending}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={onSave} disabled={pending}>
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {METRICS.map((m) => (
          <div key={m.key} className="space-y-1">
            <label className="block truncate text-[11px] text-muted-foreground">{m.label}</label>
            <Input
              type="number"
              min="0"
              className="h-8 text-sm"
              value={values[m.targetKey]}
              onChange={(e) => setValues((prev) => ({ ...prev, [m.targetKey]: Number(e.target.value) }))}
              disabled={pending}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
