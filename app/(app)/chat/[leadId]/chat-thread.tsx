"use client";

import { notify, notifyError } from "@/lib/ui/feedback";
import { formatBRTTime, formatBRTDateTime, formatBRTFullDate } from "@/lib/date/brt";
import { LinkifiedText } from "@/components/chat/linkified-text";
import { mediaSizeError } from "@/lib/whatsapp/media-limits";
import { withTimeout } from "@/lib/async/with-timeout";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
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
  Camera,
  PanelRight,
  MoreHorizontal,
  ArrowLeft,
  Wrench,
  Pin,
} from "lucide-react";
import { EmojiPickerButton } from "@/components/chat/emoji-picker-button";
import { updateLead } from "@/app/(app)/leads/actions";
import { setLeadQualityStars } from "@/app/(app)/ligacoes/actions";
import { scheduleCall, listScheduledCallsForLead } from "@/app/(app)/agenda/actions";
import { ScheduleMeetingButton } from "@/components/leads/schedule-meeting-button";
import { CallButton } from "@/components/leads/call-button";
import { WhatsAppCallButton } from "@/components/leads/whatsapp-call-button";
import { NewServiceOrderDialog } from "@/app/(app)/os/new-service-order-dialog";
import type { FieldServiceUser } from "@/lib/field-service/users";
import type { FieldServicePartner, WhatsAppProviderKind } from "@/lib/supabase/database.types";
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
import { messageMutationCapabilities } from "@/lib/chat/message-mutation-capabilities";
import { CONVERSATION_STATUSES, STATUS_META } from "@/lib/chat/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resizeChatComposer } from "@/lib/chat/composer-auto-resize";
import { cn, initials } from "@/lib/utils";
import { displayLeadName, displayLeadSubtitle } from "@/lib/leads/display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeadDeleteButton } from "@/components/leads/lead-delete-button";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { LeadTagPicker } from "@/components/leads/lead-tag-picker";
import { StarRating } from "@/components/leads/star-rating";
import { SaleStockDialog, type SaleStockProduct, type SaleStockLocation } from "@/components/estoque/sale-stock-dialog";
import { isCallAnswered } from "@/lib/integrations/call-answered";
import { buildRecordedAudio, createAudioMediaRecorder } from "@/lib/media/audio-recorder";
import {
  sendChatMessage,
  sendInstagramMessage,
  sendChatMedia,
  markConversationRead,
  setConversationStatusByLead,
  setConversationPinned,
  setLeadAutomations,
  scheduleChatMessage,
  listScheduledMessages,
  cancelScheduledMessage,
  updateChatLeadBusiness,
  updateChatLeadNotes,
  updateChatLeadTags,
  listLeadTagCatalog,
  editChatMessage,
  deleteChatMessage,
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
  qualityStars: number;
  lostReason: string | null;
  lostPain: string | null;
  creativeName: string | null;
};

type PipelineOption = {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string | null; position: number | null; is_lost?: boolean | null; is_won?: boolean | null }[];
};

type ScheduledMessage = {
  id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  send_at: string;
};

type LeadCallAttempt = {
  id: string;
  started_at: string;
  from: string;
  to: string;
  duration: number;
  hangup_cause: string;
  record_url: string | null;
};

type LeadDetailsRow = {
  pipeline_id: string | null;
  stage_id: string | null;
  assigned_to: string | null;
  email: string | null;
  source: string | null;
  notes: string | null;
  tags: string[] | null;
  value_cents: number | null;
  created_at: string;
  quality_stars: number | null;
  lost_reason: string | null;
  lost_pain: string | null;
  custom_fields: Record<string, unknown> | null;
};

function detectMediaKind(mime: string): MediaKind {
  if (mime.startsWith("image")) return "image";
  if (mime.startsWith("video")) return "video";
  if (mime.startsWith("audio")) return "audio";
  return "document";
}

// Realtime ja atualiza em tempo real; o polling e so uma rede de seguranca
// (caso o realtime perca um evento) e roda devagar e so com a aba visivel.
const POLL_MS = 90_000;
const CLOSE_CHANNEL_OPTIONS = ["Ligação", "Reunião (Meet)", "Reunião presencial", "WhatsApp", "Outro"];
const LEAD_SOURCE_OPTIONS = ["Social Seller", "Indicação", "Anúncio Meta", "Anúncio Google", "WhatsApp", "Instagram", "Site", "Outro"];

// Teto pro upload de midia do chat. Nao cancela o upload de verdade (a rede
// pode continuar tentando em segundo plano), mas garante que a tela nunca
// fica com "enviando" travado pra sempre - depois desse tempo o usuario ve
// um erro claro e pode tentar de novo, em vez de ficar esperando sem saber
// se ainda esta acontecendo alguma coisa.
const MEDIA_UPLOAD_TIMEOUT_MS = 4 * 60_000;
const MEDIA_UPLOAD_TIMEOUT_MESSAGE =
  "A conexão está muito lenta para enviar esse arquivo agora. Tente novamente com um Wi-Fi melhor, ou envie um arquivo menor.";

