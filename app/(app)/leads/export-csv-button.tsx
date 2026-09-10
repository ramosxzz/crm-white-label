"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notify, notifyError } from "@/lib/ui/feedback";
import { exportLeadsCSV } from "./actions";

type StageInfo = { id: string; name: string; color: string | null };

/**
 * Filtro por etapa e exportacao do que esta filtrado. Os dois andam juntos de
 * proposito: o pedido foi "exportar os leads apenas de passei valores, primeiro
 * contato" - ou seja, a selecao de etapa e o recorte da exportacao. O arquivo
 * sai com o mesmo conteudo que a tela esta mostrando, sem segunda escolha.
 */
export function StageFilterExport({
  stages,
  selectedStageIds,
  startIso,
  endIso,
}: {
  stages: StageInfo[];
  selectedStageIds: string[];
  startIso: string | null;
  endIso: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exporting, startExport] = useTransition();
  // Sem isso o clique parecia travar/recarregar a pagina: router.push troca
  // os searchParams e o server component refaz a busca, mas a UI ficava
  // parada sem feedback nenhum ate a resposta voltar. Com startTransition o
  // React mantem os botoes clicaveis e navPending da pra mostrar que esta
  // carregando.
  const [navPending, startNav] = useTransition();
  const selected = new Set(selectedStageIds);

  function applyStages(next: Set<string>) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.delete("etapa");
    for (const id of next) qs.append("etapa", id);
    qs.delete("page"); // filtro novo volta pra primeira pagina
    startNav(() => {
      router.push(qs.toString() ? `/leads?${qs}` : "/leads");
    });
  }

  function toggleStage(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    applyStages(next);
  }

  function onExport() {
    startExport(async () => {
      try {
        const { csv, count } = await exportLeadsCSV({
          stageIds: [...selected],
          startIso,
          endIso,
        });

        if (count === 0) {
          notify({ title: "Nenhum lead para exportar", description: "Ajuste os filtros e tente de novo.", tone: "info" });
          return;
        }

        // BOM na frente: sem ele o Excel abre acento como "JoÃ£o".
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const suffix = selected.size > 0 ? `-${selected.size}-etapas` : "";
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
    <div className={cn("flex flex-col gap-3 border-t border-border/70 pt-3 transition-opacity lg:flex-row lg:items-center lg:justify-between", navPending && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Layers className="h-4 w-4" />
          Etapa
        </div>
        <Button
          size="sm"
          variant={selected.size === 0 ? "brand" : "outline"}
          onClick={() => applyStages(new Set())}
        >
          Todas
        </Button>
        {stages.map((stage) => {
          const active = selected.has(stage.id);
          return (
            <Button
              key={stage.id}
              size="sm"
              variant={active ? "brand" : "outline"}
              onClick={() => toggleStage(stage.id)}
              className={cn(!active && "text-muted-foreground")}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: stage.color ?? undefined }}
              />
              {stage.name}
            </Button>
          );
        })}
      </div>

      <Button size="sm" variant="secondary" onClick={onExport} disabled={exporting}>
        <Download className="h-4 w-4" />
        {exporting ? "Exportando..." : "Exportar CSV"}
      </Button>
    </div>
  );
}
