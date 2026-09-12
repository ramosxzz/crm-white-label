"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Layers, User, Megaphone, Tag as TagIcon, CalendarDays, SlidersHorizontal, X, Star, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FilterDropdown, type FilterOption } from "./filter-dropdown";

export type StageOption = { id: string; name: string; color: string | null };
export type MemberOption = { id: string; name: string };
export type TagOption = { tag: string; count: number };

const QUALITY_OPTIONS: FilterOption[] = [
  { value: "rated", label: "Avaliados (qualquer nota)" },
  { value: "4", label: "4+ estrelas" },
  { value: "5", label: "5 estrelas" },
];

const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "valor_desc", label: "Maior valor" },
  { value: "valor_asc", label: "Menor valor" },
  { value: "qualificacao", label: "Melhor qualificação" },
];

const PERIOD_OPTIONS: FilterOption[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "all", label: "Todos" },
];

/** Etapas mais usadas como atalho de 1 clique - o resto fica dentro de "Etapa". */
const QUICK_STAGE_LIMIT = 3;

export function LeadsFilters({
  stages,
  members,
  sources,
  tags,
  canAssign,
  showLocationFilter,
}: {
  stages: StageOption[];
  members: MemberOption[];
  sources: string[];
  tags: TagOption[];
  canAssign: boolean;
  showLocationFilter: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startNav] = useTransition();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  const [locationValue, setLocationValue] = useState(searchParams.get("localizacao") ?? "");

  const stageIds = searchParams.getAll("etapa");
  const sourceValues = searchParams.getAll("origem");
  const tagValue = searchParams.get("tag");
  const responsavel = searchParams.get("responsavel");
  const qualificacao = searchParams.get("qualificacao");
  const entrada = searchParams.get("entrada") ?? "all";
  const dia = searchParams.get("dia") ?? "";
  const sort = searchParams.get("ordenar") ?? "recentes";

  // Busca com debounce: digitar nao pode disparar uma navegacao por letra -
  // sem isso o server component reconsulta o banco a cada tecla.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (searchValue === current) return;
    const timer = setTimeout(() => {
      const qs = new URLSearchParams(searchParams.toString());
      if (searchValue.trim()) qs.set("q", searchValue.trim());
      else qs.delete("q");
      qs.delete("page");
      startNav(() => router.push(qs.toString() ? `/leads?${qs}` : "/leads"));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  useEffect(() => {
    if (!showLocationFilter) return;
    const current = searchParams.get("localizacao") ?? "";
    if (locationValue === current) return;
    const timer = setTimeout(() => {
      const qs = new URLSearchParams(searchParams.toString());
      if (locationValue.trim()) qs.set("localizacao", locationValue.trim());
      else qs.delete("localizacao");
      qs.delete("page");
      startNav(() => router.push(qs.toString() ? `/leads?${qs}` : "/leads"));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationValue, showLocationFilter]);

  function navigate(mutate: (qs: URLSearchParams) => void) {
    const qs = new URLSearchParams(searchParams.toString());
    mutate(qs);
    qs.delete("page");
    startNav(() => router.push(qs.toString() ? `/leads?${qs}` : "/leads"));
  }

  function toggleMulti(param: string, value: string) {
    navigate((qs) => {
      const current = qs.getAll(param);
      qs.delete(param);
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      for (const v of next) qs.append(param, v);
    });
  }

  function setSingle(param: string, value: string | null) {
    navigate((qs) => {
      if (value) qs.set(param, value);
      else qs.delete(param);
    });
  }

  function setQuickStage(stageId: string | null) {
    navigate((qs) => {
      qs.delete("etapa");
      if (stageId) qs.append("etapa", stageId);
    });
  }

  function clearAll() {
    startNav(() => router.push("/leads"));
    setSearchValue("");
    setLocationValue("");
  }

  const quickStages = stages.slice(0, QUICK_STAGE_LIMIT);
  const isAllStages = stageIds.length === 0;

  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];
  for (const id of stageIds) {
    const stage = stages.find((s) => s.id === id);
    if (stage) activeFilters.push({ key: `etapa-${id}`, label: `Etapa: ${stage.name}`, onRemove: () => toggleMulti("etapa", id) });
  }
  if (responsavel) {
    const label = responsavel === "unassigned" ? "Sem responsável" : members.find((m) => m.id === responsavel)?.name ?? "Responsável";
    activeFilters.push({ key: "responsavel", label: `Responsável: ${label}`, onRemove: () => setSingle("responsavel", null) });
  }
  for (const source of sourceValues) {
    activeFilters.push({ key: `origem-${source}`, label: `Origem: ${source}`, onRemove: () => toggleMulti("origem", source) });
  }
  if (tagValue) {
    activeFilters.push({ key: "tag", label: `Tag: ${tagValue}`, onRemove: () => setSingle("tag", null) });
  }
  if (entrada !== "all") {
    const label = entrada === "custom" && dia ? `Dia: ${dia.split("-").reverse().join("/")}` : PERIOD_OPTIONS.find((o) => o.value === entrada)?.label;
    if (label) activeFilters.push({ key: "entrada", label: `Período: ${label}`, onRemove: () => navigate((qs) => { qs.delete("entrada"); qs.delete("dia"); }) });
  }
  if (qualificacao) {
    const label = QUALITY_OPTIONS.find((o) => o.value === qualificacao)?.label ?? qualificacao;
    activeFilters.push({ key: "qualificacao", label: `Qualificação: ${label}`, onRemove: () => setSingle("qualificacao", null) });
  }
  if (showLocationFilter && locationValue.trim()) {
    activeFilters.push({
      key: "localizacao",
      label: `Localização: ${locationValue}`,
      onRemove: () => setLocationValue(""),
    });
  }

  return (
    <div className={cn("space-y-3 transition-opacity", pending && "opacity-70")}>
      <div className={cn("grid gap-2", showLocationFilter && "md:grid-cols-2")}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="h-11 pl-9 text-sm"
          />
        </div>
        {showLocationFilter && (
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              placeholder="Buscar por endereço ou cidade..."
              className="h-11 pl-9 text-sm"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={isAllStages ? "brand" : "outline"} onClick={() => setQuickStage(null)}>
            Todos
          </Button>
          {quickStages.map((stage) => (
            <Button
              key={stage.id}
              size="sm"
              variant={stageIds.length === 1 && stageIds[0] === stage.id ? "brand" : "outline"}
              onClick={() => setQuickStage(stage.id)}
              className={cn(!(stageIds.length === 1 && stageIds[0] === stage.id) && "text-muted-foreground")}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color ?? undefined }} />
              {stage.name}
            </Button>
          ))}
        </div>

        <Select value={sort} onValueChange={(v) => setSingle("ordenar", v === "recentes" ? null : v)}>
          <SelectTrigger className="h-9 w-[13rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                Ordenar: {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Etapa"
          icon={Layers}
          options={stages.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
          selected={stageIds}
          onToggle={(v) => toggleMulti("etapa", v)}
        />
        {canAssign && (
          <FilterDropdown
            label="Responsável"
            icon={User}
            multi={false}
            options={[{ value: "unassigned", label: "Sem responsável" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
            selected={responsavel ? [responsavel] : []}
            onToggle={(v) => setSingle("responsavel", responsavel === v ? null : v)}
          />
        )}
        <FilterDropdown
          label="Origem"
          icon={Megaphone}
          options={sources.map((s) => ({ value: s, label: s }))}
          selected={sourceValues}
          onToggle={(v) => toggleMulti("origem", v)}
        />
        {tags.length > 0 && (
          <FilterDropdown
            label="Tags"
            icon={TagIcon}
            multi={false}
            options={tags.map((t) => ({ value: t.tag, label: t.tag, count: t.count }))}
            selected={tagValue ? [tagValue] : []}
            onToggle={(v) => setSingle("tag", tagValue === v ? null : v)}
          />
        )}
        <FilterDropdown
          label="Período"
          icon={CalendarDays}
          multi={false}
          options={PERIOD_OPTIONS}
          selected={entrada !== "all" && entrada !== "custom" ? [entrada] : []}
          onToggle={(v) => navigate((qs) => { qs.set("entrada", v); qs.delete("dia"); })}
        />

        <div className="relative">
          <Button size="sm" variant={moreOpen || qualificacao || entrada === "custom" ? "outline" : "ghost"} onClick={() => setMoreOpen((v) => !v)} className={cn((qualificacao || entrada === "custom") && "border-brand/50 text-brand")}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Mais filtros
          </Button>
          {moreOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-72 space-y-3 rounded-lg border border-border/70 bg-popover p-3 shadow-elev-3">
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Star className="h-3.5 w-3.5" /> Qualificação</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUALITY_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSingle("qualificacao", qualificacao === o.value ? null : o.value)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                        qualificacao === o.value ? "border-brand/50 bg-brand/10 text-brand" : "border-border/70 text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 border-t border-border/60 pt-3">
                <label htmlFor="leads-custom-day" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> Dia específico
                </label>
                <Input
                  id="leads-custom-day"
                  type="date"
                  defaultValue={entrada === "custom" ? dia : ""}
                  className="h-8 text-sm"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) return;
                    navigate((qs) => { qs.set("entrada", "custom"); qs.set("dia", value); });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <span className="text-xs font-medium text-muted-foreground">Filtros ativos:</span>
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={f.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {f.label} <X className="h-3 w-3" />
            </button>
          ))}
          <button type="button" onClick={clearAll} className="ml-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Limpar todos
          </button>
        </div>
      )}
    </div>
  );
}
