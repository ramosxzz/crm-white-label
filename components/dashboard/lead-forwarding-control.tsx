"use client";

import { useState, useTransition } from "react";
import { PlaneTakeoff, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLeadForwarding } from "@/app/(app)/leads/actions";

export function LeadForwardingControl({
  users,
  initialForwardUserId,
}: {
  users: { id: string; name: string }[];
  initialForwardUserId: string | null;
}) {
  const [forwardId, setForwardId] = useState<string | null>(initialForwardUserId);
  const [selected, setSelected] = useState<string>(initialForwardUserId ?? users[0]?.id ?? "");
  const [pending, start] = useTransition();
  const active = Boolean(forwardId);
  const activeName = users.find((u) => u.id === forwardId)?.name ?? "vendedor";

  function toggle() {
    const next = active ? null : selected || null;
    if (!active && !next) return;
    start(async () => {
      await setLeadForwarding(next);
      setForwardId(next);
    });
  }

  return (
    <Card className={active ? "border-amber-500/40 bg-amber-500/5" : "border-border/60"}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* min-w-0 nos dois lados: sem isso o texto longo (nome do vendedor)
            empurra a linha em vez de quebrar/cortar, e invade o controle. */}
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              active ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
            }`}
          >
            <PlaneTakeoff className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Modo ausente</p>
            <p className="text-xs text-muted-foreground">
              {active
                ? `Novos leads estao caindo para ${activeName}.`
                : "Novos leads seguem a distribuicao normal."}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:shrink-0">
          {!active && (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-9 w-44 max-w-full">
                <SelectValue placeholder="Escolha o vendedor" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant={active ? "outline" : "brand"}
            size="sm"
            className="shrink-0"
            onClick={toggle}
            disabled={pending || (!active && !selected)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {active ? "Desligar" : "Ativar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
