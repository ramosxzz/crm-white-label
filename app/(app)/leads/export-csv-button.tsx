"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify, notifyError } from "@/lib/ui/feedback";
import { exportLeadsCSV } from "./actions";

/**
 * Exporta exatamente o que a tela esta mostrando - le os mesmos filtros da
 * URL que a query da tabela usa, em vez de receber uma copia por prop (que
 * ficava desatualizada toda vez que um filtro novo era adicionado aqui sem
 * lembrar de repassar pra exportacao - foi o que causou o bug de tag
 * ignorada na exportacao antes).
 */
export function ExportCsvButton({ startIso, endIso }: { startIso: string | null; endIso: string | null }) {
  const searchParams = useSearchParams();
  const [exporting, startExport] = useTransition();

  function onExport() {
    const stageIds = searchParams.getAll("etapa");
    const sources = searchParams.getAll("origem");
    const tag = searchParams.get("tag");
    const q = searchParams.get("q");
    const assignedTo = searchParams.get("responsavel");
    const qualificacao = searchParams.get("qualificacao");
    const minStars = qualificacao === "5" ? 5 : qualificacao === "4" ? 4 : qualificacao === "rated" ? 1 : undefined;

    startExport(async () => {
      try {
        const { csv, count } = await exportLeadsCSV({
          stageIds,
          startIso,
          endIso,
          tag,
          q,
          sources,
          assignedTo,
          minStars,
        });

        if (count === 0) {
          notify({ title: "Nenhum lead para exportar", description: "Ajuste os filtros e tente de novo.", tone: "info" });
          return;
        }

        // BOM na frente: sem ele o Excel abre acento como "JoÃ£o".
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const suffix = stageIds.length > 0 ? `-${stageIds.length}-etapas` : "";
        link.href = url;
        link.download = `leads${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        notify({ title: `${count} lead(s) exportado(s)`, tone: "success" });
      } catch (err) {
        notifyError(err, "Não foi possível exportar");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={onExport} disabled={exporting}>
      <Download className="h-4 w-4" />
      {exporting ? "Exportando..." : "Exportar CSV"}
    </Button>
  );
}
