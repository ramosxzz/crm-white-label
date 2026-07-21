"use client";

import { useState } from "react";
import { User, PanelRightOpen, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CallButton } from "@/components/leads/call-button";
import { WhatsAppCallButton } from "@/components/leads/whatsapp-call-button";
import { StarRating } from "@/components/leads/star-rating";
import { CallLeadPanel } from "./call-lead-panel";
import { setLeadQualityStars, setLeadStage } from "./actions";
import { updateChatLeadTags } from "../chat/actions";

type PipelineOption = { id: string; name: string; stages: { id: string; name: string; color: string | null; position: number | null }[] };

export type CallRow = {
  id: string;
  startedAt: string;
  from: string;
  to: string;
  leadId: string | null;
  leadName: string | null;
  leadPhone: string | null;
  pipelineId: string | null;
  pipelineName: string | null;
  stageId: string | null;
  stageName: string | null;
  tags: string[];
  qualityStars: number;
  attempts: number;
  ordinal: number;
  duration: number;
  wasAnswered: boolean;
  hangupLabel: string;
  recordUrl: string | null;
};

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function CallsTable({
  calls,
  pipelineOptions,
  users,
}: {
  calls: CallRow[];
  pipelineOptions: PipelineOption[];
  users: { id: string; name: string }[];
}) {
  const [openLead, setOpenLead] = useState<{ id: string; name: string } | null>(null);
  const [localStars, setLocalStars] = useState<Record<string, number>>({});
  const [localStage, setLocalStage] = useState<Record<string, { stageId: string; stageName: string }>>({});
  const [stageSaving, setStageSaving] = useState<string | null>(null);
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});
  const [tagInputOpenId, setTagInputOpenId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  function addTag(call: CallRow) {
    if (!call.leadId) return;
    const value = tagDraft.trim();
    if (!value) return;
    const current = localTags[call.id] ?? call.tags;
    if (current.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTagDraft("");
      setTagInputOpenId(null);
      return;
    }
    const next = [...current, value];
    setLocalTags((prev) => ({ ...prev, [call.id]: next }));
    setTagDraft("");
    setTagInputOpenId(null);
    void updateChatLeadTags({ leadId: call.leadId, tags: next }).catch(() => null);
  }

  function removeTag(call: CallRow, tag: string) {
    if (!call.leadId) return;
    const current = localTags[call.id] ?? call.tags;
    const next = current.filter((t) => t !== tag);
    setLocalTags((prev) => ({ ...prev, [call.id]: next }));
    void updateChatLeadTags({ leadId: call.leadId, tags: next }).catch(() => null);
  }

  function changeStars(call: CallRow, stars: number) {
    if (!call.leadId) return;
    setLocalStars((prev) => ({ ...prev, [call.id]: stars }));
    void setLeadQualityStars({ leadId: call.leadId, stars }).catch(() => null);
  }

  function changeStage(call: CallRow, stageId: string, stageName: string) {
    if (!call.leadId) return;
    setLocalStage((prev) => ({ ...prev, [call.id]: { stageId, stageName } }));
    setStageSaving(call.id);
    void setLeadStage({ leadId: call.leadId, stageId })
      .catch((err) => alert((err as Error).message))
      .finally(() => setStageSaving((prev) => (prev === call.id ? null : prev)));
  }

  if (calls.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma ligação registrada ainda.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3">Data</th>
              <th className="px-5 py-3">Destino</th>
              <th className="px-5 py-3">Lead</th>
              <th className="px-5 py-3">Tags</th>
              <th className="px-5 py-3">Qualidade</th>
              <th className="px-5 py-3">Funil</th>
              <th className="px-5 py-3">Etapa</th>
              <th className="px-5 py-3">Tentativas</th>
              <th className="px-5 py-3">Duração</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
              <th className="px-5 py-3">Gravação</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="px-5 py-3 text-muted-foreground">
                  {new Date(c.startedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-5 py-3 font-mono">{c.to}</td>
                <td className="px-5 py-3">
                  {c.leadId ? (
                    <button
                      type="button"
                      onClick={() => setOpenLead({ id: c.leadId!, name: c.leadName ?? "Lead" })}
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                    >
                      <User className="h-3.5 w-3.5" /> {c.leadName ?? "Ver lead"}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex max-w-48 flex-wrap items-center gap-1">
                    {(localTags[c.id] ?? c.tags).map((tag) => (
                      <Badge key={tag} variant="outline" className="gap-1 text-[11px]">
                        {tag}
                        {c.leadId && (
                          <button type="button" onClick={() => removeTag(c, tag)}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {c.leadId && (
                      tagInputOpenId === c.id ? (
                        <Input
                          autoFocus
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTag(c);
                            }
                            if (e.key === "Escape") {
                              setTagInputOpenId(null);
                              setTagDraft("");
                            }
                          }}
                          onBlur={() => addTag(c)}
                          placeholder="Nova tag"
                          className="h-6 w-24 px-1.5 text-[11px]"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setTagInputOpenId(c.id);
                            setTagDraft("");
                          }}
                          className="rounded-full border border-dashed border-border/70 p-0.5 text-muted-foreground hover:border-brand hover:text-brand"
                          title="Adicionar tag"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  {c.leadId ? (
                    <StarRating value={localStars[c.id] ?? c.qualityStars} onChange={(stars) => changeStars(c, stars)} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="max-w-48 truncate text-muted-foreground">{c.pipelineName ?? "-"}</span>
                </td>
                <td className="px-5 py-3">
                  {c.leadId ? (
                    (() => {
                      const currentStage = localStage[c.id];
                      const stageId = currentStage?.stageId ?? c.stageId ?? "";
                      const pipeline = pipelineOptions.find((p) => p.id === c.pipelineId);
                      const stageOptions = pipeline?.stages ?? [];
                      const hasCurrentInOptions = stageOptions.some((s) => s.id === stageId);
                      return (
                        <Select
                          value={stageId}
                          onValueChange={(next) => {
                            const label = stageOptions.find((s) => s.id === next)?.name ?? "";
                            changeStage(c, next, label);
                          }}
                          disabled={stageOptions.length === 0 || stageSaving === c.id}
                        >
                          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Sem etapa" /></SelectTrigger>
                          <SelectContent>
                            {!hasCurrentInOptions && stageId && (
                              <SelectItem value={stageId}>{currentStage?.stageName ?? c.stageName ?? "Etapa atual"}</SelectItem>
                            )}
                            {stageOptions.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()
                  ) : c.stageName ? (
                    <Badge variant="outline">{c.stageName}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Badge variant="secondary" className="tabular-nums" title={`${c.attempts} tentativa(s) no total`}>
                    {c.ordinal}ª de {c.attempts}
                  </Badge>
                </td>
                <td className="px-5 py-3 tabular-nums">{formatDuration(c.duration)}</td>
                <td className="px-5 py-3">
                  <Badge variant={c.wasAnswered ? "success" : "destructive"}>{c.wasAnswered ? "Atendida" : c.hangupLabel}</Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-center gap-1.5">
                    <CallButton leadId={c.leadId} phone={c.to} iconOnly />
                    <WhatsAppCallButton phone={c.leadPhone ?? c.to} iconOnly />
                    {c.leadId && (
                      <Button variant="outline" size="icon" title="Detalhes" onClick={() => setOpenLead({ id: c.leadId!, name: c.leadName ?? "Lead" })}>
                        <PanelRightOpen className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  {c.recordUrl ? (
                    <a href={c.recordUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">Ouvir</a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openLead && (
        <CallLeadPanel
          leadId={openLead.id}
          leadName={openLead.name}
          onClose={() => setOpenLead(null)}
          pipelineOptions={pipelineOptions}
          users={users}
        />
      )}
    </>
  );
}
