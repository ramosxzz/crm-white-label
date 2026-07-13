"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Send,
  Loader2,
  Pause,
  Play,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Mic,
  Trash2,
  FileIcon,
  Bot,
  BotOff,
  Plus,
  CalendarClock,
  Image as ImageIcon,
  FileText,
  Pencil,
  Phone,
  Reply,
  Save,
  X,
  Zap,
} from "lucide-react";
import { updateLead } from "@/app/(app)/leads/actions";
import { ScheduleMeetingButton } from "@/components/leads/schedule-meeting-button";
import { CallButton } from "@/components/leads/call-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QuickMessage } from "@/lib/supabase/database.types";
import { QuickRepliesPicker } from "@/components/chat/quick-replies-picker";
import { createClient } from "@/lib/supabase/client";
import { fetchMessages } from "@/lib/chat/client";
import type { ChatMessage, ConversationStatus } from "@/lib/chat/types";
import { CONVERSATION_STATUSES, STATUS_META } from "@/lib/chat/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, initials } from "@/lib/utils";
import { displayLeadName, displayLeadSubtitle } from "@/lib/leads/display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeadDeleteButton } from "@/components/leads/lead-delete-button";
import {
  sendChatMessage,
  sendInstagramMessage,
  sendChatMedia,
  markConversationRead,
  setConversationStatusByLead,
  setLeadAutomations,
  scheduleChatMessage,
  listScheduledMessages,
  cancelScheduledMessage,
  updateChatLeadBusiness,
} from "../actions";

type MediaKind = "image" | "video" | "audio" | "document";
type QuickMediaDraft = {
  title: string;
  mediaUrl: string;
  mediaType: MediaKind;
};

type LeadDetails = {
  pipelineId: string | null;
  stageId: string | null;
  assignedTo: string | null;
  email: string | null;
  source: string | null;
  notes: string | null;
  tags: string[];
  valueCents: number;
  createdAt: string;
  stageName: string | null;
  stageColor: string | null;
  pipelineName: string | null;
  assignedName: string | null;
  nextAppointmentAt: string | null;
  openTasksCount: number;
};

type PipelineOption = {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string | null; position: number | null }[];
};

type ScheduledMessage = {
  id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  send_at: string;
};

function detectMediaKind(mime: string): MediaKind {
  if (mime.startsWith("image")) return "image";
  if (mime.startsWith("video")) return "video";
  if (mime.startsWith("audio")) return "audio";
  return "document";
}

const POLL_MS = 10_000;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of prev) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return removeResolvedOptimisticMessages([...map.values()]).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function isOptimisticMessage(message: ChatMessage) {
  return message.id.startsWith("opt-") || message.id.startsWith("optimistic-");
}

function sameOutgoingDraft(optimistic: ChatMessage, real: ChatMessage) {
  if (!isOptimisticMessage(optimistic) || isOptimisticMessage(real)) return false;
  if (optimistic.direction !== "outbound" || real.direction !== "outbound") return false;

  const optimisticBody = (optimistic.body ?? "").trim();
  const realBody = (real.body ?? "").trim();
  if (optimisticBody !== realBody) return false;

  const optimisticMediaType = optimistic.media_type ?? null;
  const realMediaType = real.media_type ?? null;
  if (optimisticMediaType !== realMediaType) return false;

  const optimisticReply = optimistic.reply_to_message_id ?? optimistic.reply_to_external_id ?? null;
  const realReply = real.reply_to_message_id ?? real.reply_to_external_id ?? null;
  if (optimisticReply !== realReply) return false;

  const optimisticTime = new Date(optimistic.created_at).getTime();
  const realTime = new Date(real.created_at).getTime();
  return Math.abs(realTime - optimisticTime) < 120_000;
}

function removeResolvedOptimisticMessages(messages: ChatMessage[]) {
  const realMessages = messages.filter((m) => !isOptimisticMessage(m));
  const usedRealIds = new Set<string>();

  return messages.filter((message) => {
    if (!isOptimisticMessage(message)) return true;

    const real = realMessages.find((candidate) => {
      if (usedRealIds.has(candidate.id)) return false;
      return sameOutgoingDraft(message, candidate);
    });

    if (!real) return true;
    usedRealIds.add(real.id);
    return false;
  });
}

function replyPreview(message: ChatMessage): string {
  const body = message.body?.trim();
  if (body) return body.slice(0, 180);
  const type = message.media_type?.toLowerCase() ?? "";
  if (type.startsWith("audio")) return "🎤 Áudio";
  if (type.startsWith("image")) return "📷 Imagem";
  if (type.startsWith("video")) return "🎬 Vídeo";
  if (type === "document" || type.startsWith("application")) return "📎 Documento";
  return "Mensagem";
}

