"use client";

import { notify, notifyError } from "@/lib/ui/feedback";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Send,
  UsersRound,
  Loader2,
  Plus,
  Mic,
  Trash2,
  FileIcon,
  Image as ImageIcon,
  FileText,
  Camera,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickRepliesPicker } from "@/components/chat/quick-replies-picker";
import { createClient } from "@/lib/supabase/client";
import type { QuickMessage } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { sendGroupMessage, sendGroupMedia, fetchGroupMessages, markGroupRead } from "../../actions";

const POLL_MS = 8_000;

type MediaKind = "image" | "video" | "audio" | "document";

function detectMediaKind(mime: string): MediaKind {
  if (mime.startsWith("image")) return "image";
  if (mime.startsWith("video")) return "video";
  if (mime.startsWith("audio")) return "audio";
  return "document";
}

export type GroupThreadMessage = {
  id: string;
  externalId: string | null;
  direction: "inbound" | "outbound";
  body: string;
  senderName: string | null;
  senderJid: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
};

type GroupThreadLabel = { id: string; name: string; color: string };

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function uniqueMessages(messages: GroupThreadMessage[]) {
  const byKey = new Map<string, GroupThreadMessage>();
  for (const message of messages) byKey.set(message.externalId ?? message.id, message);
  return [...byKey.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function GroupChatThread({
  groupId,
  tenantId,
  subject,
  participantCount,
  labels,
  initialMessages,
  quickMessages = [],
}: {
  groupId: string;
  tenantId: string;
  subject: string;
  participantCount: number | null;
  labels: GroupThreadLabel[];
  initialMessages: GroupThreadMessage[];
  quickMessages?: QuickMessage[];
}) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(() => uniqueMessages(messages), [messages]);
  const busy = pending || uploading;

  useEffect(() => {
    setMessages(initialMessages);
  }, [groupId, initialMessages]);

  const sync = useCallback(async () => {
    try {
      const next = await fetchGroupMessages(groupId);
      setMessages((prev) => {
        const optimistic = prev.filter((m) => m.id.startsWith("opt-"));
        return uniqueMessages([...next, ...optimistic]);
      });
    } catch {
      /* mantém estado */
    }
  }, [groupId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`whatsapp-group-thread-${tenantId}-${groupId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_groups", filter: `id=eq.${groupId}` },
        (change) => {
          void sync();
          const next = change.new as { unread_count?: number | null };
          if ((next.unread_count ?? 0) > 0) void markGroupRead(groupId);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, sync, tenantId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [sortedMessages.length]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    const optimistic: GroupThreadMessage = {
      id: `opt-${Date.now()}`,
      externalId: null,
      direction: "outbound",
      body,
      senderName: "Voce",
      senderJid: null,
      mediaUrl: null,
      mediaType: null,
      createdAt: new Date().toISOString(),
    };
    setText("");
    setMessages((prev) => [...prev, optimistic]);
    start(async () => {
      try {
        const sent = await sendGroupMessage({ groupId, body });
        setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), { ...sent, mediaUrl: null, mediaType: null }]);
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        notifyError(err);
      }
    });
  }

  const uploadAndSend = useCallback(
    async (file: Blob, fileName: string, kind: MediaKind) => {
      setUploading(true);
      const optimisticId = `opt-${Date.now()}`;
      const localUrl = URL.createObjectURL(file);
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          externalId: null,
          direction: "outbound",
          body: kind === "document" ? `📎 ${fileName}` : "",
          senderName: "Voce",
          senderJid: null,
          mediaUrl: localUrl,
          mediaType: kind,
          createdAt: new Date().toISOString(),
        },
      ]);
      try {
        const supabase = createClient();
        const safeName = fileName.replace(/[^\w.\-]+/g, "_");
        const path = `${tenantId}/groups/${groupId}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
        const sent = await sendGroupMedia({
          groupId,
          mediaUrl: pub.publicUrl,
          mediaKind: kind,
          fileName,
          mimeType: file.type || undefined,
        });
        setMessages((prev) => uniqueMessages([...prev.filter((m) => m.id !== optimisticId), sent]));
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        notifyError(err);
      } finally {
        URL.revokeObjectURL(localUrl);
        setUploading(false);
      }
    },
    [tenantId, groupId],
  );

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) {
      notify({ title: "Arquivo muito grande (máximo 1 GB).", tone: "error" });
      return;
    }
    void uploadAndSend(file, file.name, detectMediaKind(file.type));
  }

  async function sendExistingMedia(url: string, kind: MediaKind) {
    setUploading(true);
    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, externalId: null, direction: "outbound", body: "", senderName: "Voce", senderJid: null, mediaUrl: url, mediaType: kind, createdAt: new Date().toISOString() },
    ]);
    try {
      const sent = await sendGroupMedia({ groupId, mediaUrl: url, mediaKind: kind });
      setMessages((prev) => uniqueMessages([...prev.filter((m) => m.id !== optimisticId), sent]));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      notifyError(err);
    } finally {
      setUploading(false);
    }
  }

  function onPickQuick(m: { body: string | null; media_url: string | null; media_type: string | null }) {
    if (m.media_url && m.media_type === "audio") {
      void sendExistingMedia(m.media_url, "audio");
    } else if (m.body) {
      setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${m.body}` : m.body!));
    }
  }

  function openPicker(accept: string) {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: "audio/ogg" });
        if (blob.size > 0) void uploadAndSend(blob, `audio-${Date.now()}.ogg`, "audio");
      };
      mediaRecorderRef.current = mr;
      mr.start();
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

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(900px_520px_at_50%_-8%,hsl(var(--brand)/0.07),transparent_68%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/50 bg-card/78 px-5 py-3.5 backdrop-blur-md">
        <Avatar className="h-11 w-11 ring-2 ring-info/20">
          <AvatarFallback className="bg-info/10 text-info">
            <UsersRound className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold tracking-normal">{subject}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{participantCount ?? 0} participantes</span>
            {labels.map((label) => (
              <Badge key={label.id} variant="outline" className="px-2 py-0 text-[10px]" style={{ borderColor: `${label.color}55`, color: label.color }}>
                {label.name}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {sortedMessages.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-2xl bg-muted/80 px-4 py-3 text-sm text-muted-foreground">
              Nenhuma mensagem de grupo recebida ainda
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">Escreva abaixo para enviar uma mensagem neste grupo.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-3">
            {sortedMessages.map((message) => {
              const outbound = message.direction === "outbound";
              return (
                <div key={message.id} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[min(86%,560px)] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-elev-1",
                      outbound
                        ? "rounded-br-md bg-chat-outbound text-chat-outbound-foreground"
                        : "rounded-bl-md border border-border/55 bg-card text-foreground",
                    )}
                  >
                    {!outbound && (
                      <p className="mb-1 text-xs font-semibold text-brand">
                        {message.senderName ?? message.senderJid ?? "Participante"}
                      </p>
                    )}
                    <GroupMessageContent message={message} outbound={outbound} />
                    <p className={cn("mt-1 text-right text-[10px]", outbound ? "text-chat-outbound-meta" : "text-muted-foreground")}>
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/50 bg-card/86 p-3 backdrop-blur-md">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          className="hidden"
          onChange={onPickFile}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPickFile}
        />
        {recording ? (
          <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-sm font-medium text-red-600 dark:text-red-400">
              Gravando… {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, "0")}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground" onClick={() => stopRecording(true)} title="Cancelar">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button type="button" variant="brand" size="icon" className="h-10 w-10 rounded-xl" onClick={() => stopRecording(false)} title="Enviar áudio">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mx-auto flex max-w-4xl items-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-11 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground" disabled={busy} title="Anexar">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-52">
                <DropdownMenuItem onSelect={() => cameraInputRef.current?.click()} className="cursor-pointer gap-2.5">
                  <Camera className="h-4 w-4 text-emerald-500" /> Tirar foto
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openPicker("image/*,video/*")} className="cursor-pointer gap-2.5">
                  <ImageIcon className="h-4 w-4 text-purple-500" /> Foto e vídeo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openPicker("application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip")} className="cursor-pointer gap-2.5">
                  <FileText className="h-4 w-4 text-blue-500" /> Documento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <QuickRepliesPicker messages={quickMessages} disabled={busy} onPick={onPickQuick} />

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mensagem para o grupo..."
              className="min-h-11 max-h-32 flex-1 resize-none rounded-xl border-border/60 bg-background/70"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            {text.trim() ? (
              <Button type="submit" variant="brand" size="icon" className="h-11 w-11 shrink-0 rounded-xl" disabled={busy}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            ) : (
              <Button type="button" variant="brand" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={startRecording} disabled={busy} title="Gravar áudio">
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function GroupMessageContent({ message, outbound }: { message: GroupThreadMessage; outbound: boolean }) {
  const type = message.mediaType?.toLowerCase() ?? "";
  const url = message.mediaUrl?.trim();

  if (url && type.startsWith("audio")) {
    return <audio controls preload="none" src={url} className="max-w-[260px]" />;
  }
  if (url && type.startsWith("image")) {
    return (
      <div className="space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-h-64 max-w-full rounded-lg object-cover" />
        {message.body && message.body !== "📷 Imagem" && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
      </div>
    );
  }
  if (url && type.startsWith("video")) {
    return (
      <div className="space-y-1">
        <video controls preload="none" src={url} className="max-h-64 max-w-full rounded-lg" />
        {message.body && !message.body.startsWith("🎬") && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
      </div>
    );
  }
  if (url && (type === "document" || type.startsWith("application"))) {
    const label = message.body?.replace(/^📎\s*/, "") || "Documento";
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors", outbound ? "border-chat-outbound-foreground/20 hover:bg-chat-outbound-foreground/10" : "border-border/60 hover:bg-muted/50")}>
        <FileIcon className="h-5 w-5 shrink-0 opacity-80" />
        <span className="truncate text-sm font-medium underline-offset-2 hover:underline">{label}</span>
      </a>
    );
  }
  return <p className="whitespace-pre-wrap break-words">{message.body}</p>;
}
