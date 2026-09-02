"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Send, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { notify, notifyError, confirmDialog } from "@/lib/ui/feedback";
import { formatBRTTime, formatBRTDateShort } from "@/lib/date/brt";
import { createAudioMediaRecorder, buildRecordedAudio } from "@/lib/media/audio-recorder";
import type { TenantUserOption } from "@/lib/tenant/users";
import { sendTeamMessage, deleteTeamMessage } from "./actions";

type TeamMessageRow = {
  id: string;
  tenant_id: string;
  sender_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  mentions: string[];
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// "Hoje"/"Ontem" comparado em data-calendario de Brasilia (timeZone fixo),
// nao no fuso local da maquina - servidor (SSR, UTC) e navegador (BRT)
// calculavam dia diferente perto da virada, causando mismatch de hidratacao
// (React descartava o HTML do servidor e re-renderizava, travando a pagina
// no loading.tsx em carregamento direto/hard-reload).
function brtDateKey(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function dayLabel(iso: string) {
  const key = brtDateKey(new Date(iso));
  const todayKey = brtDateKey(new Date());
  if (key === todayKey) return "Hoje";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === brtDateKey(yesterday)) return "Ontem";
  return formatBRTDateShort(iso);
}

export function TeamChatThread({
  tenantId,
  currentUserId,
  members,
  initialMessages,
}: {
  tenantId: string;
  currentUserId: string;
  members: TenantUserOption[];
  initialMessages: TeamMessageRow[];
}) {
  const [messages, setMessages] = useState<TeamMessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const pendingMentionsRef = useRef<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const memberAvatarById = useMemo(() => new Map(members.map((m) => [m.id, m.avatarUrl])), [members]);
  const memberByNameLower = useMemo(
    () => new Map(members.map((m) => [m.name.toLowerCase(), m])),
    [members],
  );
  const mentionRegex = useMemo(() => {
    if (members.length === 0) return null;
    const names = members
      .map((m) => m.name)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`@(${names.join("|")})`, "g");
  }, [members]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`team-chat-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as TeamMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "team_messages", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as TeamMessageRow;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setDraft(value);
    const cursor = e.target.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const match = before.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function pickMention(member: TenantUserOption) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? draft.length;
    const before = draft.slice(0, cursor).replace(/@([^\s@]*)$/, `@${member.name} `);
    const after = draft.slice(cursor);
    const next = before + after;
    setDraft(next);
    pendingMentionsRef.current.add(member.id);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      const pos = before.length;
      textarea?.setSelectionRange(pos, pos);
    });
  }

  function resolveMentions(text: string) {
    const ids = new Set<string>();
    for (const id of pendingMentionsRef.current) {
      const name = memberById.get(id);
      if (name && text.includes(`@${name}`)) ids.add(id);
    }
    if (mentionRegex) {
      mentionRegex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = mentionRegex.exec(text))) {
        const member = memberByNameLower.get(m[1].toLowerCase());
        if (member) ids.add(member.id);
      }
    }
    return [...ids];
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const mentions = resolveMentions(text);
    setDraft("");
    pendingMentionsRef.current.clear();
    try {
      await sendTeamMessage({ body: text, mentions });
    } catch (err) {
      notifyError(err);
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function uploadAudio(blob: Blob, fileName: string) {
    setSending(true);
    try {
      const supabase = createClient();
      const safeName = fileName.replace(/[^\w.\-]+/g, "_");
      const path = `${tenantId}/internal/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: blob.type || undefined,
      });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
      await sendTeamMessage({ mediaUrl: pub.publicUrl, mediaType: "audio" });
    } catch (err) {
      notifyError(err);
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = createAudioMediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const { blob, fileName } = buildRecordedAudio(mr, recordChunksRef.current);
        if (blob.size > 0) void uploadAudio(blob, fileName);
      };
      mediaRecorderRef.current = mr;
      mr.start(250);
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      notify({ title: "Não foi possível acessar o microfone. Verifique as permissões do navegador.", tone: "error" });
    }
  }

  function stopRecording(cancel = false) {
    const mr = mediaRecorderRef.current;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);
    if (!mr) return;
    if (cancel) {
      recordChunksRef.current = [];
      mr.onstop = () => mr.stream.getTracks().forEach((t) => t.stop());
    }
    mr.stop();
    mediaRecorderRef.current = null;
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({ title: "Apagar mensagem?", tone: "danger", confirmLabel: "Apagar" }))) return;
    try {
      await deleteTeamMessage(id);
    } catch (err) {
      notifyError(err);
    }
  }

  const filteredMentionCandidates =
    mentionQuery !== null
      ? members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
      : [];

  function renderBody(text: string, mine: boolean) {
    if (!mentionRegex) return text;
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    mentionRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = mentionRegex.exec(text))) {
      if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
      parts.push(
        <span
          key={key++}
          className={cn(
            "rounded px-1 font-medium",
            mine ? "bg-black/15 text-brand-foreground underline decoration-2 underline-offset-2" : "bg-brand/15 text-brand",
          )}
        >
          {m[0]}
        </span>,
      );
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  }

  let lastDay = "";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Comece a conversa do time por aqui.
          </p>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            const senderName = memberById.get(m.sender_id) ?? "Usuário";
            const senderAvatar = memberAvatarById.get(m.sender_id) ?? null;
            const day = dayLabel(m.created_at);
            const showDaySeparator = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id}>
                {showDaySeparator && (
                  <div className="my-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <div className="h-px flex-1 bg-border/60" />
                    {day}
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                )}
                <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                  <Avatar className="h-7 w-7 shrink-0">
                    {senderAvatar && <AvatarImage src={senderAvatar} alt={senderName} />}
                    <AvatarFallback className="text-[10px]">{initials(senderName)}</AvatarFallback>
                  </Avatar>
                  <div className={cn("group flex max-w-[75%] flex-col gap-1", mine && "items-end")}>
                    {!mine && <span className="px-1 text-[11px] font-medium text-muted-foreground">{senderName}</span>}
                    <div
                      className={cn(
                        "relative rounded-2xl px-3 py-2 text-sm",
                        mine ? "bg-brand text-brand-foreground" : "bg-muted",
                      )}
                    >
                      {m.deleted_at ? (
                        <span className="italic text-muted-foreground">Mensagem apagada</span>
                      ) : m.media_type === "audio" && m.media_url ? (
                        <audio controls src={m.media_url} className="h-9 w-56" />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{renderBody(m.body ?? "", mine)}</p>
                      )}
                      {mine && !m.deleted_at && (
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="absolute -left-7 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          aria-label="Apagar mensagem"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <span className="px-1 text-[10px] text-muted-foreground">
                      {formatBRTTime(m.created_at)}
                      {m.edited_at && " · editada"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border/40 bg-background/40 px-6 py-4">
        <div className="relative mx-auto max-w-3xl">
          {filteredMentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {filteredMentionCandidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickMention(m)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <Avatar className="h-6 w-6">
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                    <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {recording ? (
            <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
              <span className="flex-1 text-sm text-muted-foreground">
                Gravando... {String(Math.floor(recordSecs / 60)).padStart(2, "0")}:{String(recordSecs % 60).padStart(2, "0")}
              </span>
              <Button type="button" variant="ghost" size="icon" onClick={() => stopRecording(true)} aria-label="Cancelar gravação">
                <X className="h-4 w-4" />
              </Button>
              <Button type="button" variant="brand" size="icon" onClick={() => stopRecording(false)} aria-label="Enviar áudio">
                <Square className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Escreva pra equipe... use @ pra mencionar alguém"
                className="min-h-[44px] flex-1 resize-none"
                rows={1}
              />
              <Button type="button" variant="outline" size="icon" onClick={startRecording} aria-label="Gravar áudio" disabled={sending}>
                <Mic className="h-4 w-4" />
              </Button>
              <Button type="button" variant="brand" size="icon" onClick={handleSend} disabled={sending || !draft.trim()} aria-label="Enviar">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
