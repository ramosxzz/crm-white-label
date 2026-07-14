"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Pencil, Plus, Trash2, Sparkles, Mic, Square, RotateCcw, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuickMessage } from "@/lib/supabase/database.types";
import { QUICK_MESSAGE_PRESETS } from "@/lib/quick-messages/presets";
import {
  createQuickMessage,
  updateQuickMessage,
  deleteQuickMessage,
  addPresetQuickMessage,
  reorderQuickMessages,
} from "@/app/(app)/settings/quick-messages-actions";

export function QuickMessagesPanel({
  initialMessages,
  tenantId,
}: {
  initialMessages: QuickMessage[];
  tenantId: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuickMessage | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Áudio
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioTitle, setAudioTitle] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState("audio/ogg");
  const [savingAudio, setSavingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  function openAudio() {
    setAudioTitle("");
    setAudioBlob(null);
    setAudioPreview(null);
    setAudioMime("audio/ogg");
    setRecordSecs(0);
    setAudioOpen(true);
  }

  function onPickAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setMsg("Selecione um arquivo de áudio válido.");
      return;
    }
    setAudioBlob(file);
    setAudioMime(file.type || "audio/mpeg");
    setAudioPreview(URL.createObjectURL(file));
    if (!audioTitle.trim()) setAudioTitle(file.name.replace(/\.[^.]+$/, ""));
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
        setAudioBlob(blob);
        setAudioPreview(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      setMsg("Não foi possível acessar o microfone.");
    }
  }

  function stopRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  function resetAudio() {
    setAudioBlob(null);
    setAudioPreview(null);
    setRecordSecs(0);
  }

  function onSaveAudio() {
    if (!audioBlob || !audioTitle.trim()) return;
    setSavingAudio(true);
    setMsg(null);
    void (async () => {
      try {
        const supabase = createClient();
        const ext = audioMime.split("/")[1]?.split(";")[0] || "ogg";
        const path = `${tenantId}/quick-audio/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, audioBlob, { cacheControl: "3600", upsert: false, contentType: audioMime });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
        await createQuickMessage({ title: audioTitle.trim(), media_url: pub.publicUrl, media_type: "audio" });
        window.location.reload();
      } catch (e) {
        setMsg((e as Error).message);
        setSavingAudio(false);
      }
    })();
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const missingPresets = useMemo(() => {
    const have = new Set(messages.map((m) => `${m.title}::${m.body}`));
    return QUICK_MESSAGE_PRESETS.map((p, i) => ({ ...p, index: i })).filter(
      (p) => !have.has(`${p.title}::${p.body}`),
    );
  }, [messages]);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setBody("");
    setEditorOpen(true);
  }

  function openEdit(m: QuickMessage) {
    setEditing(m);
    setTitle(m.title);
    setBody(m.body ?? "");
    setEditorOpen(true);
  }

  function onSave() {
    setMsg(null);
    start(async () => {
      try {
        if (editing) {
          await updateQuickMessage({ id: editing.id, title, body });
          setMessages((prev) =>
            prev.map((m) => (m.id === editing.id ? { ...m, title, body } : m)),
          );
        } else {
          await createQuickMessage({ title, body });
          window.location.reload();
          return;
        }
        setEditorOpen(false);
        setMsg("Salvo");
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("Excluir esta mensagem rapida?")) return;
    start(async () => {
      try {
        await deleteQuickMessage(id);
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  function onAddPreset(index: number) {
    setMsg(null);
    start(async () => {
      try {
        await addPresetQuickMessage(index);
        window.location.reload();
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = messages.findIndex((m) => m.id === active.id);
    const newIndex = messages.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(messages, oldIndex, newIndex);
    setMessages(next);
    start(async () => {
      try {
        await reorderQuickMessages(next.map((m) => m.id));
      } catch (e) {
        setMessages(messages);
        setMsg((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Frases prontas para o chat. Qualquer membro da empresa pode criar, editar e reordenar
        arrastando pela alça à esquerda.
      </p>

      {missingPresets.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-brand" />
            Modelos prontos
          </div>
          <div className="flex flex-wrap gap-2">
            {missingPresets.map((p) => (
              <Button
                key={p.index}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onAddPreset(p.index)}
              >
                + {p.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={messages.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {messages.map((m) => (
              <SortableRow
                key={m.id}
                message={m}
                disabled={pending}
                onEdit={() => openEdit(m)}
                onDelete={() => onDelete(m.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova mensagem
        </Button>
        <Button type="button" variant="outline" onClick={openAudio}>
          <Mic className="h-4 w-4" />
          Novo áudio
        </Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      {/* Dialog de áudio */}
      <Dialog open={audioOpen} onOpenChange={(o) => { if (!savingAudio) setAudioOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-brand" />
              Novo áudio rápido
            </DialogTitle>
            <DialogDescription>
              Grave um áudio ou envie um arquivo pronto para disparar com um clique nas conversas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="qm-audio-title">Título</Label>
              <Input
                id="qm-audio-title"
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder="Ex.: Áudio de boas-vindas"
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              {!audioPreview ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  {recording ? (
                    <>
                      <span className="font-mono text-lg font-semibold text-red-600 dark:text-red-400">
                        {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, "0")}
                      </span>
                      <Button type="button" variant="destructive" onClick={stopRecording}>
                        <Square className="h-4 w-4" /> Parar gravação
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="brand" onClick={startRecording}>
                        <Mic className="h-4 w-4" /> Iniciar gravação
                      </Button>
                      <span className="text-xs text-muted-foreground">ou</span>
                      <input
                        ref={audioFileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={onPickAudioFile}
                      />
                      <Button type="button" variant="outline" onClick={() => audioFileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" /> Enviar arquivo pronto
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <audio controls src={audioPreview} className="w-full" />
                  <Button type="button" variant="outline" size="sm" onClick={resetAudio}>
                    <RotateCcw className="h-3.5 w-3.5" /> Regravar
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAudioOpen(false)} disabled={savingAudio}>
              Cancelar
            </Button>
            <Button type="button" variant="brand" onClick={onSaveAudio} disabled={savingAudio || !audioBlob || !audioTitle.trim()}>
              {savingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar áudio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar mensagem" : "Nova mensagem rápida"}</DialogTitle>
            <DialogDescription>
              Título curto para identificar no chat; o texto completo será inserido na conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="qm-title">Título</Label>
              <Input
                id="qm-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Saudacao"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qm-body">Mensagem</Label>
              <Textarea
                id="qm-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Texto enviado ao cliente..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="brand" onClick={onSave} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableRow({
  message,
  disabled,
  onEdit,
  onDelete,
}: {
  message: QuickMessage;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: message.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm"
    >
      <button
        type="button"
        className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Reordenar"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          {message.media_type === "audio" && <Mic className="h-3.5 w-3.5 text-brand" />}
          {message.title}
        </p>
        {message.media_url && message.media_type === "audio" ? (
          <audio controls src={message.media_url} className="mt-2 h-9 w-full max-w-xs" />
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{message.body}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} disabled={disabled}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
