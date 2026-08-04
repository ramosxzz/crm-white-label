"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notifyError } from "@/lib/ui/feedback";
import { getCsvMappingSuggestion, importLeadsCSV } from "./actions";
import {
  heuristicCsvMapping,
  isReliableCsvMapping,
  type CsvFieldMapping,
} from "@/lib/leads/spreadsheet-mapping";
import { parseExcelBuffer, type SpreadsheetRow } from "@/lib/leads/spreadsheet-file";

type ParsedLead = { name: string; phone?: string; email?: string; source?: string };
type ReadingStage = "file" | "mapping" | null;

const SUPPORTED_EXTENSIONS = ["csv", "xls", "xlsx"];
const AI_CLIENT_TIMEOUT_MS = 7_000;

const FIELD_LABELS: Record<keyof CsvFieldMapping, string> = {
  name: "Nome",
  phone: "Telefone",
  email: "Email",
  source: "Origem",
};

function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: SpreadsheetRow[] }> {
  return parseExcelBuffer(await file.arrayBuffer());
}

function parseCsvFile(file: File): Promise<{ headers: string[]; rows: SpreadsheetRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<SpreadsheetRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: (parsed) => {
        const headers = parsed.meta.fields?.filter(Boolean) ?? [];
        if (headers.length === 0) {
          reject(new Error("O arquivo CSV nao possui cabecalhos."));
          return;
        }
        resolve({ headers, rows: parsed.data });
      },
      error: reject,
    });
  });
}

function getMappedLeads(rows: SpreadsheetRow[], mapping: CsvFieldMapping): ParsedLead[] {
  return rows
    .map((row) => ({
      name: (mapping.name ? row[mapping.name] : "")?.trim() ?? "",
      phone: (mapping.phone ? row[mapping.phone] : "")?.trim(),
      email: (mapping.email ? row[mapping.email] : "")?.trim(),
      source: (mapping.source ? row[mapping.source] : "")?.trim(),
    }))
    .filter((row) => row.name);
}

async function suggestMapping(headers: string[], sampleRows: SpreadsheetRow[]): Promise<CsvFieldMapping> {
  const localMapping = heuristicCsvMapping(headers);
  if (isReliableCsvMapping(localMapping)) return localMapping;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getCsvMappingSuggestion(headers, sampleRows.slice(0, 3)),
      new Promise<CsvFieldMapping>((resolve) => {
        timeout = setTimeout(() => resolve(localMapping), AI_CLIENT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function ImportCsvDialog({
  canAssign,
  members,
}: {
  canAssign: boolean;
  members: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [readingStage, setReadingStage] = useState<ReadingStage>(null);
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
    const extension = getExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      notifyError(new Error("Formato nao suportado. Use CSV, XLS ou XLSX."));
      return;
    }

    void (async () => {
      setReadingStage("file");
      try {
        const parsed = extension === "csv" ? await parseCsvFile(file) : await parseExcelFile(file);
        setReadingStage("mapping");
        const suggested = await suggestMapping(parsed.headers, parsed.rows);
        const parsedRows = getMappedLeads(parsed.rows, suggested);
        setMapping(suggested);
        setRows(parsedRows);

        if (!suggested.name) {
          notifyError(new Error("Nao foi possivel identificar a coluna de nome do lead."));
        } else if (parsedRows.length === 0) {
          notifyError(new Error("Nenhum lead preenchido foi encontrado na planilha."));
        }
      } catch (err) {
        notifyError(err, "Nao foi possivel ler a planilha.");
      } finally {
        setReadingStage(null);
      }
    })();
  }

  function onConfirm() {
    start(async () => {
      try {
        const { count, skippedDuplicates, invalidPhones } = await importLeadsCSV(
          rows,
          canAssign && assignedTo !== "auto" ? assignedTo : null,
        );
        const summary = [`${count} lead${count === 1 ? "" : "s"} importado${count === 1 ? "" : "s"}`];
        if (skippedDuplicates > 0) {
          summary.push(`${skippedDuplicates} duplicado${skippedDuplicates === 1 ? "" : "s"} ignorado${skippedDuplicates === 1 ? "" : "s"}`);
        }
        if (invalidPhones > 0) {
          summary.push(`${invalidPhones} sem telefone valido`);
        }
        setResult(summary.join(" · "));
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 3000);
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
          <Upload className="h-4 w-4" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar leads por planilha</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV, XLS ou XLSX. O sistema identifica nome, telefone, email e origem automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onPickFile}
            disabled={readingStage !== null || pending}
            className="block w-full text-sm"
          />

          {readingStage && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {readingStage === "mapping" ? (
                <Sparkles className="h-4 w-4 animate-pulse text-brand" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
              )}
              {readingStage === "mapping" ? "Identificando as colunas..." : "Lendo o arquivo..."}
            </p>
          )}

          {!readingStage && mapping && (
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
