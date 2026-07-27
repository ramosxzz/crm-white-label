"use client";

import { notify, confirmDialog } from "@/lib/ui/feedback";
import { useState, useTransition } from "react";
import { Paperclip, Trash2, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FileRow } from "@/lib/supabase/database.types";
import {
  getTenantStoragePath,
  persistLeadFile,
  deleteLeadFile,
  getSignedFileUrl,
} from "./file-actions";

export function LeadFilesPanel({ leadId, files }: { leadId: string; files: FileRow[] }) {
  const [pending, start] = useTransition();
  const [list, setList] = useState(files);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    start(async () => {
      const supabase = createClient();
      const prefix = await getTenantStoragePath(leadId);
      const path = `${prefix}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage
        .from("lead-files")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) {
        notify({ title: error.message, tone: "error" });
        return;
      }
      const row = await persistLeadFile({
        leadId,
        name: file.name,
        storagePath: path,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      setList((prev) => [row, ...prev]);
      e.target.value = "";
    });
  }

  async function onDelete(file: FileRow) {
    if (!(await confirmDialog({ title: "Excluir arquivo?", tone: "danger", confirmLabel: "Excluir" }))) return;
    start(async () => {
      await deleteLeadFile(file.id, file.storage_path);
      setList((prev) => prev.filter((f) => f.id !== file.id));
    });
  }

  async function onDownload(file: FileRow) {
    const url = await getSignedFileUrl(file.storage_path);
    if (url) window.open(url, "_blank");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Arquivos</CardTitle>
        <label>
          <input type="file" className="hidden" onChange={onUpload} disabled={pending} />
          <Button asChild variant="outline" size="sm">
            <span>
              <Paperclip className="h-4 w-4" />
              {pending ? "Enviando..." : "Anexar"}
            </span>
          </Button>
        </label>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                <span className="truncate">{f.name}</span>
                <span className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onDownload(f)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(f)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