// Compara pelo dia no fuso de Brasilia, nao do runtime que renderiza (o
// container da VPS roda em UTC) - senao mensagem de madrugada/fim de noite
// aparecia com o rotulo do dia errado.
function brtDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (brtDateKey(d) === brtDateKey(today)) return "Hoje";
  if (brtDateKey(d) === brtDateKey(yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" });
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

  const optimisticMediaType = optimistic.media_type ?? null;
  const realMediaType = real.media_type ?? null;
  if (optimisticMediaType !== realMediaType) return false;

  if (!optimisticMediaType && optimisticBody !== realBody) return false;
  if (optimisticMediaType && optimisticBody && realBody && optimisticBody !== realBody) return false;

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

function buildLeadDetailsFromRow(
  row: LeadDetailsRow,
  previous: LeadDetails | undefined,
  pipelineOptions: PipelineOption[],
  users: { id: string; name: string }[],
): LeadDetails {
  const stageOwnerPipeline = row.stage_id
    ? pipelineOptions.find((pipeline) => pipeline.stages.some((stage) => stage.id === row.stage_id))
    : undefined;
  const pipelineId = row.pipeline_id ?? stageOwnerPipeline?.id ?? null;
  const pipeline = pipelineOptions.find((item) => item.id === pipelineId) ?? stageOwnerPipeline;
  const stage = pipelineOptions.flatMap((item) => item.stages).find((item) => item.id === row.stage_id);
  const assigned = users.find((user) => user.id === row.assigned_to);

  return {
    pipelineId,
    stageId: row.stage_id,
    assignedTo: row.assigned_to,
    email: row.email,
    source: row.source,
    notes: row.notes,
    tags: Array.isArray(row.tags) ? row.tags : [],
    valueCents: row.value_cents ?? 0,
    createdAt: row.created_at,
    stageName: stage?.name ?? null,
    stageColor: stage?.color ?? null,
    pipelineName: pipeline?.name ?? null,
    assignedName: assigned?.name ?? null,
    nextAppointmentAt: previous?.nextAppointmentAt ?? null,
    openTasksCount: previous?.openTasksCount ?? 0,
    qualityStars: row.quality_stars ?? 0,
    lostReason: row.lost_reason,
    lostPain: row.lost_pain,
    creativeName: (row.custom_fields?.meta_creative_name as string | undefined) ?? null,
  };
}

function replyPreview(message: ChatMessage): string {
  if (message.deleted_at) return "Mensagem apagada";
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
  conversationAccountId = null,
  conversationProviderKind = null,
  currentUserId,
  initialStatus = "nao_iniciada",
  initialPinned = false,
  initialAutomationsEnabled = true,
  initialMessages,
  initialScheduledMessages = [],
  quickMessages = [],
  professionals = [],
  users = [],
  services = [],
  whatsappAccounts = [],
  recentCalls = [],
  pipelineOptions = [],
  leadDetails: initialLeadDetails,
  callsEnabled = false,
  fieldService = null,
  saleStockProducts = null,
  saleStockLocations = null,
}: {
  leadId: string;
  tenantId: string;
  leadName: string;
  leadPhone: string;
  leadAvatarUrl?: string | null;
  channel?: "whatsapp" | "instagram";
  conversationId: string | null;
  conversationAccountId?: string | null;
  conversationProviderKind?: WhatsAppProviderKind | null;
  currentUserId?: string;
  initialStatus?: ConversationStatus;
  initialPinned?: boolean;
  initialAutomationsEnabled?: boolean;
  initialMessages: ChatMessage[];
  initialScheduledMessages?: ScheduledMessage[];
  quickMessages?: QuickMessage[];
  professionals?: { id: string; name: string }[];
  users?: { id: string; name: string }[];
  services?: { id: string; name: string; duration_minutes: number }[];
  whatsappAccounts?: WhatsAppAccountOption[];
  recentCalls?: LeadCallAttempt[];
  pipelineOptions?: PipelineOption[];
  leadDetails?: LeadDetails;
  callsEnabled?: boolean;
  /** null quando o tenant nao tem o ERP W+ ou o usuario nao pode abrir OS. */
  fieldService?: { consultants: FieldServiceUser[]; partners: FieldServicePartner[] } | null;
  saleStockProducts?: SaleStockProduct[] | null;
  saleStockLocations?: SaleStockLocation[] | null;
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
      .catch((err) => notifyError(err))
      .finally(() => setRenaming(false));
  }

  // Pre-seleciona a conta da conversa (o numero em que o lead falou), para a
  // resposta sair do mesmo numero quando o tenant tem varios. Cai na primeira
  // conta so quando a conversa ainda nao tem numero vinculado.
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(
    (conversationAccountId && whatsappAccounts.some((a) => a.id === conversationAccountId && a.health_status !== "offline")
      ? conversationAccountId
      : (currentUserId ? whatsappAccounts.find((a) => a.assigned_to === currentUserId && a.health_status !== "offline")?.id : undefined) ??
        whatsappAccounts.find((a) => a.health_status !== "offline")?.id) ?? undefined,
  );

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [pinned, setPinned] = useState(initialPinned);
  const [pinning, setPinning] = useState(false);
  const [status, setStatus] = useState<ConversationStatus>(initialStatus);
  const [automationsOn, setAutomationsOn] = useState(initialAutomationsEnabled);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [leadDetails, setLeadDetails] = useState<LeadDetails | undefined>(initialLeadDetails);
  const draftStorageKey = `chat-draft:${leadId}`;
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(draftStorageKey) ?? "";
  });
  const textDraftRef = useRef(text);
  const [quickMediaDraft, setQuickMediaDraft] = useState<QuickMediaDraft | null>(null);
  // Rastreia qual mensagem rapida foi usada por ultimo, para o gatilho de
  // automacao "mensagem enviada" poder filtrar por ela. Zera quando o texto
  // e apagado/trocado manualmente para nao atribuir errado.
  const [pendingQuickMessageId, setPendingQuickMessageId] = useState<string | null>(null);
  // Painel de detalhes do lead (tags, negocio, notas): fixo no desktop,
  // drawer no mobile para o CRM ficar 100% usavel pelo celular.
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  // No desktop (xl+) o painel de detalhes ficava sempre aberto, sem opcao de
  // recolher - pedido explicito pra poder minimizar quando nao precisar.
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(true);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editMessageText, setEditMessageText] = useState("");
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);
  const [messageMutationPending, setMessageMutationPending] = useState(false);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleKind, setScheduleKind] = useState<"message" | "call">("message");
  const [scheduleMediaUrl, setScheduleMediaUrl] = useState<string | null>(null);
  const [scheduleMediaName, setScheduleMediaName] = useState<string | null>(null);
  const [scheduleUploading, setScheduleUploading] = useState(false);
  const [pendingScheduled, setPendingScheduled] = useState<ScheduledMessage[]>(initialScheduledMessages);
  const [pendingScheduledCalls, setPendingScheduledCalls] = useState<{ id: string; starts_at: string; notes: string | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scheduleAudioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTargetRef = useRef<"send" | "schedule">("send");
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousLeadIdRef = useRef(leadId);

  const updateTextDraft = useCallback(
    (value: string) => {
      textDraftRef.current = value;
      setText(value);
      if (typeof window === "undefined") return;
      if (value) window.sessionStorage.setItem(draftStorageKey, value);
      else window.sessionStorage.removeItem(draftStorageKey);
    },
    [draftStorageKey],
  );

  useLayoutEffect(() => {
    if (composerTextareaRef.current) resizeChatComposer(composerTextareaRef.current);
  }, [text]);

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
      if (document.visibilityState === "visible") {
        await markConversationRead(conversationId);
      }
    } catch {
      /* mantém estado atual */
    }
  }, [conversationId]);

  const syncLeadDetails = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("leads")
      .select("pipeline_id, stage_id, assigned_to, email, source, notes, tags, value_cents, created_at, quality_stars, lost_reason, lost_pain, custom_fields")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!data) return;
    setLeadDetails((previous) =>
      buildLeadDetailsFromRow(data as LeadDetailsRow, previous, pipelineOptions, users),
    );
  }, [leadId, tenantId, pipelineOptions, users]);

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
    setPinned(initialPinned);
    setAutomationsOn(initialAutomationsEnabled);
    setMessages(initialMessages);
    setLeadDetails(initialLeadDetails);
    setPendingScheduled(initialScheduledMessages);
    if (leadChanged) {
      setQuickMediaDraft(null);
      const storedDraft = typeof window === "undefined" ? "" : window.sessionStorage.getItem(draftStorageKey) ?? "";
      textDraftRef.current = storedDraft;
      setText(storedDraft);
      setReplyTo(null);
    }
    shouldStickToBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [
    leadId,
    draftStorageKey,
    initialConversationId,
    initialStatus,
    initialPinned,
    initialAutomationsEnabled,
    initialMessages,
    initialLeadDetails,
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

  const togglePinned = useCallback(() => {
    if (!conversationId || pinning) return;
    const next = !pinned;
    setPinned(next);
    setPinning(true);
    void setConversationPinned({ conversationId, pinned: next })
      .then(() => notify({
        title: next ? "Conversa fixada no topo" : "Conversa desafixada",
        tone: "success",
      }))
      .catch((error) => {
        setPinned(!next);
        notifyError(error);
      })
      .finally(() => setPinning(false));
  }, [conversationId, pinned, pinning]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    requestAnimationFrame(() => scrollToBottom("smooth"));
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    // So marca como lido (zera nao-lido). Status permanece "aguardando" ate
    // o atendente responder de fato.
    void markConversationRead(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    void syncMessages();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void syncMessages();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, syncMessages]);

  useEffect(() => {
    const syncIfVisible = () => {
      if (document.visibilityState === "visible") void syncMessages();
    };
    document.addEventListener("visibilitychange", syncIfVisible);
    window.addEventListener("focus", syncIfVisible);
    window.addEventListener("online", syncIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", syncIfVisible);
      window.removeEventListener("focus", syncIfVisible);
      window.removeEventListener("online", syncIfVisible);
    };
  }, [syncMessages]);

  useEffect(() => {
    void syncLeadDetails();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void syncLeadDetails();
    }, 45_000);
    return () => clearInterval(timer);
  }, [syncLeadDetails]);

  useEffect(() => {
    const syncIfVisible = () => {
      if (document.visibilityState === "visible") void syncLeadDetails();
    };
    document.addEventListener("visibilitychange", syncIfVisible);
    window.addEventListener("focus", syncIfVisible);
    window.addEventListener("online", syncIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", syncIfVisible);
      window.removeEventListener("focus", syncIfVisible);
      window.removeEventListener("online", syncIfVisible);
    };
  }, [syncLeadDetails]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`lead-${leadId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads", filter: `id=eq.${leadId}` },
        (payload) => {
          setLeadDetails((previous) =>
            buildLeadDetailsFromRow(payload.new as LeadDetailsRow, previous, pipelineOptions, users),
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void syncLeadDetails();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [leadId, pipelineOptions, syncLeadDetails, users]);

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
          if (row.direction === "inbound" && document.visibilityState === "visible") {
            void markConversationRead(conversationId);
          }
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void syncMessages();
      });
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
      const quickMessageId = pendingQuickMessageId;
      updateTextDraft("");
      setQuickMediaDraft(null);
      setPendingQuickMessageId(null);
      void sendExistingMedia(draft.mediaUrl, draft.mediaType, body || undefined, quickMessageId ?? undefined);
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
    updateTextDraft("");
    const replyMessageId = replyTo?.id ?? null;
    setReplyTo(null);
    setMessages((prev) => [...prev, optimistic]);
    setStatus("em_atendimento");

    const quickMessageId = pendingQuickMessageId;
    setPendingQuickMessageId(null);

    start(async () => {
      try {
        let sentResult: { conversationId: string; message: ChatMessage };
        if (isInstagram) {
          sentResult = await sendInstagramMessage({ leadId, body });
        } else {
          const result = await sendChatMessage({
              leadId,
              body,
              accountId: selectedAccountId,
              replyToMessageId: replyMessageId,
              quickMessageId: quickMessageId ?? undefined,
            });
          if (!result.ok) throw new Error(result.error);
          sentResult = result;
        }
        if (!conversationId) setConversationId(sentResult.conversationId);
        setMessages((prev) => {
          const withoutOpt = prev.filter((m) => m.id !== optimistic.id);
          return mergeMessages(withoutOpt, [sentResult.message]);
        });
      } catch (err) {
        // Marca como falhou em vez de sumir com a bolha - senao a pessoa
        // nem sabe que precisa reenviar (parecia que a mensagem nunca
        // existiu).
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, status: "failed" } : m)));
        notifyError(err);
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
        const url = await withTimeout(
          uploadChatMedia(file, fileName),
          MEDIA_UPLOAD_TIMEOUT_MS,
          MEDIA_UPLOAD_TIMEOUT_MESSAGE,
        );
        const result = await sendChatMedia({
          leadId,
          mediaUrl: url,
          mediaKind: kind,
          fileName,
          mimeType: file.type || undefined,
          accountId: selectedAccountId,
        });
        if (!result.ok) throw new Error(result.error);
        if (!conversationId) setConversationId(result.conversationId);
        setMessages((prev) => {
          const withoutOpt = prev.filter((m) => m.id !== optimisticId);
          return mergeMessages(withoutOpt, [result.message]);
        });
        URL.revokeObjectURL(localUrl);
      } catch (err) {
        // Idem: mantem a bolha marcada como "falhou" em vez de apagar -
        // reportado com audio na Atacado Moda Sul (parecia que sumia sem
        // deixar rastro do que aconteceu). Nao revoga a URL local: e o
        // preview que sobra pra pessoa ouvir/ver o que tentou mandar.
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? { ...m, status: "failed" } : m)));
        notifyError(err);
      } finally {
        setUploading(false);
      }
    },
    [leadId, conversationId, uploadChatMedia, selectedAccountId],
  );

  async function uploadForSchedule(file: Blob, fileName: string) {
    setScheduleUploading(true);
    try {
      const url = await withTimeout(
        uploadChatMedia(file, fileName),
        MEDIA_UPLOAD_TIMEOUT_MS,
        MEDIA_UPLOAD_TIMEOUT_MESSAGE,
      );
      setScheduleMediaUrl(url);
      setScheduleMediaName(fileName);
    } catch (err) {
      notifyError(err);
    } finally {
      setScheduleUploading(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kind = detectMediaKind(file.type);
    // O WhatsApp recusa arquivo acima do teto dele independente do que a
    // gente aceitar aqui. Bloquear antes de subir evita minutos de upload
    // (em loja com conexao ruim, literalmente minutos) pra um envio que
    // nunca teria como dar certo do outro lado.
    const sizeError = mediaSizeError(kind, file.size);
    if (sizeError) {
      notify({ title: sizeError, tone: "error" });
      return;
    }
    void uploadAndSend(file, file.name, kind);
  }

  async function sendExistingMedia(url: string, kind: MediaKind, caption?: string, quickMessageId?: string) {
    setUploading(true);
    shouldStickToBottomRef.current = true;
    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, body: caption ?? "", direction: "outbound", created_at: new Date().toISOString(), status: "pending", media_url: url, media_type: kind },
    ]);
    setStatus("em_atendimento");
    try {
      const result = await sendChatMedia({ leadId, mediaUrl: url, mediaKind: kind, caption, accountId: selectedAccountId, quickMessageId });
      if (!result.ok) throw new Error(result.error);
      if (!conversationId) setConversationId(result.conversationId);
      setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== optimisticId), [result.message]));
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? { ...m, status: "failed" } : m)));
      notifyError(err);
    } finally {
      setUploading(false);
    }
  }

  function onPickQuick(m: { id?: string; title?: string | null; body: string | null; media_url: string | null; media_type: string | null }) {
    setPendingQuickMessageId(m.id ?? null);
    if (m.media_url && m.media_type === "audio") {
      if (isInstagram) {
        notify({ title: "Envio de áudio rápido ainda está disponível apenas para WhatsApp.", tone: "error" });
        return;
      }
      setQuickMediaDraft({ title: m.title ?? "Áudio rápido", mediaUrl: m.media_url, mediaType: "audio" });
      updateTextDraft(textDraftRef.current.startsWith("/") ? "" : textDraftRef.current);
    } else if (m.body) {
      setQuickMediaDraft(null);
      const currentDraft = textDraftRef.current;
      updateTextDraft(currentDraft.startsWith("/") || !currentDraft.trim() ? m.body! : `${currentDraft.trim()}\n\n${m.body}`);
      requestAnimationFrame(() => composerTextareaRef.current?.focus());
    }
  }

  async function startRecording(target: "send" | "schedule" = "send") {
    try {
      recordTargetRef.current = target;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = createAudioMediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const { blob, fileName } = buildRecordedAudio(mr, recordChunksRef.current);
        if (blob.size === 0) return;
        if (recordTargetRef.current === "schedule") void uploadForSchedule(blob, fileName);
        else void uploadAndSend(blob, fileName, "audio");
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

  function openPicker(accept: string) {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  }

  function refreshPendingScheduled() {
    void listScheduledMessages(leadId).then(setPendingScheduled).catch(() => {});
  }

  function refreshPendingScheduledCalls() {
    void listScheduledCallsForLead(leadId).then(setPendingScheduledCalls).catch(() => {});
  }

  useEffect(() => {
    refreshPendingScheduledCalls();
  }, [leadId]);

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
    if (file.size > 1024 * 1024 * 1024) {
      notify({ title: "Arquivo muito grande (máximo 1 GB).", tone: "error" });
      return;
    }
    void uploadForSchedule(file, file.name);
  }

  function submitSchedule() {
    if (!scheduleAt) return;
    if (scheduleKind === "call") {
      setScheduling(true);
      void scheduleCall({ leadId, startsAt: new Date(scheduleAt).toISOString(), notes: scheduleText.trim() || undefined })
        .then(() => {
          setScheduleText("");
          refreshPendingScheduledCalls();
        })
        .catch((err) => notifyError(err))
        .finally(() => setScheduling(false));
      return;
    }
    const body = scheduleText.trim();
    if (!body && !scheduleMediaUrl) return;
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
        if (scheduleText.trim() === text.trim()) updateTextDraft("");
        refreshPendingScheduled();
      })
      .catch((err) => notifyError(err))
      .finally(() => setScheduling(false));
  }

  function cancelSchedule(id: string) {
    void cancelScheduledMessage({ id, leadId })
      .then(() => refreshPendingScheduled())
      .catch((err) => notifyError(err));
  }

  function openEditMessage(message: ChatMessage) {
    setEditingMessage(message);
    setEditMessageText(message.body ?? "");
  }

  function submitMessageEdit() {
    const message = editingMessage;
    const body = editMessageText.trim();
    if (!message || !body || messageMutationPending) return;

    setMessageMutationPending(true);
    void editChatMessage({ messageId: message.id, body })
      .then((updated) => {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === updated.id
              ? { ...item, body: updated.body, edited_at: updated.edited_at }
              : item,
          ),
        );
        setEditingMessage(null);
        setEditMessageText("");
        notify({ title: "Mensagem editada no WhatsApp.", tone: "success" });
      })
      .catch((error) => notifyError(error))
      .finally(() => setMessageMutationPending(false));
  }

  function confirmMessageDelete() {
    const message = deletingMessage;
    if (!message || messageMutationPending) return;

    setMessageMutationPending(true);
    void deleteChatMessage({ messageId: message.id })
      .then((deleted) => {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === deleted.id
              ? {
                  ...item,
                  body: null,
                  media_url: null,
                  media_type: null,
                  deleted_at: deleted.deleted_at,
                }
              : item,
          ),
        );
        setReplyTo((current) => (current?.id === deleted.id ? null : current));
        setDeletingMessage(null);
        notify({ title: "Mensagem apagada para todos.", tone: "success" });
      })
      .catch((error) => notifyError(error))
      .finally(() => setMessageMutationPending(false));
  }

  const nextScheduled = pendingScheduled[0];
  const busy = pending || uploading;
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const mobileActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileActionsOpen) return;
    function onClick(e: MouseEvent) {
      if (mobileActionsRef.current && !mobileActionsRef.current.contains(e.target as Node)) {
        setMobileActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [mobileActionsOpen]);

  const mutationCapabilities = useMemo(
    () => messageMutationCapabilities(conversationProviderKind),
    [conversationProviderKind],
  );

  // Lista de mensagens memoizada: sem isso, cada tecla digitada no campo
  // de mensagem re-renderizava todas as bolhas (e seus <audio>), travando
  // a digitacao em conversas longas.
  const messageList = useMemo(() => (
    <>
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
                    const canEdit = Boolean(
                      outbound &&
                      !m.deleted_at &&
                      !m.media_url &&
                      !m.media_type &&
                      m.external_id &&
                      m.body?.trim() &&
                      mutationCapabilities.canEdit,
                    );
                    const canDelete = Boolean(
                      outbound &&
                      !m.deleted_at &&
                      m.external_id &&
                      mutationCapabilities.canDelete,
                    );
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "group flex items-end gap-1.5",
                          outbound ? "justify-end" : "justify-start",
                          sameAuthor ? "mt-0.5" : "mt-3",
                        )}
                      >
                        {outbound && !m.deleted_at && (
                          <div className="mb-1 flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                            {(canEdit || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="grid h-7 w-7 place-items-center rounded-full border border-border/50 bg-card/85 text-muted-foreground shadow-sm transition hover:text-foreground"
                                    title="Ações da mensagem"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="top" className="w-44">
                                  {canEdit && (
                                    <DropdownMenuItem onSelect={() => openEditMessage(m)} className="cursor-pointer gap-2">
                                      <Pencil className="h-4 w-4" />
                                      Editar mensagem
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem
                                      onSelect={() => setDeletingMessage(m)}
                                      className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Apagar para todos
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <button
                              type="button"
                              onClick={() => setReplyTo(m)}
                              className="grid h-7 w-7 place-items-center rounded-full border border-border/50 bg-card/85 text-muted-foreground shadow-sm transition hover:text-foreground"
                              title="Responder"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                          </div>
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
                            <span>{formatBRTTime(m.created_at)}</span>
                            {m.edited_at && !m.deleted_at && <span className="italic">editada</span>}
                            {outbound && <MessageStatusLabel status={m.status} />}
                          </div>
                        </div>
                        {!outbound && !m.deleted_at && (
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
    </>
  ), [grouped, mutationCapabilities.canDelete, mutationCapabilities.canEdit]);

  return (
    <section className="flex min-h-0 flex-1 bg-[hsl(var(--chat-surface))]">
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border/50 bg-card/78 px-3 py-2.5 backdrop-blur-md sm:px-5 sm:py-3.5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-3 md:gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <Link
            href="/chat"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden"
            title="Voltar para conversas"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-brand/25 sm:h-11 sm:w-11">
            {leadAvatarUrl && <AvatarImage src={leadAvatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-brand-muted text-sm font-semibold text-brand dark:bg-brand dark:text-brand-foreground">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={openRename}
              className="group flex max-w-full items-center gap-1.5 text-left"
              title="Renomear contato"
            >
              <span className="truncate font-display text-base font-semibold tracking-normal">{displayName}</span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <p className="truncate text-xs text-muted-foreground md:hidden">{displayPhone}</p>
          </div>
          {/* Estrela ali embaixo no painel lateral era facil de esquecer de
              preencher - fica aqui em cima, sempre visivel ao abrir o chat. */}
          <StarRating
            value={leadDetails?.qualityStars ?? 0}
            onChange={(next) => {
              setLeadDetails((current) => (current ? { ...current, qualityStars: next } : current));
              void setLeadQualityStars({ leadId, stars: next }).catch((err) => notifyError(err));
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 rounded-lg",
              pinned && "border-brand/50 bg-brand/12 text-brand hover:bg-brand/20",
            )}
            onClick={togglePinned}
            disabled={!conversationId || pinning}
            title={pinned ? "Desafixar conversa" : "Fixar conversa no topo"}
            aria-pressed={pinned}
          >
            {pinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className={cn("h-4 w-4", pinned && "fill-current")} />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg md:hidden"
            onClick={() => setSidePanelOpen(true)}
            title="Detalhes do contato"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative z-30 hidden min-w-0 shrink-0 items-center gap-2 md:flex md:justify-end">
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
          {!isInstagram && leadPhone && callsEnabled && <CallButton leadId={leadId} phone={leadPhone} iconOnly />}
          {!isInstagram && leadPhone && <WhatsAppCallButton phone={leadPhone} iconOnly />}
          {!isInstagram && (
            <Link
              href={`/chat/${leadId}/export`}
              target="_blank"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/70 transition-colors hover:bg-muted/40"
              title="Exportar conversa em PDF"
            >
              <FileText className="h-4 w-4" />
            </Link>
          )}
          {fieldService && (
            <NewServiceOrderDialog
              lead={{ id: leadId, name: displayName, phone: leadPhone || null }}
              consultants={fieldService.consultants}
            partners={fieldService.partners}
            showMiniAgenda

            lockedConsultant={fieldService.lockedConsultant}

            leadReferral={fieldService.leadReferral}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-lg"
                  title="Abrir ordem de serviço para esse cliente"
                >
                  <Wrench className="h-4 w-4" />
                </Button>
              }
            />
          )}
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-lg"
            onClick={() => {
              setSidePanelOpen(true);
              setDesktopPanelOpen((open) => !open);
            }}
            title={desktopPanelOpen ? "Recolher detalhes do contato" : "Mostrar detalhes do contato"}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>

        <div ref={mobileActionsRef} className="relative z-30 md:hidden">
          <div className="grid grid-cols-[auto,minmax(0,1fr),auto,auto] items-center gap-2">
            <button
              type="button"
              onClick={toggleAutomations}
              title={automationsOn ? "Automações ligadas" : "Automações pausadas"}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-lg border text-xs font-medium transition-colors",
                automationsOn
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "border-border/60 text-muted-foreground hover:bg-muted/40",
              )}
            >
              {automationsOn ? <Bot className="h-4 w-4" /> : <BotOff className="h-4 w-4" />}
            </button>

            {!isInstagram && whatsappAccounts.length > 0 ? (
              <AccountSelector
                accounts={whatsappAccounts}
                selectedId={selectedAccountId}
                onChange={setSelectedAccountId}
                className="min-w-0"
              />
            ) : (
              <div />
            )}

            <StatusSelector status={status} onChange={changeStatus} compact />

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-lg"
              onClick={() => setMobileActionsOpen((value) => !value)}
              title="Mais ações"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {mobileActionsOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-border/70 bg-popover p-2 shadow-elev-2">
              <div className="grid grid-cols-2 gap-2">
                <ScheduleMeetingButton
                  leadId={leadId}
                  leadName={displayName}
                  professionals={professionals}
                  users={users}
                  services={services}
                  variant="outline"
                  size="sm"
                />
                {!isInstagram && leadPhone && callsEnabled && <CallButton leadId={leadId} phone={leadPhone} />}
                {!isInstagram && leadPhone && <WhatsAppCallButton phone={leadPhone} />}
                {!isInstagram && (
                  <Link href={`/chat/${leadId}/export`} target="_blank" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border/70 px-3 text-sm font-medium hover:bg-muted/40">
                    <FileText className="h-4 w-4" /> PDF
                  </Link>
                )}
                {fieldService && (
                  <NewServiceOrderDialog
                    lead={{ id: leadId, name: displayName, phone: leadPhone || null }}
                    consultants={fieldService.consultants}
            partners={fieldService.partners}
            showMiniAgenda

            lockedConsultant={fieldService.lockedConsultant}

            leadReferral={fieldService.leadReferral}
                    trigger={
                      <Button type="button" variant="outline" size="sm" className="rounded-lg">
                        <Wrench className="h-4 w-4" />
                        Nova OS
                      </Button>
                    }
                  />
                )}
                {status !== "resolvida" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                    onClick={() => {
                      changeStatus("resolvida");
                      setMobileActionsOpen(false);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Finalizar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    setSidePanelOpen(true);
                    setMobileActionsOpen(false);
                  }}
                >
                  <PanelRight className="h-4 w-4" />
                  Detalhes
                </Button>
              </div>
              <div className="mt-2 border-t border-border/60 pt-2">
                <LeadDeleteButton leadId={leadId} leadName={displayName} redirectTo="/chat" size="sm" iconOnly={false} />
              </div>
            </div>
          )}
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
                    para {formatBRTDateTime(nextScheduled.send_at)}
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

      {pendingScheduledCalls.length > 0 && (
        <div className="shrink-0 border-b border-brand/20 bg-brand/10 px-4 py-2.5 text-brand-foreground sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/12 text-brand">
                <Phone className="h-4 w-4" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-foreground">
                  {pendingScheduledCalls.length === 1
                    ? "1 ligação agendada"
                    : `${pendingScheduledCalls.length} ligações agendadas`}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    para {formatBRTDateTime(pendingScheduledCalls[0].starts_at)}
                  </span>
                </p>
                {pendingScheduledCalls[0].notes && (
                  <p className="truncate text-xs text-muted-foreground">{pendingScheduledCalls[0].notes}</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              onClick={() => setScheduleOpen(true)}
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
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6"
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
        {messageList}
        </div>
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border/50 bg-card/92 px-2 py-2 backdrop-blur-md sm:px-6 sm:py-3">
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
          <form onSubmit={onSubmit} className="relative mx-auto flex max-w-3xl items-end gap-1.5 sm:gap-2">
            {!isInstagram && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground sm:h-12 sm:w-11"
                    disabled={busy}
                    title="Anexar"
                  >
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

            <EmojiPickerButton
              disabled={busy}
              onPick={(emoji) => {
                updateTextDraft(`${text}${emoji}`);
                setPendingQuickMessageId(null);
              }}
            />

            {/* Agendar mensagem (atalho direto) */}
            {!isInstagram && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden h-12 w-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground sm:inline-flex"
                onClick={openSchedule}
                disabled={busy}
                title="Agendar mensagem"
              >
                <CalendarClock className="h-5 w-5" />
              </Button>
            )}

            {quickMediaDraft && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-border bg-popover p-3 shadow-lg sm:left-16 sm:right-14">
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
              <div className="absolute bottom-full left-0 right-0 mb-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-lg sm:left-16 sm:right-14">
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
              ref={composerTextareaRef}
              rows={1}
              placeholder={isInstagram ? "Responder..." : "Mensagem ou / rápidas..."}
              value={text}
              onChange={(e) => {
                updateTextDraft(e.target.value);
                setPendingQuickMessageId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              className="min-h-[44px] max-h-32 min-w-0 flex-1 resize-none rounded-2xl border-border/60 bg-background/70 py-2.5 text-sm sm:min-h-[48px] sm:py-3 sm:text-base"
            />
            {text.trim() || quickMediaDraft || isInstagram ? (
              <Button
                type="submit"
                variant="brand"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl sm:h-12 sm:w-12"
                disabled={busy || (!text.trim() && !quickMediaDraft)}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            ) : (
              <Button
                type="button"
                variant="brand"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl sm:h-12 sm:w-12"
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

      <Dialog
        open={Boolean(editingMessage)}
        onOpenChange={(open) => {
          if (!open && !messageMutationPending) {
            setEditingMessage(null);
            setEditMessageText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-brand" />
              Editar mensagem
            </DialogTitle>
            <DialogDescription>
              O novo texto também será atualizado na conversa do WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="edit-message-text">Mensagem</Label>
            <Textarea
              id="edit-message-text"
              rows={5}
              maxLength={4096}
              value={editMessageText}
              onChange={(event) => setEditMessageText(event.target.value)}
              autoFocus
            />
            <p className="text-right text-xs text-muted-foreground">{editMessageText.length}/4096</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingMessage(null)}
              disabled={messageMutationPending}
            >
              Cancelar
            </Button>
            <Button
              variant="brand"
              onClick={submitMessageEdit}
              disabled={
                messageMutationPending ||
                !editMessageText.trim() ||
                editMessageText.trim() === editingMessage?.body?.trim()
              }
            >
              {messageMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar edição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingMessage)}
        onOpenChange={(open) => {
          if (!open && !messageMutationPending) setDeletingMessage(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Apagar mensagem para todos?
            </DialogTitle>
            <DialogDescription>
              A mensagem será removida no WhatsApp e ficará identificada como apagada no histórico do CRM.
            </DialogDescription>
          </DialogHeader>
          {deletingMessage?.body && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border/60 bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
              {deletingMessage.body}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingMessage(null)} disabled={messageMutationPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmMessageDelete} disabled={messageMutationPending}>
              {messageMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Apagar para todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {scheduleKind === "call" ? "Agendar ligação" : "Agendar mensagem"}
            </DialogTitle>
            <DialogDescription>
              {scheduleKind === "call"
                ? "A ligação entra na sua lista de ligações agendadas para o horário escolhido."
                : "A mensagem será enviada automaticamente pelo WhatsApp no horário escolhido."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={scheduleKind === "message" ? "brand" : "outline"} className="flex-1" onClick={() => setScheduleKind("message")}>
                Mensagem
              </Button>
              <Button type="button" size="sm" variant={scheduleKind === "call" ? "brand" : "outline"} className="flex-1" onClick={() => setScheduleKind("call")}>
                Ligação
              </Button>
            </div>
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
              <Label htmlFor="schedule-text">{scheduleKind === "call" ? "Observação (opcional)" : "Mensagem"}</Label>
              <Textarea
                id="schedule-text"
                rows={4}
                placeholder={scheduleKind === "call" ? "Ex: retornar sobre valores..." : "Escreva a mensagem a ser enviada (opcional se anexar áudio)..."}
                value={scheduleText}
                onChange={(e) => setScheduleText(e.target.value)}
              />
            </div>
            {scheduleKind === "message" && (
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
            )}
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
                          {formatBRTDateTime(s.send_at)}
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
              disabled={scheduling || scheduleUploading || !scheduleAt || (scheduleKind === "message" && !scheduleText.trim() && !scheduleMediaUrl)}
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
        recentCalls={recentCalls}
        callsEnabled={callsEnabled}
        onFinalize={() => changeStatus("resolvida")}
        mobileOpen={sidePanelOpen}
        onMobileClose={() => setSidePanelOpen(false)}
        desktopOpen={desktopPanelOpen}
        saleStockProducts={saleStockProducts}
        saleStockLocations={saleStockLocations}
      />
    </section>
  );
}

function StatusSelector({
  status,
  onChange,
  compact = false,
}: {
  status: ConversationStatus;
  onChange: (next: ConversationStatus) => void;
  compact?: boolean;
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
          "inline-flex h-10 max-w-full items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
          meta.pill,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className={cn("truncate", compact && "hidden min-[390px]:inline")}>{meta.label}</span>
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
  if (m.deleted_at) {
    return (
      <p className="flex items-center gap-1.5 italic opacity-70">
        <Trash2 className="h-3.5 w-3.5" />
        Mensagem apagada
      </p>
    );
  }

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
        <img src={src} alt="" loading="lazy" decoding="async" className="max-h-64 max-w-full rounded-lg object-cover" />
        {m.body && m.body !== "📷 Imagem" && (
          <LinkifiedText text={m.body} className="whitespace-pre-wrap break-words" />
        )}
      </div>
    );
  }

  if (url && type === "sticker") {
    return (
      <div className="space-y-1">
        {quoted}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Figurinha" loading="lazy" decoding="async" className="h-32 w-32 object-contain" />
      </div>
    );
  }

  if (url && type.startsWith("video")) {
    return (
      <div className="space-y-1">
        {quoted}
        <video controls preload="none" src={src} className="max-h-64 max-w-full rounded-lg" />
        {m.body && !m.body.startsWith("🎬") && (
          <LinkifiedText text={m.body} className="whitespace-pre-wrap break-words" />
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
      <LinkifiedText text={m.body ?? ""} className="whitespace-pre-wrap break-words" />
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
        preload="none"
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
  return formatBRTFullDate(iso);
}

function formatCallDate(iso: string): string {
  return formatBRTDateTime(iso);
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

function describeCallCause(cause: string): string {
  switch (cause) {
    case "NO_ANSWER":
      return "Não atendeu";
    case "ORIGINATOR_CANCEL":
      return "Cancelada";
    case "UNALLOCATED_NUMBER":
      return "Número inválido";
    case "NUMBER_CHANGED":
      return "Número alterado";
    default:
      return "Falhou";
  }
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
  recentCalls,
  callsEnabled = false,
  onFinalize,
  mobileOpen,
  onMobileClose,
  desktopOpen = true,
  saleStockProducts = null,
  saleStockLocations = null,
}: {
  leadId: string;
  leadName: string;
  leadPhone: string;
  channel: "whatsapp" | "instagram";
  status: ConversationStatus;
  details?: LeadDetails;
  users: { id: string; name: string }[];
  pipelineOptions: PipelineOption[];
  recentCalls: LeadCallAttempt[];
  callsEnabled?: boolean;
  onFinalize: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  desktopOpen?: boolean;
  saleStockProducts?: SaleStockProduct[] | null;
  saleStockLocations?: SaleStockLocation[] | null;
}) {
  const [notes, setNotes] = useState(details?.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const confirmedNotesRef = useRef<string | null>(null);
  const notesRef = useRef(notes);
  const notesDirtyRef = useRef(notesDirty);
  useEffect(() => {
    notesRef.current = notes;
    notesDirtyRef.current = notesDirty;
  }, [notes, notesDirty]);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>(details?.tags ?? []);
  const [tagOptions, setTagOptions] = useState<string[]>(details?.tags ?? []);
  const [tagsSaving, setTagsSaving] = useState(false);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessDirty, setBusinessDirty] = useState(false);
  const [lostReason, setLostReason] = useState(details?.lostReason ?? "");
  const [lostPain, setLostPain] = useState(details?.lostPain ?? "");
  const [closeChannel, setCloseChannel] = useState("");
  function deriveSourceSelect(value: string): string {
    if (!value) return "none";
    return LEAD_SOURCE_OPTIONS.includes(value) ? value : "Outro";
  }
  const [sourceSelect, setSourceSelect] = useState(() => deriveSourceSelect(details?.source ?? ""));
  const [sourceCustomText, setSourceCustomText] = useState(() =>
    deriveSourceSelect(details?.source ?? "") === "Outro" ? (details?.source ?? "") : "",
  );
  const [creativeDraft, setCreativeDraft] = useState(details?.creativeName ?? "");
  const [saleDeductOpen, setSaleDeductOpen] = useState(false);
  function stageIsWon(stageId: string | null): boolean {
    if (!stageId) return false;
    for (const pipeline of pipelineOptions) {
      const stage = pipeline.stages.find((s) => s.id === stageId);
      if (stage) return Boolean(stage.is_won);
    }
    return false;
  }
  const stageOwnerPipelineId = useMemo(() => {
    if (!details?.stageId) return null;
    return pipelineOptions.find((pipeline) => pipeline.stages.some((stage) => stage.id === details.stageId))?.id ?? null;
  }, [details?.stageId, pipelineOptions]);
  const [businessDraft, setBusinessDraft] = useState(() => ({
    valueReais: ((details?.valueCents ?? 0) / 100).toFixed(2).replace(".", ","),
    pipelineId:
      details?.pipelineId ??
      pipelineOptions.find((pipeline) => pipeline.stages.some((stage) => stage.id === details?.stageId))?.id ??
      pipelineOptions[0]?.id ??
      "none",
    stageId: details?.stageId ?? "none",
    assignedTo: details?.assignedTo ?? "none",
  }));

  const selectedPipeline =
    pipelineOptions.find((pipeline) => pipeline.id === businessDraft.pipelineId) ?? pipelineOptions[0] ?? null;
  const selectedStages = selectedPipeline?.stages ?? [];

  useEffect(() => {
    confirmedNotesRef.current = null;
    setNotes(details?.notes ?? "");
    setNotesDirty(false);
    setBusinessDirty(false);
    setLostReason(details?.lostReason ?? "");
    setLostPain(details?.lostPain ?? "");
    setCloseChannel("");
    setSourceSelect(deriveSourceSelect(details?.source ?? ""));
    setSourceCustomText(deriveSourceSelect(details?.source ?? "") === "Outro" ? (details?.source ?? "") : "");
    setCreativeDraft(details?.creativeName ?? "");
    // Trocar de lead sem clicar "Salvar notas" descartava o texto digitado
    // (o reset acima roda pro novo lead antes do usuario salvar o antigo).
    // O cleanup fecha sobre o leadId anterior; salva a nota pendente antes
    // de o painel virar pro proximo lead.
    const previousLeadId = leadId;
    return () => {
      if (notesDirtyRef.current) {
        void updateChatLeadNotes({ leadId: previousLeadId, notes: notesRef.current }).catch(() => {});
      }
    };
  }, [leadId]);

  useEffect(() => {
    if (notesDirty || saving) return;
    const incomingNotes = details?.notes ?? "";
    if (confirmedNotesRef.current !== null && incomingNotes !== confirmedNotesRef.current) return;
    confirmedNotesRef.current = null;
    setNotes(incomingNotes);
  }, [details?.notes, notesDirty, saving]);

  useEffect(() => {
    setTags(details?.tags ?? []);
  }, [details?.tags]);

  useEffect(() => {
    let active = true;
    void listLeadTagCatalog()
      .then((catalog) => {
        if (active) setTagOptions(catalog);
      })
      .catch((error) => notifyError(error));
    return () => {
      active = false;
    };
  }, []);

  function persistTags(next: string[]) {
    const prev = tags;
    setTags(next);
    setTagsSaving(true);
    void updateChatLeadTags({ leadId, tags: next })
      .then((res) => {
        if (res?.tags) {
          setTags(res.tags);
          setTagOptions((current) => Array.from(new Set([...current, ...res.tags])));
        }
      })
      .catch((err) => {
        setTags(prev);
        notifyError(err);
      })
      .finally(() => setTagsSaving(false));
  }

  useEffect(() => {
    if (businessDirty || businessSaving) return;
    setBusinessDraft({
      valueReais: ((details?.valueCents ?? 0) / 100).toFixed(2).replace(".", ","),
      pipelineId: details?.pipelineId ?? stageOwnerPipelineId ?? pipelineOptions[0]?.id ?? "none",
      stageId: details?.stageId ?? "none",
      assignedTo: details?.assignedTo ?? "none",
    });
  }, [details?.valueCents, details?.pipelineId, details?.stageId, details?.assignedTo, pipelineOptions, stageOwnerPipelineId, businessDirty, businessSaving]);

  function saveNotes() {
    setSaving(true);
    void updateChatLeadNotes({ leadId, notes })
      .then((res) => {
        confirmedNotesRef.current = res.notes;
        setNotes(res.notes);
        setNotesDirty(false);
      })
      .catch((err) => notifyError(err))
      .finally(() => setSaving(false));
  }

  function changePipeline(pipelineId: string) {
    const pipeline = pipelineOptions.find((option) => option.id === pipelineId);
    setBusinessDirty(true);
    setBusinessDraft((current) => ({
      ...current,
      pipelineId,
      stageId: pipeline?.stages[0]?.id ?? "none",
    }));
  }

  function saveBusiness() {
    const parsed = Number(businessDraft.valueReais.replace(/\./g, "").replace(",", "."));
    const valueCents = Math.round(Math.max(0, Number.isFinite(parsed) ? parsed : 0) * 100);
    const wasWon = stageIsWon(details?.stageId ?? null);
    const willBeWon = stageIsWon(businessDraft.stageId === "none" ? null : businessDraft.stageId);
    setBusinessSaving(true);
    void updateChatLeadBusiness({
      leadId,
      valueCents,
      pipelineId: businessDraft.pipelineId === "none" ? null : businessDraft.pipelineId,
      stageId: businessDraft.stageId === "none" ? null : businessDraft.stageId,
      assignedTo: businessDraft.assignedTo === "none" ? null : businessDraft.assignedTo,
      lostReason,
      lostPain,
      closeChannel,
      source: sourceSelect === "none" ? "" : sourceSelect === "Outro" ? sourceCustomText : sourceSelect,
      creativeName: creativeDraft,
    })
      .then((res) => {
        setBusinessDirty(false);
        if (res?.tags) setTags(res.tags);
        if (!wasWon && willBeWon && saleStockProducts) setSaleDeductOpen(true);
      })
      .catch((err) => notifyError(err))
      .finally(() => setBusinessSaving(false));
  }

  return (
    <>
      {/* Backdrop no mobile quando o drawer esta aberto */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 xl:hidden" onClick={onMobileClose} aria-hidden />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[86vw] max-w-sm shrink-0 overflow-y-auto border-l border-border/60 bg-card backdrop-blur-xl transition-[width,transform] duration-200",
          "xl:static xl:z-auto xl:max-w-none xl:translate-x-0 xl:bg-card/78",
          mobileOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0",
          desktopOpen ? "xl:w-[360px]" : "xl:w-0 xl:overflow-hidden xl:border-l-0",
        )}
      >
      <div className="flex items-center justify-between border-b border-border/60 p-4">
        <div className="min-w-0">
          <Link href={`/leads/${leadId}`} className="block truncate text-base font-semibold hover:text-brand" prefetch>
            {leadName}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {channel === "instagram" ? "Instagram Direct" : formatPhone(leadPhone)}
          </p>
        </div>
        <button
          type="button"
          onClick={onMobileClose}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 xl:hidden"
          aria-label="Fechar detalhes"
        >
          <X className="h-5 w-5" />
        </button>
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
        <InfoRow label="Entrada" value={formatShortDate(details?.createdAt)} />
      </PanelSection>

      <PanelSection title="Tags">
        <LeadTagPicker value={tags} options={tagOptions} onChange={persistTags} disabled={tagsSaving} />
      </PanelSection>

      <PanelSection title="Notas">
        <Textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesDirty(true);
          }}
          placeholder="Anote contexto importante deste lead..."
          className="min-h-24 resize-none bg-background/70"
        />
        <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={saveNotes} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar notas
        </Button>
      </PanelSection>

      {callsEnabled && (
      <PanelSection title="Ligações recentes">
        {recentCalls.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma tentativa recente registrada para este lead.</p>
        ) : (
          <div className="space-y-2">
            {recentCalls.map((call) => {
              const answered = isCallAnswered(call.duration);
              return (
                <div key={call.id} className="rounded-lg border border-border/60 bg-background/45 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatCallDate(call.started_at)}</span>
                    <span className={cn("rounded-full px-2 py-0.5", answered ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-300")}>
                      {answered ? "Atendida" : describeCallCause(call.hangup_cause)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-muted-foreground">
                    <span>Ramal {call.from || "-"}</span>
                    <span>{formatDuration(call.duration)}</span>
                  </div>
                  {call.record_url && (
                    <a href={call.record_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-brand hover:underline">
                      Ouvir gravação
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>
      )}

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
              onChange={(event) => {
                setBusinessDirty(true);
                setBusinessDraft((current) => ({ ...current, valueReais: event.target.value }));
              }}
              className="h-9 bg-background/70 text-right"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Origem</Label>
            <Select
              value={sourceSelect}
              onValueChange={(value) => {
                setBusinessDirty(true);
                setSourceSelect(value);
              }}
            >
              <SelectTrigger className="h-9 bg-background/70">
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informada</SelectItem>
                {LEAD_SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourceSelect === "Outro" && (
              <Input
                value={sourceCustomText}
                onChange={(e) => {
                  setBusinessDirty(true);
                  setSourceCustomText(e.target.value);
                }}
                placeholder="Qual origem?"
                className="h-9 bg-background/70"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Criativo</Label>
            <Input
              value={creativeDraft}
              onChange={(e) => {
                setBusinessDirty(true);
                setCreativeDraft(e.target.value);
              }}
              placeholder="Qual anúncio/peça o lead veio"
              className="h-9 bg-background/70"
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
              onValueChange={(stageId) => {
                setBusinessDirty(true);
                setBusinessDraft((current) => ({ ...current, stageId }));
              }}
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
              onValueChange={(assignedTo) => {
                setBusinessDirty(true);
                setBusinessDraft((current) => ({ ...current, assignedTo }));
              }}
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

          {selectedStages.find((stage) => stage.id === businessDraft.stageId)?.is_lost && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dor do cliente</Label>
                <Input
                  value={lostPain}
                  onChange={(e) => {
                    setBusinessDirty(true);
                    setLostPain(e.target.value);
                  }}
                  placeholder="Ex: precisa resolver o problema antes de decidir"
                  className="h-9 bg-background/70"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Motivo da desistência</Label>
                <Input
                  value={lostReason}
                  onChange={(e) => {
                    setBusinessDirty(true);
                    setLostReason(e.target.value);
                  }}
                  placeholder="Ex: financeiro, valor caro..."
                  className="h-9 bg-background/70"
                />
              </div>
            </>
          )}

          {selectedStages.find((stage) => stage.id === businessDraft.stageId)?.is_won && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Canal de fechamento</Label>
              <Select
                value={closeChannel || "none"}
                onValueChange={(value) => {
                  setBusinessDirty(true);
                  setCloseChannel(value === "none" ? "" : value);
                }}
              >
                <SelectTrigger className="h-9 bg-background/70">
                  <SelectValue placeholder="Como fechou?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {CLOSE_CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

      <PanelSection title="Histórico">
        <LeadTimeline leadId={leadId} />
      </PanelSection>
      </aside>

      {saleDeductOpen && saleStockProducts && saleStockLocations && (
        <SaleStockDialog
          leadId={leadId}
          leadName={leadName}
          products={saleStockProducts}
          locations={saleStockLocations}
          onClose={() => setSaleDeductOpen(false)}
        />
      )}
    </>
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

type WhatsAppAccountOption = {
  id: string;
  phone_number: string;
  display_name: string | null;
  provider: string;
  assigned_to?: string | null;
  health_status?: "healthy" | "warning" | "offline";
  last_error_message?: string | null;
};

function AccountSelector({
  accounts,
  selectedId,
  onChange,
  className,
}: {
  accounts: WhatsAppAccountOption[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = accounts.find((a) => a.id === selectedId && a.health_status !== "offline") ??
    accounts.find((a) => a.health_status !== "offline") ?? accounts[0];

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
    <div ref={ref} className={cn("relative z-40 shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-full shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2.5 text-xs font-medium transition-colors hover:bg-muted/40"
        title="Escolher por qual API/numero enviar"
      >
        <Phone className="h-3.5 w-3.5 text-emerald-500" />
        <span className="min-w-0 flex-1 truncate text-left md:max-w-[120px]">{label}</span>
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
            const offline = a.health_status === "offline";
            const providerLabel = a.provider === "cloud_api" ? "API Oficial" : a.provider === "evolution" ? "Evolution" : "Z-API";
            return (
              <button
                key={a.id}
                type="button"
                disabled={offline}
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                  active && "bg-muted/40",
                  offline && "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
              >
                <Phone className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.display_name || formatPhone(a.phone_number)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {formatPhone(a.phone_number)} · {providerLabel}{offline ? " · Desconectado" : ""}
                  </p>
                </div>
                {offline ? (
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500">Offline</span>
                ) : active ? (
                  <Check className="h-4 w-4 shrink-0 text-brand" />
                ) : null}
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
      <span className="inline-flex items-center gap-0.5 font-medium text-sky-400">
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
