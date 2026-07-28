"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPhoneBR, formatCurrencyBRL } from "@/lib/utils";
import { formatBRTDateShort, formatBRTTime } from "@/lib/date/brt";
import { bulkAssignLeads } from "./actions";
import { notify, notifyError } from "@/lib/ui/feedback";

type StageInfo = { id: string; name: string; color: string | null };
type MemberOption = { id: string; name: string };

export type LeadRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  value_cents: number | null;
  created_at: string;
  stage_id: string | null;
  assigned_to: string | null;
};

export function LeadsTable({
  leads,
  stages,
  canAssign,
  members,
  prevHref,
  nextHref,
  page,
  pageCount,
  rangeLabel,
}: {
  leads: LeadRow[];
  stages: StageInfo[];
  canAssign: boolean;
  members: MemberOption[];
  prevHref: string;
  nextHref: string;
  page: number;
  pageCount: number;
  rangeLabel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState<string>("");
  const [pending, start] = useTransition();

  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onAssign() {
    if (!assignTo || selected.size === 0) return;
    const toUserId = assignTo === "unassign" ? null : assignTo;
    start(async () => {
      try {
        await bulkAssignLeads([...selected], toUserId);
        notify({ title: `${selected.size} lead(s) atribuído(s)`, tone: "success" });
        setSelected(new Set());
        setAssignTo("");
        router.refresh();
      } catch (err) {
        notifyError(err);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-elev-1">
      {canAssign && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-brand/5 px-5 py-3">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <Select value={assignTo} onValueChange={setAssignTo}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Atribuir a..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassign">Voltar para fila (sem dono)</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={onAssign} disabled={!assignTo || pending}>
            <Send className="h-4 w-4" /> Atribuir
          </Button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="border-b border-border/70 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            {canAssign && (
              <th className="w-10 px-5 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-brand"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
            )}
            <th className="px-5 py-3 font-medium">Nome</th>
            <th className="px-5 py-3 font-medium">Telefone</th>
            <th className="px-5 py-3 font-medium">Email</th>
            <th className="px-5 py-3 font-medium">Estagio</th>
            <th className="px-5 py-3 font-medium">Origem</th>
            {canAssign && <th className="px-5 py-3 font-medium">Atribuído a</th>}
            <th className="px-5 py-3 font-medium">Entrada</th>
            <th className="px-5 py-3 text-right font-medium">Valor</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {leads.length === 0 && (
            <tr>
              <td colSpan={canAssign ? 10 : 8} className="px-5 py-16 text-center">
                <p className="font-medium">Nenhum lead encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste o filtro de entrada, crie um lead manualmente ou importe uma planilha CSV.
                </p>
              </td>
            </tr>
          )}
          {leads.map((l) => {
            const stage = stageMap.get(l.stage_id ?? "");
            return (
              <tr key={l.id} className="group transition-colors hover:bg-muted/40">
                {canAssign && (
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-brand"
                      checked={selected.has(l.id)}
                      onChange={() => toggleOne(l.id)}
                      aria-label="Selecionar lead"
                    />
                  </td>
                )}
                <td className="px-5 py-3">
                  <Link href={`/leads/${l.id}`} className="font-medium transition-colors hover:text-brand">
                    {l.name}
                  </Link>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{formatPhoneBR(l.phone)}</td>
                <td className="px-5 py-3 text-muted-foreground">{l.email ?? "-"}</td>
                <td className="px-5 py-3">
                  {stage ? (
                    <Badge
                      variant="outline"
                      className="font-medium"
                      style={{ borderColor: `${stage.color}55`, color: stage.color ?? undefined }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color ?? undefined }} />
                      {stage.name}
                    </Badge>
                  ) : "-"}
                </td>
                <td className="px-5 py-3 text-muted-foreground">{l.source ?? "-"}</td>
                {canAssign && (
                  <td className="px-5 py-3 text-muted-foreground">
                    {l.assigned_to ? memberMap.get(l.assigned_to) ?? "Usuario" : <span className="text-xs italic">sem dono</span>}
                  </td>
                )}
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {formatBRTDateShort(l.created_at)} às {formatBRTTime(l.created_at)}
                </td>
                <td className="px-5 py-3 text-right font-medium">{formatCurrencyBRL(l.value_cents)}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/leads/${l.id}`} className="opacity-0 transition-opacity group-hover:opacity-100">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-sm text-muted-foreground">
          <span>{rangeLabel}</span>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={prevHref} aria-disabled={page <= 1}>Anterior</Link>
            </Button>
            <span className="tabular-nums">{page} / {pageCount}</span>
            <Button asChild variant="outline" size="sm" disabled={page >= pageCount}>
              <Link href={nextHref} aria-disabled={page >= pageCount}>Próxima</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
