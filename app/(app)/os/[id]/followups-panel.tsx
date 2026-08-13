"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { notifyError } from "@/lib/ui/feedback";
import type { FieldServiceUser } from "@/lib/field-service/users";
import { createServiceOrderFollowup, setServiceOrderFollowupStatus } from "../actions";

export type FollowupRow = {
  id: string;
  category: string;
  responsibleId: string | null;
  contactDate: string;
  description: string | null;
  status: "pendente" | "feito" | "cancelado";
};

function formatDate(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function FollowupsPanel({
  serviceOrderId,
  followups,
  consultants,
  canManage,
}: {
  serviceOrderId: string;
  followups: FollowupRow[];
  consultants: FieldServiceUser[];
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await createServiceOrderFollowup({
          service_order_id: serviceOrderId,
          category: String(fd.get("category") ?? ""),
          responsible_id: String(fd.get("responsible_id") ?? "") || null,
          contact_date: String(fd.get("contact_date") ?? ""),
          description: String(fd.get("description") ?? ""),
        });
        formRef.current?.reset();
        setShowForm(false);
      } catch (error) {
        notifyError(error, "Não foi possível criar o próximo contato");
      }
    });
  }

  function onStatus(id: string, status: "feito" | "cancelado") {
    start(async () => {
      try {
        await setServiceOrderFollowupStatus({ id, service_order_id: serviceOrderId, status });
      } catch (error) {
        notifyError(error, "Não foi possível atualizar");
      }
    });
  }

  const responsibleName = (id: string | null) => consultants.find((c) => c.id === id)?.name ?? null;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Próximo contato</h2>
        {canManage && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Novo
          </Button>
        )}
      </div>

      {showForm && (
        <form ref={formRef} onSubmit={onCreate} className="mb-4 space-y-2 rounded-lg border border-border/60 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="category">Categoria</Label>
            <Input id="category" name="category" placeholder='Ex: "Fez lavagem → oferecer impermeabilização"' required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="responsible_id">Responsável</Label>
              <select
                id="responsible_id"
                name="responsible_id"
                className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
              >
                <option value="">Sem responsável</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_date">Data</Label>
              <Input id="contact_date" name="contact_date" type="date" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" placeholder="Detalhe do que oferecer/combinar" />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Salvar
          </Button>
        </form>
      )}

      {followups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum próximo contato agendado.</p>
      ) : (
        <ul className="space-y-2">
          {followups.map((f) => (
            <li key={f.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{f.category}</p>
                  {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(f.contactDate)}
                    {responsibleName(f.responsibleId) ? ` · ${responsibleName(f.responsibleId)}` : ""}
                  </p>
                </div>
                <Badge variant={f.status === "feito" ? "success" : f.status === "cancelado" ? "outline" : "warning"}>
                  {f.status === "feito" ? "Feito" : f.status === "cancelado" ? "Cancelado" : "Pendente"}
                </Badge>
              </div>
              {canManage && f.status === "pendente" && (
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onStatus(f.id, "feito")}>
                    <Check className="h-3.5 w-3.5" /> Feito
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => onStatus(f.id, "cancelado")}>
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
