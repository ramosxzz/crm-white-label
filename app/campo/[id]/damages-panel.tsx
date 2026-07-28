"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { queueMutation } from "@/lib/field-service/offline";
import { shrinkImage } from "@/lib/field-service/image";
import { notify, notifyError } from "@/lib/ui/feedback";
import { buildFilePath, syncNow } from "../sync";

type Damage = { id: string; description: string; created_at: string };

/**
 * Avarias do estofado na chegada. E o "recebido" que eles preenchem no papel
 * hoje: protege a empresa quando o cliente reclama de um dano que ja existia.
 */
export function DamagesPanel({
  serviceOrderId,
  damages,
  readOnly,
}: {
  serviceOrderId: string;
  damages: Damage[];
  readOnly: boolean;
}) {
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [localDamages, setLocalDamages] = useState<Damage[]>(damages);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function add() {
    if (!description.trim()) {
      notify({ title: "Descreva a avaria", tone: "error" });
      return;
    }

    setSaving(true);
    try {
      let photoPath: string | null = null;
      let blob: Blob | undefined;

      if (photo) {
        blob = await shrinkImage(photo);
        photoPath = buildFilePath(serviceOrderId, photo.name || "avaria.jpg");
      }

      await queueMutation({
        kind: "damage",
        serviceOrderId,
        payload: { description: description.trim(), photo_path: photoPath },
        blob,
      });

      if (navigator.onLine) {
        const outcome = await syncNow();
        if (outcome.failed.length > 0) throw new Error(outcome.failed[0].error);
        notify({ title: "Avaria registrada", tone: "success" });
        router.refresh();
      } else {
        notify({
          title: "Avaria guardada no celular",
          description: "Sobe sozinha quando a internet voltar.",
          tone: "info",
        });
        setLocalDamages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), description: description.trim(), created_at: new Date().toISOString() },
        ]);
      }

      setDescription("");
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      notifyError(error, "Não foi possível registrar a avaria");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-elev-1">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert className="h-4 w-4 text-warning" /> Avarias no estofado
      </h2>

      {localDamages.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma avaria registrada.</p>
      ) : (
        <ul className="space-y-2">
          {localDamages.map((damage) => (
            <li key={damage.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              {damage.description}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="damage_description">Nova avaria</Label>
            <Textarea
              id="damage_description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: rasgo no braço direito, mancha no encosto"
            />
          </div>

          <input
            ref={fileRef}
            id="damage_photo"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {photo ? "Foto anexada" : "Tirar foto"}
            </Button>
            <Button type="button" variant="brand" className="flex-1" disabled={saving} onClick={add}>
              {saving ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