export function ChatThread({
  leadId,
  tenantId,
  leadName,
  leadPhone,
  leadAvatarUrl,
  channel = "whatsapp",
  conversationId: initialConversationId,
  initialStatus = "nao_iniciada",
  initialAutomationsEnabled = true,
  initialMessages,
  initialScheduledMessages = [],
  quickMessages = [],
  professionals = [],
  users = [],
  services = [],
  whatsappAccounts = [],
  pipelineOptions = [],
  leadDetails,
}: {
  leadId: string;
  tenantId: string;
  leadName: string;
  leadPhone: string;
  leadAvatarUrl?: string | null;
  channel?: "whatsapp" | "instagram";
  conversationId: string | null;
  initialStatus?: ConversationStatus;
  initialAutomationsEnabled?: boolean;
  initialMessages: ChatMessage[];
  initialScheduledMessages?: ScheduledMessage[];
  quickMessages?: QuickMessage[];
  professionals?: { id: string; name: string }[];
  users?: { id: string; name: string }[];
  services?: { id: string; name: string; duration_minutes: number }[];
  whatsappAccounts?: { id: string; phone_number: string; display_name: string | null; provider: string }[];
  pipelineOptions?: PipelineOption[];
  leadDetails?: LeadDetails;
}) {
  const isInstagram = channel === "instagram";
  const displayPhone = isInstagram ? "Instagram Direct" : displayLeadSubtitle(leadPhone);
  const [displayName, setDisplayName] = useState(displayLeadName(leadName, leadPhone));
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    setDisplayName(displayLeadName(leadName, leadPhone));
  }, [leadName, leadPhone]);

  function openRename() {
    setRenameValue(displayName);
    setRenameOpen(true);
  }

  function submitRename() {
    const next = renameValue.trim();
    if (!next || next === displayName) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    void updateLead(leadId, { name: next })
      .then(() => {
        setDisplayName(next);
        setRenameOpen(false);
      })
      .catch((err) => alert((err as Error).message))
      .finally(() => setRenaming(false));
  }

  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(
    whatsappAccounts[0]?.id,
  );

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [status, setStatus] = useState<ConversationStatus>(initialStatus);
  const [automationsOn, setAutomationsOn] = useState(initialAutomationsEnabled);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const draftStorageKey = `chat-draft:${leadId}`;
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(draftStorageKey) ?? "";
  });
  const [quickMediaDraft, setQuickMediaDraft] = useState<QuickMediaDraft | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMediaUrl, setScheduleMediaUrl] = useState<string | null>(null);
  const [scheduleMediaName, setScheduleMediaName] = useState<string | null>(null);
  const [scheduleUploading, setScheduleUploading] = useState(false);
  const [pendingScheduled, setPendingScheduled] = useState<ScheduledMessage[]>(initialScheduledMessages);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scheduleAudioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTargetRef = useRef<"send" | "schedule">("send");
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousLeadIdRef = useRef(leadId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (text) {
      window.sessionStorage.setItem(draftStorageKey, text);
    } else {
      window.sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, text]);

  const grouped = useMemo(() => {
    const out: { day: string; items: ChatMessage[] }[] = [];
    for (const m of messages) {
      const day = dayLabel(m.created_at);
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages]);

  const quickCommandMatches = useMemo(() => {
    if (!text.startsWith("/")) return [];
    const query = text.slice(1).trim().toLowerCase();
    return quickMessages
      .filter((message) => {
        const haystack = `${message.title} ${message.body ?? ""}`.toLowerCase();
        return !query || haystack.includes(query);
      })
      .slice(0, 8);
  }, [quickMessages, text]);

  const syncMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const next = await fetchMessages(conversationId);
      setMessages((prev) => mergeMessages(prev, next));
    } catch {
      /* mantém estado atual */
    }
  }, [conversationId]);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const leadChanged = previousLeadIdRef.current !== leadId;
    previousLeadIdRef.current = leadId;

    setConversationId(initialConversationId);
    setStatus(initialStatus);
    setAutomationsOn(initialAutomationsEnabled);
    setMessages(initialMessages);
    setPendingScheduled(initialScheduledMessages);
    if (leadChanged) {
      setQuickMediaDraft(null);
      setText(typeof window === "undefined" ? "" : window.sessionStorage.getItem(draftStorageKey) ?? "");
      setReplyTo(null);
    }
    shouldStickToBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [
    leadId,
    draftStorageKey,
    initialConversationId,
    initialStatus,
    initialAutomationsEnabled,
    initialMessages,
    initialScheduledMessages,
    scrollToBottom,
  ]);

  const toggleAutomations = useCallback(() => {
    setAutomationsOn((prev) => {
      const next = !prev;
      void setLeadAutomations({ leadId, enabled: next }).catch(() => {
        /* mantém otimista */
      });
      return next;
    });
  }, [leadId]);

  const changeStatus = useCallback(
    (next: ConversationStatus) => {
      setStatus(next);
      void setConversationStatusByLead({ leadId, status: next }).catch(() => {
        /* mantém otimista */
      });
    },
    [leadId],
  );

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    requestAnimationFrame(() => scrollToBottom("smooth"));
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    void markConversationRead(conversationId).then(() => {
      setStatus((prev) => (prev === "aguardando" ? "em_atendimento" : prev));
    });
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    void syncMessages();
    const timer = setInterval(() => void syncMessages(), POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, syncMessages]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncMessages();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          shouldStickToBottomRef.current = row.direction === "outbound" || isNearBottom();
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : mergeMessages(prev, [row])));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => mergeMessages(prev, [row]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if ((!body && !quickMediaDraft) || pending) return;

    if (quickMediaDraft) {
      const draft = quickMediaDraft;
      setText("");
      setQuickMediaDraft(null);
      void sendExistingMedia(draft.mediaUrl, draft.mediaType, body || undefined);
      return;
    }

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      body,
      direction: "outbound",
      created_at: new Date().toISOString(),
      status: "pending",
      reply_to_message_id: replyTo?.id ?? null,
      reply_to_external_id: replyTo?.external_id ?? null,
      reply_to_body: replyTo ? replyPreview(replyTo) : null,
      reply_to_sender_name: replyTo
        ? replyTo.sender_name ?? (replyTo.direction === "outbound" ? "Você" : displayName)
        : null,
    };
    shouldStickToBottomRef.current = true;
    setText("");
    const replyMessageId = replyTo?.id ?? null;
    setReplyTo(null);
    setMessages((prev) => [...prev, optimistic]);
    setStatus("em_atendimento");

    start(async () => {
      try {
        const result = isInstagram
          ? await sendInstagramMessage({ leadId, body })
          : await sendChatMessage({ leadId, body, accountId: selectedAccountId, replyToMessageId: replyMessageId });
        if (!conversationId) setConversationId(result.conversationId);
        setMessages((prev) => {
          const withoutOpt = prev.filter((m) => m.id !== optimistic.id);
          return mergeMessages(withoutOpt, [result.message]);
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        alert((err as Error).message);
      }
    });
  }

  const uploadChatMedia = useCallback(
    async (file: Blob, fileName: string) => {
      const supabase = createClient();
      const safeName = fileName.replace(/[^\w.\-]+/g, "_");
      const path = `${tenantId}/${leadId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
      return pub.publicUrl;
    },
    [tenantId, leadId],
  );

  const uploadAndSend = useCallback(
    async (file: Blob, fileName: string, kind: MediaKind) => {
      setUploading(true);
      shouldStickToBottomRef.current = true;
      const optimisticId = `opt-${Date.now()}`;
      const localUrl = URL.createObjectURL(file);
      const optimistic: ChatMessage = {
        id: optimisticId,
        body: kind === "document" ? `📎 ${fileName}` : "",
        direction: "outbound",
        created_at: new Date().toISOString(),
        status: "pending",
        media_url: localUrl,
        media_type: kind,
      };
      setMessages((prev) => [...prev, optimistic]);
      setStatus("em_atendimento");

      try {
        const url = await uploadChatMedia(file, fileName);
        const result = await sendChatMedia({
          leadId,
          mediaUrl: url,
          mediaKind: kind,
          fileName,
          mimeType: file.type || undefined,
          accountId: selectedAccountId,
        });
        if (!conversationId) setConversationId(result.conversationId);
        setMessages((prev) => {
          const withoutOpt = prev.filter((m) => m.id !== optimisticId);
          return mergeMessages(withoutOpt, [result.message]);
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        alert((err as Error).message);
      } finally {
        URL.revokeObjectURL(localUrl);
        setUploading(false);
      }
    },
    [leadId, conversationId, uploadChatMedia, selectedAccountId],
  );

  async function uploadForSchedule(file: Blob, fileName: string) {
    setScheduleUploading(true);
    try {
      const url = await uploadChatMedia(file, fileName);
      setScheduleMediaUrl(url);
      setScheduleMediaName(fileName);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setScheduleUploading(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("Arquivo muito grande (máximo 25 MB).");
      return;
    }
    void uploadAndSend(file, file.name, detectMediaKind(file.type));
  }

  async function sendExistingMedia(url: string, kind: MediaKind, caption?: string) {
    setUploading(true);
    shouldStickToBottomRef.current = true;
    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, body: caption ?? "", direction: "outbound", created_at: new Date().toISOString(), status: "pending", media_url: url, media_type: kind },
    ]);
    setStatus("em_atendimento");
    try {
      const result = await sendChatMedia({ leadId, mediaUrl: url, mediaKind: kind, caption, accountId: selectedAccountId });
      if (!conversationId) setConversationId(result.conversationId);
      setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== optimisticId), [result.message]));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function onPickQuick(m: { title?: string | null; body: string | null; media_url: string | null; media_type: string | null }) {
    if (m.media_url && m.media_type === "audio") {
      if (isInstagram) {
        alert("Envio de áudio rápido ainda está disponível apenas para WhatsApp.");
        return;
      }
      setQuickMediaDraft({ title: m.title ?? "Áudio rápido", mediaUrl: m.media_url, mediaType: "audio" });
      setText((prev) => (prev.startsWith("/") ? "" : prev));
    } else if (m.body) {
      setQuickMediaDraft(null);
      setText((prev) => (prev.startsWith("/") || !prev.trim() ? m.body! : `${prev.trim()}\n\n${m.body}`));
    }
  }

  async function startRecording(target: "send" | "schedule" = "send") {
    try {
      recordTargetRef.current = target;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: "audio/ogg" });
        if (blob.size === 0) return;
        const fileName = `audio-${Date.now()}.ogg`;
        if (recordTargetRef.current === "schedule") void uploadForSchedule(blob, fileName);
        else void uploadAndSend(blob, fileName, "audio");
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
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

  function openPicker(accept: string) {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  }

  function refreshPendingScheduled() {
    void listScheduledMessages(leadId).then(setPendingScheduled).catch(() => {});
  }

  function openSchedule() {
    // pré-preenche com o texto digitado e horário +1h
    setScheduleText(text);
    setScheduleMediaUrl(null);
    setScheduleMediaName(null);
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setScheduleAt(d.toISOString().slice(0, 16));
    setScheduleOpen(true);
    refreshPendingScheduled();
  }

  function pickScheduleAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("Arquivo muito grande (máximo 25 MB).");
      return;
    }
    void uploadForSchedule(file, file.name);
  }

  function submitSchedule() {
    const body = scheduleText.trim();
    if (!body && !scheduleMediaUrl) return;
    if (!scheduleAt) return;
    setScheduling(true);
    void scheduleChatMessage({
      leadId,
      body,
      sendAt: new Date(scheduleAt).toISOString(),
      mediaUrl: scheduleMediaUrl ?? undefined,
      mediaType: scheduleMediaUrl ? "audio" : undefined,
    })
      .then(() => {
        setScheduleText("");
        setScheduleMediaUrl(null);
        setScheduleMediaName(null);
        if (scheduleText.trim() === text.trim()) setText("");
        refreshPendingScheduled();
      })
      .catch((err) => alert((err as Error).message))
      .finally(() => setScheduling(false));
  }

  function cancelSchedule(id: string) {
    void cancelScheduledMessage({ id, leadId })
      .then(() => refreshPendingScheduled())
      .catch((err) => alert((err as Error).message));
  }

  const nextScheduled = pendingScheduled[0];
  const busy = pending || uploading;

  return (
    <section className="flex min-h-0 flex-1 bg-[radial-gradient(900px_520px_at_50%_-8%,hsl(var(--brand)/0.07),transparent_68%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-card/78 px-5 py-3.5 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 ring-2 ring-brand/25">
            {leadAvatarUrl && <AvatarImage src={leadAvatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-brand-muted text-sm font-semibold text-brand dark:bg-brand dark:text-brand-foreground">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <button
              type="button"
              onClick={openRename}
              className="group flex max-w-full items-center gap-1.5 text-left"
              title="Renomear contato"
            >
              <span className="truncate font-display text-base font-semibold tracking-normal">{displayName}</span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </div>
        </div>
        <div className="relative z-30 flex min-w-0 shrink-0 items-center gap-2 overflow-visible">
          <button
            type="button"
            onClick={toggleAutomations}
            title={automationsOn ? "Automações ligadas — clique para pausar" : "Automações pausadas — clique para ligar"}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-xs font-medium transition-colors",
              automationsOn
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "border-border/60 text-muted-foreground hover:bg-muted/40",
            )}
          >
            {automationsOn ? <Bot className="h-4 w-4" /> : <BotOff className="h-4 w-4" />}
          </button>
          {!isInstagram && whatsappAccounts.length > 0 && (
            <AccountSelector
              accounts={whatsappAccounts}
              selectedId={selectedAccountId}
              onChange={setSelectedAccountId}
            />
          )}
          <ScheduleMeetingButton
            leadId={leadId}
            leadName={displayName}
            professionals={professionals}
            users={users}
            services={services}
            variant="outline"
            size="icon"
          />
          {!isInstagram && leadPhone && <CallButton leadId={leadId} phone={leadPhone} iconOnly />}
          <StatusSelector status={status} onChange={changeStatus} />
          {status !== "resolvida" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              onClick={() => changeStatus("resolvida")}
              title="Finalizar conversa como resolvida"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <LeadDeleteButton leadId={leadId} leadName={displayName} redirectTo="/chat" size="icon" iconOnly />
        </div>
      </header>

      {nextScheduled && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-300">
                <CalendarClock className="h-4 w-4" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold">
                  {pendingScheduled.length === 1
                    ? "1 mensagem agendada"
                    : `${pendingScheduled.length} mensagens agendadas`}
                  <span className="font-normal text-amber-900/75 dark:text-amber-100/75">
                    {" "}
                    para {new Date(nextScheduled.send_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                <p className="truncate text-xs text-amber-900/70 dark:text-amber-100/65">
                  {nextScheduled.media_url ? "Áudio agendado" : nextScheduled.body}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 border-amber-500/30 bg-background/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-100"
              onClick={() => {
                refreshPendingScheduled();
                setScheduleOpen(true);
              }}
            >
              Ver agendadas
            </Button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={() => {
          shouldStickToBottomRef.current = isNearBottom();
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8"
      >
        {messages.length === 0 && (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-2xl bg-muted/80 px-4 py-3 text-sm text-muted-foreground">
              Nenhuma mensagem ainda
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Escreva abaixo para iniciar a conversa com este lead pelo WhatsApp.
            </p>
          </div>
        )}

        <div className="mx-auto max-w-4xl">
        {grouped.map((group) => (
          <div key={group.day} className="mb-7">
            <div className="mb-4 flex justify-center">
              <span className="rounded-md border border-border/50 bg-card/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-elev-1">
                {group.day}
              </span>
            </div>
            <div className="space-y-1.5">
              {group.items.map((m, idx) => {
                const prev = group.items[idx - 1];
                const sameAuthor = prev?.direction === m.direction && prev?.sender_name === m.sender_name;
                const outbound = m.direction === "outbound";
                const showSender = outbound && m.sender_name && !sameAuthor;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "group flex items-end gap-1.5",
                      outbound ? "justify-end" : "justify-start",
                      sameAuthor ? "mt-0.5" : "mt-3",
                    )}
                  >
                    {outbound && (
                      <button
                        type="button"
                        onClick={() => setReplyTo(m)}
                        className="mb-1 grid h-7 w-7 place-items-center rounded-full border border-border/50 bg-card/85 text-muted-foreground opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100"
                        title="Responder"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div
                      className={cn(
                        "max-w-[min(86%,520px)] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-elev-1",
                        outbound
                          ? "rounded-br-md bg-chat-outbound text-chat-outbound-foreground shadow-md ring-1 ring-black/5 dark:ring-white/10"
                          : "rounded-bl-md border border-border/55 bg-card text-foreground shadow-elev-1",
                      )}
                    >
                      {showSender && (
                        <p className="mb-1 text-[11px] font-semibold text-chat-outbound-meta/80">{m.sender_name}</p>
                      )}
                      <MessageContent message={m} />
                      <div
                        className={cn(
                          "mt-1.5 flex items-center justify-end gap-1 text-[10px]",
                          outbound ? "text-chat-outbound-meta" : "text-muted-foreground",
                        )}
                      >
                        <span>
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {outbound && <MessageStatusLabel status={m.status} />}
                      </div>
                    </div>
                    {!outbound && (
                      <button
                        type="button"
                        onClick={() => setReplyTo(m)}
                        className="mb-1 grid h-7 w-7 place-items-center rounded-full border border-border/50 bg-card/85 text-muted-foreground opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100"
                        title="Responder"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        </div>
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border/50 bg-card/92 px-4 py-3 backdrop-blur-md sm:px-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          className="hidden"
          onChange={onPickFile}
        />
        <input
          ref={scheduleAudioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={pickScheduleAudio}
        />

        {replyTo && !recording && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl border border-brand/25 bg-brand/10 px-3 py-2 text-sm">
            <Reply className="h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-brand">
                Respondendo {replyTo.sender_name ?? (replyTo.direction === "outbound" ? "você" : displayName)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{replyPreview(replyTo)}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg"
              onClick={() => setReplyTo(null)}
              title="Cancelar resposta"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {recording ? (
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <span className="flex h-3 w-3 items-center justify-center">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-sm font-medium text-red-600 dark:text-red-400">
              Gravando… {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, "0")}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl text-muted-foreground"
                onClick={() => stopRecording(true)}
                title="Cancelar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="brand"
                size="icon"
                className="h-10 w-10 rounded-xl"
                onClick={() => stopRecording(false)}
                title="Enviar áudio"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="relative mx-auto flex max-w-3xl items-end gap-2">
            {!isInstagram && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-12 w-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                    disabled={busy}
                    title="Anexar"
                  >
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-52">
                  <DropdownMenuItem onSelect={() => openPicker("image/*,video/*")} className="cursor-pointer gap-2.5">
                    <ImageIcon className="h-4 w-4 text-purple-500" /> Foto e vídeo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => openPicker("application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip")}
                    className="cursor-pointer gap-2.5"
                  >
                    <FileText className="h-4 w-4 text-blue-500" /> Documento
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={openSchedule} className="cursor-pointer gap-2.5">
                    <CalendarClock className="h-4 w-4 text-amber-500" /> Agendar mensagem
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <QuickRepliesPicker messages={quickMessages} disabled={busy} onPick={onPickQuick} />

            {/* Agendar mensagem (atalho direto) */}
            {!isInstagram && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-12 w-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={openSchedule}
                disabled={busy}
                title="Agendar mensagem"
              >
                <CalendarClock className="h-5 w-5" />
              </Button>
            )}

            {quickMediaDraft && (
              <div className="absolute bottom-full left-16 right-14 mb-2 rounded-2xl border border-border bg-popover p-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Mic className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{quickMediaDraft.title}</p>
                    <p className="text-xs text-muted-foreground">Prévia pronta. Clique em enviar para disparar.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQuickMediaDraft(null)}
                    title="Remover prévia"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!quickMediaDraft && quickCommandMatches.length > 0 && (
              <div className="absolute bottom-full left-16 right-14 mb-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-lg">
                {quickCommandMatches.map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted"
                    onClick={() => onPickQuick(message)}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      {message.media_type === "audio" ? <Mic className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{message.title}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {message.media_type === "audio" ? "Áudio rápido" : message.body}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Textarea
              rows={1}
              placeholder={isInstagram ? "Responder no Instagram..." : "Digite sua mensagem ou / para mensagens rápidas..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              className="min-h-[48px] max-h-32 flex-1 resize-none rounded-2xl border-border/60 bg-background/70 py-3"
            />
            {text.trim() || quickMediaDraft || isInstagram ? (
              <Button
                type="submit"
                variant="brand"
                size="icon"
                className="h-12 w-12 shrink-0 rounded-xl"
                disabled={busy || (!text.trim() && !quickMediaDraft)}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            ) : (
              <Button
                type="button"
                variant="brand"
                size="icon"
                className="h-12 w-12 shrink-0 rounded-xl"
                onClick={() => startRecording("send")}
                disabled={busy}
                title="Gravar áudio"
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </form>
        )}
      </div>

      {/* Dialog de renomear contato */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-brand" />
              Renomear contato
            </DialogTitle>
            <DialogDescription>Altere o nome exibido deste cliente no CRM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-input">Nome</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Nome do cliente"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={renaming}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={submitRename} disabled={renaming || !renameValue.trim()}>
              {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de agendamento de mensagem */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              Agendar mensagem
            </DialogTitle>
            <DialogDescription>
              A mensagem será enviada automaticamente pelo WhatsApp no horário escolhido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-at">Data e hora</Label>
              <Input
                id="schedule-at"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-text">Mensagem</Label>
              <Textarea
                id="schedule-text"
                rows={4}
                placeholder="Escreva a mensagem a ser enviada (opcional se anexar áudio)..."
                value={scheduleText}
                onChange={(e) => setScheduleText(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Áudio (opcional)</Label>
              {scheduleMediaUrl ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 p-2">
                  <div className="flex-1">
                    {scheduleMediaName && (
                      <p className="mb-1 truncate text-xs text-muted-foreground">{scheduleMediaName}</p>
                    )}
                    <audio controls src={scheduleMediaUrl} className="h-9 w-full" />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setScheduleMediaUrl(null);
                      setScheduleMediaName(null);
                    }}
                    title="Remover áudio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startRecording("schedule")}
                    disabled={scheduleUploading || recording}
                  >
                    <Mic className="h-4 w-4" /> Gravar áudio
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scheduleAudioInputRef.current?.click()}
                    disabled={scheduleUploading || recording}
                  >
                    {scheduleUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Escolher arquivo
                  </Button>
                </div>
              )}
            </div>
            {pendingScheduled.length > 0 && (
              <div className="space-y-1.5 border-t border-border/50 pt-3">
                <Label>Agendadas para este lead</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {pendingScheduled.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{s.media_url ? "🎤 Áudio agendado" : s.body}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.send_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => cancelSchedule(s.id)}
                        title="Cancelar agendamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)} disabled={scheduling}>
              Fechar
            </Button>
            <Button
              variant="brand"
              onClick={submitSchedule}
              disabled={scheduling || scheduleUploading || (!scheduleText.trim() && !scheduleMediaUrl) || !scheduleAt}
            >
              {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

      <LeadSidePanel
        leadId={leadId}
        leadName={displayName}
        leadPhone={leadPhone}
        channel={channel}
        status={status}
        details={leadDetails}
        users={users}
        pipelineOptions={pipelineOptions}
        onFinalize={() => changeStatus("resolvida")}
      />
    </section>
  );
}

function StatusSelector({
  status,
  onChange,
}: {
  status: ConversationStatus;
  onChange: (next: ConversationStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
          meta.pill,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-border/60 bg-popover p-1 shadow-elev-2">
          {CONVERSATION_STATUSES.map((s) => {
            const ItemIcon = s.icon;
            const activeItem = s.value === status;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  onChange(s.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                  activeItem && "bg-muted/40",
                )}
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} />
                <ItemIcon className={cn("h-4 w-4 shrink-0", s.text)} />
                <span className="flex-1">{s.label}</span>
                {activeItem && <Check className="h-4 w-4 text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageContent({ message: m }: { message: ChatMessage }) {
  const type = m.media_type?.toLowerCase() ?? "";
  const url = m.media_url?.trim();
  const isLocalPreview = m.id.startsWith("opt-") || m.id.startsWith("optimistic-");
  const src = url && isLocalPreview ? url : `/api/chat/media/${encodeURIComponent(m.id)}`;
  const quoted = m.reply_to_body ? (
    <div
      className={cn(
        "mb-2 rounded-lg border-l-2 px-2.5 py-1.5 text-xs",
        m.direction === "outbound"
          ? "border-chat-outbound-foreground/40 bg-chat-outbound-foreground/10 text-chat-outbound-meta"
          : "border-brand/60 bg-muted/55 text-muted-foreground",
      )}
    >
      <p className="font-semibold">
        {m.reply_to_sender_name || "Mensagem"}
      </p>
      <p className="line-clamp-2 whitespace-pre-wrap break-words">{m.reply_to_body}</p>
    </div>
  ) : null;

  if (url && type.startsWith("audio")) {
    return (
      <>
        {quoted}
        <AudioMessage src={src} label={m.body} outbound={m.direction === "outbound"} />
      </>
    );
  }

  if (url && type.startsWith("image")) {
    return (
      <div className="space-y-1">
        {quoted}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="max-h-64 max-w-full rounded-lg object-cover" />
        {m.body && m.body !== "📷 Imagem" && (
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        )}
      </div>
    );
  }

  if (url && type.startsWith("video")) {
    return (
      <div className="space-y-1">
        {quoted}
        <video controls preload="metadata" src={src} className="max-h-64 max-w-full rounded-lg" />
        {m.body && !m.body.startsWith("🎬") && (
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        )}
      </div>
    );
  }

  if (url && (type === "document" || type.startsWith("application"))) {
    const label = m.body?.replace(/^📎\s*/, "") || "Documento";
    return (
      <div className="space-y-1">
        {quoted}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
            m.direction === "outbound"
              ? "border-chat-outbound-foreground/20 hover:bg-chat-outbound-foreground/10"
              : "border-border/60 hover:bg-muted/50",
          )}
        >
          <FileIcon className="h-5 w-5 shrink-0 opacity-80" />
          <span className="truncate text-sm font-medium underline-offset-2 hover:underline">{label}</span>
        </a>
      </div>
    );
  }

  return (
    <>
      {quoted}
      <p className="whitespace-pre-wrap break-words">{m.body}</p>
    </>
  );
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const waveformBars = [12, 18, 10, 24, 16, 28, 14, 22, 30, 18, 12, 26, 20, 32, 16, 24, 12, 20, 28, 14, 22, 16];

function AudioMessage({
  src,
  outbound,
}: {
  src: string;
  label?: string | null;
  outbound: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  }

  function toggleRate() {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  const progress = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
  const timeLabel = formatAudioTime(duration || current);

  return (
    <div className="w-[244px] max-w-[70vw]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = rate;
          setDuration(e.currentTarget.duration || 0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 shadow-sm",
          outbound
            ? "bg-sky-400 text-slate-950"
            : "border border-border/60 bg-muted/80 text-foreground",
        )}
      >
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-transform active:scale-95",
            outbound ? "bg-blue-500/35 text-slate-950" : "bg-brand text-brand-foreground",
          )}
          aria-label={playing ? "Pausar audio" : "Reproduzir audio"}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
        </button>
        <div className="relative min-w-0 flex-1">
          <div className="flex h-8 items-center gap-[2px]" aria-hidden>
            {waveformBars.map((height, index) => {
              const barProgress = ((index + 1) / waveformBars.length) * 100;
              const active = barProgress <= progress;
              return (
                <span
                  key={`${height}-${index}`}
                  className={cn(
                    "w-[3px] rounded-full transition-colors",
                    outbound
                      ? active ? "bg-slate-950" : "bg-slate-950/45"
                      : active ? "bg-brand" : "bg-muted-foreground/45",
                  )}
                  style={{ height }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(current, duration || current)}
            onChange={(e) => seek(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Posição do áudio"
          />
        </div>
        <span className={cn("shrink-0 tabular-nums", outbound ? "text-[11px] font-medium text-slate-950" : "text-[11px] text-muted-foreground")}>
          {timeLabel}
        </span>
        <button
          type="button"
          onClick={toggleRate}
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none transition-colors",
            outbound ? "bg-blue-500/30 text-slate-950" : "bg-muted text-foreground",
          )}
          aria-label="Alterar velocidade do áudio"
        >
          {rate}x
        </button>
      </div>
    </div>
  );
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const ddd = d.slice(2, 4);
    const num = d.slice(4);
    return `(${ddd}) ${num.slice(0, num.length - 4)}-${num.slice(-4)}`;
  }
  return phone;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return "Sem data";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function LeadSidePanel({
  leadId,
  leadName,
  leadPhone,
  channel,
  status,
  details,
  users,
  pipelineOptions,
  onFinalize,
}: {
  leadId: string;
  leadName: string;
  leadPhone: string;
  channel: "whatsapp" | "instagram";
  status: ConversationStatus;
  details?: LeadDetails;
  users: { id: string; name: string }[];
  pipelineOptions: PipelineOption[];
  onFinalize: () => void;
}) {
  const [notes, setNotes] = useState(details?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessDraft, setBusinessDraft] = useState(() => ({
    valueReais: ((details?.valueCents ?? 0) / 100).toFixed(2).replace(".", ","),
    pipelineId: details?.pipelineId ?? pipelineOptions[0]?.id ?? "none",
    stageId: details?.stageId ?? "none",
    assignedTo: details?.assignedTo ?? "none",
  }));

  const selectedPipeline =
    pipelineOptions.find((pipeline) => pipeline.id === businessDraft.pipelineId) ?? pipelineOptions[0] ?? null;
  const selectedStages = selectedPipeline?.stages ?? [];

  useEffect(() => {
    setNotes(details?.notes ?? "");
  }, [details?.notes]);

  useEffect(() => {
    setBusinessDraft({
      valueReais: ((details?.valueCents ?? 0) / 100).toFixed(2).replace(".", ","),
      pipelineId: details?.pipelineId ?? pipelineOptions[0]?.id ?? "none",
      stageId: details?.stageId ?? "none",
      assignedTo: details?.assignedTo ?? "none",
    });
  }, [details?.valueCents, details?.pipelineId, details?.stageId, details?.assignedTo, pipelineOptions]);

  function saveNotes() {
    setSaving(true);
    void updateLead(leadId, { notes })
      .catch((err) => alert((err as Error).message))
      .finally(() => setSaving(false));
  }

  function changePipeline(pipelineId: string) {
    const pipeline = pipelineOptions.find((option) => option.id === pipelineId);
    setBusinessDraft((current) => ({
      ...current,
      pipelineId,
      stageId: pipeline?.stages[0]?.id ?? "none",
    }));
  }

  function saveBusiness() {
    const parsed = Number(businessDraft.valueReais.replace(/\./g, "").replace(",", "."));
    const valueCents = Math.round(Math.max(0, Number.isFinite(parsed) ? parsed : 0) * 100);
    setBusinessSaving(true);
    void updateChatLeadBusiness({
      leadId,
      valueCents,
      pipelineId: businessDraft.pipelineId === "none" ? null : businessDraft.pipelineId,
      stageId: businessDraft.stageId === "none" ? null : businessDraft.stageId,
      assignedTo: businessDraft.assignedTo === "none" ? null : businessDraft.assignedTo,
    })
      .catch((err) => alert((err as Error).message))
      .finally(() => setBusinessSaving(false));
  }

  return (
    <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border/60 bg-card/78 backdrop-blur-xl xl:block">
      <div className="border-b border-border/60 p-4">
        <div className="min-w-0">
          <Link href={`/leads/${leadId}`} className="block truncate text-base font-semibold hover:text-brand" prefetch>
            {leadName}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {channel === "instagram" ? "Instagram Direct" : formatPhone(leadPhone)}
          </p>
        </div>
      </div>

      <PanelSection title="Ações">
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm" className="justify-start">
            <Link href={`/leads/${leadId}`} prefetch>
              <Plus className="h-3.5 w-3.5" />
              Negócio
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="justify-start">
            <Link href="/automations" prefetch>
              <Zap className="h-3.5 w-3.5" />
              Automação
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="col-span-2 justify-start border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
            onClick={onFinalize}
            disabled={status === "resolvida"}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status === "resolvida" ? "Conversa resolvida" : "Finalizar atendimento"}
          </Button>
        </div>
      </PanelSection>

      <PanelSection title="Perfil">
        <InfoRow label="Nome" value={leadName} />
        <InfoRow label="E-mail" value={details?.email || "Email do lead"} muted={!details?.email} />
        <InfoRow label="Telefone" value={channel === "instagram" ? "Instagram Direct" : formatPhone(leadPhone)} />
        <InfoRow label="Origem" value={details?.source || "Nao informada"} muted={!details?.source} />
        <InfoRow label="Entrada" value={formatShortDate(details?.createdAt)} />
        {details?.tags?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {details.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-brand/10 px-2 py-1 text-[11px] font-medium text-brand">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </PanelSection>

      <PanelSection title="Notas">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anote contexto importante deste lead..."
          className="min-h-24 resize-none bg-background/70"
        />
        <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={saveNotes} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar notas
        </Button>
      </PanelSection>

      <PanelSection title="Negócio">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead-business-value" className="text-xs text-muted-foreground">
              Valor
            </Label>
            <Input
              id="lead-business-value"
              inputMode="decimal"
              value={businessDraft.valueReais}
              onChange={(event) => setBusinessDraft((current) => ({ ...current, valueReais: event.target.value }))}
              className="h-9 bg-background/70 text-right"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Funil</Label>
            <Select
              value={businessDraft.pipelineId}
              onValueChange={changePipeline}
              disabled={pipelineOptions.length === 0}
            >
              <SelectTrigger className="h-9 bg-background/70">
                <SelectValue placeholder="Selecione o funil" />
              </SelectTrigger>
              <SelectContent>
                {pipelineOptions.length === 0 ? (
                  <SelectItem value="none">Nenhum funil</SelectItem>
                ) : (
                  pipelineOptions.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select
              value={businessDraft.stageId}
              onValueChange={(stageId) => setBusinessDraft((current) => ({ ...current, stageId }))}
              disabled={selectedStages.length === 0}
            >
              <SelectTrigger className="h-9 bg-background/70">
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem etapa</SelectItem>
                {selectedStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <Select
              value={businessDraft.assignedTo}
              onValueChange={(assignedTo) => setBusinessDraft((current) => ({ ...current, assignedTo }))}
            >
              <SelectTrigger className="h-9 bg-background/70">
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não atribuído</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="button" size="sm" variant="outline" className="w-full" onClick={saveBusiness} disabled={businessSaving}>
            {businessSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar negócio
          </Button>
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          <InfoRow label="Próxima reunião" value={details?.nextAppointmentAt ? formatShortDate(details.nextAppointmentAt) : "Sem reunião"} muted={!details?.nextAppointmentAt} />
          <InfoRow label="Tarefas abertas" value={String(details?.openTasksCount ?? 0)} />
        </div>
      </PanelSection>
    </aside>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function InfoRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right", muted ? "text-muted-foreground" : "text-foreground")}>{value}</span>
    </div>
  );
}

function AccountSelector({
  accounts,
  selectedId,
  onChange,
}: {
  accounts: { id: string; phone_number: string; display_name: string | null; provider: string }[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = accounts.find((a) => a.id === selectedId) ?? accounts[0];

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!current) return null;

  const label = current.display_name || formatPhone(current.phone_number);
  const currentProviderLabel = current.provider === "cloud_api" ? "API Oficial" : current.provider === "evolution" ? "Evolution" : "Z-API";

  return (
    <div ref={ref} className="relative z-40 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/40"
        title="Escolher por qual API/numero enviar"
      >
        <Phone className="h-3.5 w-3.5 text-emerald-500" />
        <span className="max-w-[120px] truncate">{label}</span>
        <span className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground 2xl:inline">
          {currentProviderLabel}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border/60 bg-popover p-1 shadow-elev-2">
          <div className="border-b border-border/60 px-2.5 py-2">
            <p className="text-xs font-semibold">Enviar usando</p>
            <p className="text-[11px] text-muted-foreground">
              Troque de API quando a oficial estiver fora da janela de 24h.
            </p>
          </div>
          {accounts.map((a) => {
            const active = a.id === (selectedId ?? accounts[0]?.id);
            const providerLabel = a.provider === "cloud_api" ? "API Oficial" : a.provider === "evolution" ? "Evolution" : "Z-API";
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                  active && "bg-muted/40",
                )}
              >
                <Phone className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.display_name || formatPhone(a.phone_number)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {formatPhone(a.phone_number)} · {providerLabel}
                  </p>
                </div>
                {active && <Check className="h-4 w-4 shrink-0 text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageStatusLabel({ status }: { status: string }) {
  if (status === "pending") {
    return <span className="opacity-80">enviando…</span>;
  }
  if (status === "failed") {
    return <span className="font-medium text-red-200 dark:text-red-300">falhou</span>;
  }
  if (status === "read") {
    return (
      <span className="inline-flex items-center gap-0.5 font-medium">
        <CheckCheck className="h-3.5 w-3.5" aria-hidden />
        visualizado
      </span>
    );
  }
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <CheckCheck className="h-3.5 w-3.5 opacity-90" aria-hidden />
        entregue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <Check className="h-3.5 w-3.5 opacity-90" aria-hidden />
      enviado
    </span>
  );
}
