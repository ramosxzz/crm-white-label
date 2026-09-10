"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MessageCircle, Send, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPhoneBR, formatCurrencyBRL } from "@/lib/utils";
import { formatBRTFullDateTime, formatRelativeTimeBRT } from "@/lib/date/brt";
import { bulkAssignLeads, moveLeadsToStage } from "./actions";
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
  quality_stars: number | null;
};

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-muted-foreground">—</span>;
  const isWhatsApp = source.toLowerCase().includes("whatsapp");
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {isWhatsApp && <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />}
      <span className="capitalize text-muted-foreground">{source}</span>
    </span>
  );
}

function QualityLabel({ stars }: { stars: number | null }) {
  if (!stars || stars <= 0) return <span className="text-xs text-muted-foreground/70">Não avaliado</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-amber-500">
      <Star className="h-3.5 w-3.5 fill-current" /> {stars}
    </span>
  );
}

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
  hasActiveFilters,
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
  hasActiveFilters: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState<string>("");
  const [moveTo, setMoveTo] = useState<string>("");
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

  function clearSelection() {
    setSelected(new Set());
    setAssignTo("");
    setMoveTo("");
  }

  function onAssign() {
    if (!assignTo || selected.size === 0) return;
    const toUserId = assignTo === "unassign" ? null : assignTo;
    start(async () => {
      try {
        await bulkAssignLeads([...selected], toUserId);
        notify({ title: `${selected.size} lead(s) atribuído(s)`, tone: "success" });
        clearSelection();
        router.refresh();
      } catch (err) {
        notifyError(err);
      }
    });
  }

  function onMoveStage() {
    if (!moveTo || selected.size === 0) return;
    start(async () => {
      try {
        await moveLeadsToStage([...selected], moveTo);
        notify({ title: `${selected.size} lead(s) movido(s) de etapa`, tone: "success" });
        clearSelection();
        router.refresh();
      } catch (err) {
        notifyError(err);
      }
    });
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-2 shadow-elev-1">
        <EmptyState
          message={hasActiveFilters ? "Nenhum lead corresponde aos filtros selecionados." : "Nenhum lead encontrado."}
          action={
            hasActiveFilters ? (
              <Link href="/leads" className="text-xs font-medium text-brand hover:underline">
                Limpar filtros
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-elev-1">
      {canAssign && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-brand/5 px-5 py-3">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <Select value={assignTo} onValueChange={setAssignTo}>
            <SelectTrigger className="w-52">
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

          <Select value={moveTo} onValueChange={setMoveTo}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Mudar etapa..." />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={onMoveStage} disabled={!moveTo || pending}>
            Mudar etapa
          </Button>

          <button type="button" onClick={clearSelection} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
        </div>
      )}

      {/* Mobile: cada lead vira um card empilhado, sem tabela horizontal. */}
      <ul className="divide-y divide-border/70 md:hidden">
        {leads.map((l) => {
          const stage = stageMap.get(l.stage_id ?? "");
          return (
            <li key={l.id} className="flex items-start gap-3 px-4 py-3">
              {canAssign && (
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-brand"
                  checked={selected.has(l.id)}
                  onChange={() => toggleOne(l.id)}
                  aria-label="Selecionar lead"
                />
              )}
              <Link href={`/leads/${l.id}`} className="min-w-0 flex-1">
                <p className="font-medium">{l.name}</p>
                {l.phone && <p className="text-xs text-muted-foreground">{formatPhoneBR(l.phone)}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {stage && (
                    <Badge variant="outline" className="font-medium" style={{ borderColor: `${stage.color}55`, color: stage.color ?? undefined }}>
                      {stage.name}
                    </Badge>
                  )}
                  {canAssign && l.assigned_to && <span className="text-xs text-muted-foreground">{memberMap.get(l.assigned_to) ?? "Usuário"}</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground" title={formatBRTFullDateTime(l.created_at)}>
                  {formatRelativeTimeBRT(l.created_at)}
                </p>
              </Link>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
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
            <th className="px-5 py-3 font-medium">Lead</th>
            <th className="px-5 py-3 font-medium">Etapa</th>
            <th className="px-5 py-3 font-medium">Origem</th>
            {canAssign && <th className="px-5 py-3 font-medium">Responsável</th>}
            <th className="px-5 py-3 font-medium">Entrada</th>
            <th className="px-5 py-3 text-right font-medium">Valor</th>
            <th className="px-5 py-3 font-medium">Qualificação</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
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
                  <Link href={`/leads/${l.id}`} className="block" title={l.email ?? undefined}>
                    <p className="font-medium transition-colors group-hover:text-brand">{l.name}</p>
                    {l.phone && <p className="font-mono text-xs text-muted-foreground">{formatPhoneBR(l.phone)}</p>}
                  </Link>
                </td>
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
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-5 py-3"><SourceBadge source={l.source} /></td>
                {canAssign && (
                  <td className="px-5 py-3 text-muted-foreground">
                    {l.assigned_to ? memberMap.get(l.assigned_to) ?? "Usuario" : <span className="text-xs italic">sem dono</span>}
                  </td>
                )}
                <td className="px-5 py-3 text-xs text-muted-foreground" title={formatBRTFullDateTime(l.created_at)}>
                  {formatRelativeTimeBRT(l.created_at)}
                </td>
                <td className="px-5 py-3 text-right font-medium">
                  {l.value_cents ? formatCurrencyBRL(l.value_cents) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-5 py-3"><QualityLabel stars={l.quality_stars} /></td>
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
      </div>

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
