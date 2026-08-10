"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTechnicalProfile } from "./actions";

export type Definition = {
  id: string;
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "boolean" | "file";
  options: unknown[];
  is_required: boolean;
};

export function TechnicalProfilePanel({
  leadId,
  definitions,
  initialValues,
}: {
  leadId: string;
  definitions: Definition[];
  initialValues: Record<string, unknown>;
}) {
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setValue(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateTechnicalProfile(leadId, values);
        setMessage("Perfil tecnico atualizado");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar");
      }
    });
  }

  if (definitions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Perfil tecnico</CardTitle>
        <Button size="sm" onClick={submit} disabled={isPending}>
          <Save className="mr-2 h-3.5 w-3.5" />
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
        {definitions.map((definition) => (
          <div key={definition.id} className="space-y-1.5">
            <Label htmlFor={`technical-${definition.key}`}>{definition.label}{definition.is_required ? " *" : ""}</Label>
            <Field definition={definition} value={values[definition.key]} onChange={(value) => setValue(definition.key, value)} />
          </div>
        ))}
        {message && <p className="text-xs text-muted-foreground sm:col-span-2">{message}</p>}
      </CardContent>
    </Card>
  );
}

function Field({
  definition,
  value,
  onChange,
}: {
  definition: Definition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `technical-${definition.key}`;
  if (definition.field_type === "boolean") {
    return (
      <label htmlFor={id} className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
        <input id={id} type="checkbox" checked={value === true || value === "true"} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[hsl(var(--brand))]" />
        Sim
      </label>
    );
  }
  if (definition.field_type === "select") {
    return (
      <select id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Selecione</option>
        {definition.options.map((option) => {
          const text = typeof option === "string" ? option : String((option as { label?: unknown }).label ?? "");
          return <option key={text} value={text}>{text}</option>;
        })}
      </select>
    );
  }
  return (
    <Input
      id={id}
      type={definition.field_type === "number" ? "number" : definition.field_type === "date" ? "date" : definition.field_type === "file" ? "url" : "text"}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
