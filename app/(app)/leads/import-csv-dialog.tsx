"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notifyError } from "@/lib/ui/feedback";
import { getCsvMappingSuggestion, importLeadsCSV } from "./actions";
import type { CsvFieldMapping } from "@/lib/ai/csv-mapping";

type ParsedLead = { name: string; phone?: string; email?: string; source?: string };

const FIELD_LABELS: Record<keyof CsvFieldMapping, string> = {
  name: "Nome",
  phone: "Telefone",
  email: "Email",
  source: "Origem",
};

export function ImportCsvDialog({
  canAssign,
  members,
}: {
  canAssign: boolean;
  members: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const [mapping, setMapping] = useState<CsvFieldMapping | null>(null);
  const [rows, setRows] = useState<ParsedLead[]>([]);
  const [assignedTo, setAssignedTo] = useState("auto");

  function reset() {
    setMapping(null);
    setRows([]);
    setAssignedTo("auto");
    setResult(null);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setReading(true);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          const headers = parsed.meta.fields ?? [];
          const suggested = await getCsvMappingSuggestion(headers, parsed.data.slice(0, 3));
          const parsedRows = parsed.data
            .map((r) => ({
              name: (suggested.name ? r[suggested.name] : "")?.trim() ?? "",
              phone: (suggested.phone ? r[suggested.phone] : "")?.trim(),
              email: (suggested.email ? r[suggested.email] : "")?.trim(),
              source: (suggested.source ? r[suggested.source] : "")?.trim(),
            }))
            .filter((r) => r.name);
          setMapping(suggested);
          setRows(parsedRows);
        } catch (err) {
          notifyError(err);
        } finally {
          setReading(false);
        }
      },
      error: (err) => {
        setReading(false);
        notifyError(err);
      },
    });
  }

  function onConfirm() {
    start(async () => {
      try {
        const { count } = await importLeadsCSV(rows, canAssign && assignedTo !== "auto" ? assignedTo : null);
        setResult(`${count} leads importados`);
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 1200);
      } catch (err) {
        notifyError(err);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar leads (CSV)</DialogTitle>
          <DialogDescription>
            Envie a planilha com qualquer cabeçalho — a IA identifica nome, telefone, email e origem sozinha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onPickFile}
            disabled={reading || pending}
            className="block w-full text-sm"
          />

          {reading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-brand" /> Lendo a planilha com IA...
            </p>
          )}

          {!reading && mapping && (
            <div className="space-y-3 rounded-lg border border-border/70 p-3">
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(FIELD_LABELS) as (keyof CsvFieldMapping)[]).map((field) => (
                  <span
                    key={field}
                    className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground"
                  >
                    {FIELD_LABELS[field]}: {mapping[field] ?? <em className="not-italic opacity-60">não encontrado</em>}
                  </span>
                ))}
              </div>

              <div className="max-h-56 overflow-y-auto rounded-md border border-border/60">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-left uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-1.5 font-medium">Nome</th>
                      <th className="px-2.5 py-1.5 font-medium">Telefone</th>
                      <th className="px-2.5 py-1.5 font-medium">Email</th>
                      <th className="px-2.5 py-1.5 font-medium">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td className="px-2.5 py-1.5">{r.name}</td>
                        <td className="px-2.5 py-1.5 text-muted-foreground">{r.phone || "—"}</td>
                        <td className="px-2.5 py-1.5 text-muted-foreground">{r.email || "—"}</td>
                        <td className="px-2.5 py-1.5 text-muted-foreground">{r.source || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {rows.length} lead{rows.length === 1 ? "" : "s"} pronto{rows.length === 1 ? "" : "s"} pra importar
                {rows.length > 8 ? ` (mostrando os 8 primeiros)` : ""}.
              </p>

              {canAssign && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Enviar para</label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Distribuir automaticamente</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {result && <p className="text-sm text-brand">{result}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="brand" disabled={!mapping || rows.length === 0 || pending} onClick={onConfirm}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
