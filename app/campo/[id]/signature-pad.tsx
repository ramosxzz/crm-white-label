"use client";

import { useEffect, useRef, useState } from "react";
import { PenLine, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queueMutation } from "@/lib/field-service/offline";
import { notify, notifyError } from "@/lib/ui/feedback";
import { buildFilePath, syncNow } from "../sync";

/**
 * Assinatura do cliente no proprio celular do tecnico.
 *
 * Usa pointer events (nao touch/mouse separados) pra funcionar igual com
 * dedo e caneta. O canvas e desenhado na resolucao real da tela, senao o
 * traco sai serrilhado nos aparelhos com devicePixelRatio > 1.
 */
export function SignaturePad({
  serviceOrderId,
  signedAt,
  signerName,
}: {
  serviceOrderId: string;
  signedAt: string | null;
  signerName: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokesRef = useRef(false);
  const [name, setName] = useState(signerName ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(signedAt);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    canvasRef.current?.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    hasStrokesRef.current = true;
    const point = pointFrom(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const point = pointFrom(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function end() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokesRef.current = false;
  }

  async function save() {
    if (!hasStrokesRef.current) {
      notify({ title: "Peça para o cliente assinar no quadro", tone: "error" });
      return;
    }
    if (!name.trim()) {
      notify({ title: "Informe quem está assinando", tone: "error" });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/png"),
      );
      if (!blob) throw new Error("Não foi possível gerar a imagem da assinatura");

      const path = buildFilePath(serviceOrderId, "assinatura.png");

      // Vai pra fila SEMPRE, mesmo online: assim o caminho de codigo e o
      // mesmo nos dois casos e a assinatura nunca se perde se cair no meio.
      await queueMutation({
        kind: "signature",
        serviceOrderId,
        payload: { storage_path: path, signer_name: name.trim() },
        blob,
      });

      if (navigator.onLine) {
        // syncNow esvazia a fila (inclusive o item recem-criado) e remove o
        // que subiu - por isso nao chamamos applyMutation direto aqui.
        const outcome = await syncNow();
        if (outcome.failed.length > 0) {
          throw new Error(outcome.failed[0].error);
        }
        notify({ title: "Assinatura salva", tone: "success" });
      } else {
        notify({
          title: "Assinatura guardada no celular",
          description: "Ela sobe sozinha quando a internet voltar.",
          tone: "info",
        });
      }
      setSavedAt(new Date().toISOString());
    } catch (error) {
      notifyError(error, "Não foi possível salvar a assinatura");
    } finally {
      setSaving(false);
    }
  }

  if (savedAt) {
    return (
      <section className="rounded-xl border border-success/30 bg-success/5 p-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-success">
          <PenLine className="h-4 w-4" /> Assinatura coletada
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {name || "Cliente"} ·{" "}
          {new Date(savedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-elev-1">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <PenLine className="h-4 w-4 text-brand" /> Assinatura do cliente
      </h2>

      <div className="space-y-1.5">
        <Label htmlFor="signer_name">Quem está assinando</Label>
        <Input
          id="signer_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome de quem recebeu o serviço"
        />
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        className="h-44 w-full touch-none rounded-lg border border-dashed border-border bg-white"
      />

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={clear} disabled={saving}>
          <Eraser className="h-4 w-4" /> Limpar
        </Button>
        <Button type="button" variant="brand" className="flex-1" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar assinatura"}
        </Button>
      </div>
    </section>
  );
}
