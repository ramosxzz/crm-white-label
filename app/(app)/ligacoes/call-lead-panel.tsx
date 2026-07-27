"use client";

import { notifyError } from "@/lib/ui/feedback";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, MessageSquare, Calendar as CalendarIcon, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { updateChatLeadBusiness, updateChatLeadNotes, updateChatLeadTags, scheduleChatMessage, cancelScheduledMessage } from "../chat/actions";
import { scheduleCall, createAppointment } from "../agenda/actions";
import { getLeadCallPanelData, setLeadQualityStars } from "./actions";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { StarRating } from "@/components/leads/star-rating";
import { MiniChatPanel } from "@/components/leads/mini-chat-panel";

type PipelineOption = {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string | null; position: number | null; is_lost?: boolean | null }[];
};

type ScheduledMessage = {
  id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  send_at: string;
  status: string;
};

export function CallLeadPanel({
  leadId,
  leadName,
  onClose,
  pipelineOptions,
  users,
}: {
  leadId: string;
  leadName: string;
  onClose: () => void;
  pipelineOptions: PipelineOption[];
  users: { id: string; name: string }[];
}) {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagsSaving, setTagsSaving] = useState(false);
  const [business, setBusiness] = useState({ valueReais: "0,00", pipelineId: "none", stageId: "none", assignedTo: "none" });
  const [businessSaving, setBusinessSaving] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [msgText, setMsgText] = useState("");
  const [msgAt, setMsgAt] = useState("");
  const [msgSaving, setMsgSaving] = useState(false);
  const [meetingKind, setMeetingKind] = useState<"meeting" | "call">("call");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingSaving, setMeetingSaving] = useState(false);
  const [meetingDone, setMeetingDone] = useState(false);
  const [stars, setStars] = useState(0);
  const [lostReason, setLostReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLeadCallPanelData(leadId)
      .then((data) => {
        if (cancelled) return;
        setNotes(data.lead.notes ?? "");
        setTags(data.lead.tags ?? []);
        setStars(data.lead.quality_stars ?? 0);
        setLostReason(data.lead.lost_reason ?? "");
        setBusiness({
          valueReais: ((data.lead.value_cents ?? 0) / 100).toFixed(2).replace(".", ","),
          pipelineId: data.lead.pipeline_id ?? "none",
          stageId: data.lead.stage_id ?? "none",
          assignedTo: data.lead.assigned_to ?? "none",
        });
        setScheduledMessages(data.scheduledMessages);
      })
      .catch((err) => {
        if (!cancelled) notifyError(err);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const selectedPipeline = pipelineOptions.find((p) => p.id === business.pipelineId) ?? null;
  const selectedStages = selectedPipeline?.stages ?? [];

  function saveNotes() {
    setNotesSaving(true);
    void updateChatLeadNotes({ leadId, notes })
      .catch((err) => notifyError(err))
      .finally(() => setNotesSaving(false));
  }

  function persistTags(next: string[]) {
    const prev = tags;
    setTags(next);
    setTagsSaving(true);
    void updateChatLeadTags({ leadId, tags: next })
      .then((res) => {
        if (res?.tags) setTags(res.tags);
      })
      .catch((err) => {
        setTags(prev);
        notifyError(err);
      })
      .finally(() => setTagsSaving(false));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setTagInput("");
      return;
    }
    persistTags([...tags, t]);
    setTagInput("");
  }

  function saveBusiness() {
    const parsed = Number(business.valueReais.replace(/\./g, "").replace(",", "."));
    const valueCents = Math.round(Math.max(0, Number.isFinite(parsed) ? parsed : 0) * 100);
    setBusinessSaving(true);
    void updateChatLeadBusiness({
      leadId,
      valueCents,
      pipelineId: business.pipelineId === "none" ? null : business.pipelineId,
      stageId: business.stageId === "none" ? null : business.stageId,
      assignedTo: business.assignedTo === "none" ? null : business.assignedTo,
      lostReason,
    })
      .catch((err) => notifyError(err))
      .finally(() => setBusinessSaving(false));
  }

  function saveMessage() {
    if (!msgText.trim() || !msgAt) return;
    setMsgSaving(true);
    void scheduleChatMessage({ leadId, body: msgText, sendAt: new Date(msgAt).toISOString() })
      .then((res) => {
        setScheduledMessages((prev) => [...prev, { id: res.id, body: msgText, media_url: null, media_type: null, send_at: new Date(msgAt).toISOString(), status: "pending" }]);
        setMsgText("");
        setMsgAt("");
      })
      .catch((err) => notifyError(err))
      .finally(() => setMsgSaving(false));
  }

  function cancelMessage(id: string) {
    setScheduledMessages((prev) => prev.filter((m) => m.id !== id));
    void cancelScheduledMessage({ id, leadId }).catch(() => null);
  }

  function saveMeeting() {
    if (!meetingAt) return;
    setMeetingSaving(true);
    const action =
      meetingKind === "call"
        ? scheduleCall({ leadId, startsAt: new Date(meetingAt).toISOString(), notes: meetingNotes })
        : (async () => {
            const fd = new FormData();
            fd.set("lead_id", leadId);
            fd.set("starts_at", new Date(meetingAt).toISOString());
            fd.set("duration_minutes", "60");
            fd.set("notes", meetingNotes);
            fd.set("kind", "meeting");
            await createAppointment(fd);
          })();
    void Promise.resolve(action)
      .then(() => {
        setMeetingDone(true);
        setMeetingAt("");
        setMeetingNotes("");
        setTimeout(() => setMeetingDone(false), 3000);
      })
      .catch((err) => notifyError(err))
      .finally(() => setMeetingSaving(false));
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 w-[90vw] max-w-md overflow-y-auto border-l border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{leadName}</p>
            <Link href={`/chat/${leadId}`} prefetch className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline">
              <MessageSquare className="h-3 w-3" /> Abrir chat
            </Link>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-6 p-4">
            <Section title="Conversa">
              <MiniChatPanel leadId={leadId} leadName={leadName} onClose={() => {}} embedded />
            </Section>

            <Section title="Negócio">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <Input value={business.valueReais} onChange={(e) => setBusiness((c) => ({ ...c, valueReais: e.target.value }))} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Funil</Label>
                  <Select value={business.pipelineId} onValueChange={(pipelineId) => setBusiness((c) => ({ ...c, pipelineId, stageId: "none" }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Funil" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem funil</SelectItem>
                      {pipelineOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Etapa</Label>
                  <Select value={business.stageId} onValueChange={(stageId) => setBusiness((c) => ({ ...c, stageId }))} disabled={selectedStages.length === 0}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Etapa" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem etapa</SelectItem>
                      {selectedStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <Select value={business.assignedTo} onValueChange={(assignedTo) => setBusiness((c) => ({ ...c, assignedTo }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedStages.find((s) => s.id === business.stageId)?.is_lost && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Motivo da desistência</Label>
                    <Input
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      placeholder="Ex: financeiro, valor caro..."
                      className="h-9"
                    />
                  </div>
                )}
                <Button size="sm" className="w-full" onClick={saveBusiness} disabled={businessSaving}>
                  {businessSaving ? "Salvando..." : "Salvar negócio"}
                </Button>
              </div>
            </Section>

            <Section title="Qualidade do lead">
              <StarRating
                value={stars}
                onChange={(next) => {
                  setStars(next);
                  void setLeadQualityStars({ leadId, stars: next }).catch((err) => notifyError(err));
                }}
              />
            </Section>

            <Section title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Badge key={t} variant="outline" className="gap-1">
                    {t}
                    <button type="button" onClick={() => persistTags(tags.filter((x) => x !== t))} disabled={tagsSaving}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Nova tag"
                  className="h-9"
                />
                <Button size="sm" variant="outline" onClick={addTag} disabled={tagsSaving || !tagInput.trim()}>
                  Adicionar
                </Button>
              </div>
            </Section>

            <Section title="Notas">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações sobre este lead..." />
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={saveNotes} disabled={notesSaving}>
                {notesSaving ? "Salvando..." : "Salvar notas"}
              </Button>
            </Section>

            <Section title="Agendar mensagem">
              <div className="space-y-2">
                <Textarea rows={2} value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Mensagem para enviar depois..." />
                <Input type="datetime-local" value={msgAt} onChange={(e) => setMsgAt(e.target.value)} className="h-9" />
                <Button size="sm" className="w-full" onClick={saveMessage} disabled={msgSaving || !msgText.trim() || !msgAt}>
                  {msgSaving ? "Agendando..." : "Agendar mensagem"}
                </Button>
              </div>
              {scheduledMessages.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {scheduledMessages.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5 text-xs">
                      <span className="truncate">{m.body ?? "Mídia"} · {new Date(m.send_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      <button type="button" onClick={() => cancelMessage(m.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Agendar reunião / ligação">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant={meetingKind === "call" ? "brand" : "outline"} className="flex-1" onClick={() => setMeetingKind("call")}>
                    <Phone className="h-3.5 w-3.5" /> Ligação
                  </Button>
                  <Button size="sm" variant={meetingKind === "meeting" ? "brand" : "outline"} className="flex-1" onClick={() => setMeetingKind("meeting")}>
                    <CalendarIcon className="h-3.5 w-3.5" /> Reunião
                  </Button>
                </div>
                <Input type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} className="h-9" />
                <Input value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} placeholder="Observação (opcional)" className="h-9" />
                <Button size="sm" className="w-full" onClick={saveMeeting} disabled={meetingSaving || !meetingAt}>
                  {meetingSaving ? "Agendando..." : meetingDone ? "Agendado!" : `Agendar ${meetingKind === "call" ? "ligação" : "reunião"}`}
                </Button>
              </div>
            </Section>

            <Section title="Histórico">
              <LeadTimeline leadId={leadId} />
            </Section>
          </div>
        )}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
