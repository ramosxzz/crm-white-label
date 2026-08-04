"use client";

import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  filterBroadcastLeads,
  formatBroadcastPhone,
  hasContactName,
  latestImportTimestamp,
  type BroadcastLead,
  type BroadcastLeadPeriod,
} from "@/lib/disparos/broadcast-leads";

export function BroadcastLeadPicker({
  leads,
  selectedIds,
  onSelectionChange,
  onFire,
  pending,
  error,
}: {
  leads: BroadcastLead[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onFire: () => void;
  pending: boolean;
  error: string | null;
}) {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<BroadcastLeadPeriod>("latest_import");
  const [source, setSource] = useState("all");
  const latestImport = useMemo(() => latestImportTimestamp(leads), [leads]);
  const sources = useMemo(
    () => [...new Set(leads.map((lead) => lead.source).filter((value): value is string => Boolean(value)))].sort(),
    [leads],
  );
  const filteredLeads = useMemo(
    () => filterBroadcastLeads(leads, { search, period, source, latestImport }),
    [leads, latestImport, period, search, source],
  );

  function toggleLead(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function selectVisible() {
    const next = new Set(selectedIds);
    for (const lead of filteredLeads) next.add(lead.id);
    onSelectionChange(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Leads ({filteredLeads.length}
          {filteredLeads.length !== leads.length ? ` de ${leads.length}` : ""})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_190px_220px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, telefone ou origem..."
          />
          <Select value={period} onValueChange={(value) => setPeriod(value as BroadcastLeadPeriod)}>
            <SelectTrigger aria-label="Filtrar leads por periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest_import">Ultima importacao</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="all">Todos os periodos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger aria-label="Filtrar leads por origem">
              <SelectValue placeholder="Todas as origens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              {sources.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={selectVisible}>
            Selecionar visiveis
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onSelectionChange(new Set())}>
            Limpar selecao
          </Button>
          <Button type="button" size="sm" onClick={onFire} disabled={pending} className="ml-auto">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Disparar selecionados
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-lg border border-border/70">
          {filteredLeads.map((lead) => {
            const named = hasContactName(lead);
            return (
              <label
                key={lead.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2.5 text-sm last:border-b-0 hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-brand"
                  checked={selectedIds.has(lead.id)}
                  onChange={() => toggleLead(lead.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{named ? lead.name : "Contato sem nome"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatBroadcastPhone(lead.phone)}
                    {lead.source ? ` · ${lead.source}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
          {filteredLeads.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {selectedIds.size} lead{selectedIds.size === 1 ? "" : "s"} selecionado{selectedIds.size === 1 ? "" : "s"} para envio
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
