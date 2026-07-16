"use client";

import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  node: Node;
  onUpdate: (config: Record<string, unknown>) => void;
  onClose: () => void;
  quickMessages?: { id: string; title: string }[];
  pipelineOptions?: PipelineOption[];
};

type PipelineOption = {
  id: string;
  name: string;
  stages: { id: string; name: string; position: number | null }[];
};

export function NodeConfigPanel({
  node,
  onUpdate,
  onClose,
  quickMessages = [],
  pipelineOptions = [],
}: Props) {
  const kind = (node.data.kind as string) ?? node.type ?? "";
  const [config, setConfig] = useState<Record<string, unknown>>(
    (node.data.config as Record<string, unknown>) ?? {},
  );

  const stageOptions = useMemo(
    () =>
      pipelineOptions.flatMap((pipeline) =>
        [...pipeline.stages]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((stage) => ({ ...stage, pipelineId: pipeline.id, pipelineName: pipeline.name })),
      ),
    [pipelineOptions],
  );

  function resolveStageId(value: unknown) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const normalized = raw.toLowerCase();
    return (
      stageOptions.find((stage) => stage.id === raw || stage.name.toLowerCase() === normalized)?.id ?? raw
    );
  }

  function resolvePipelineId(value: unknown) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const normalized = raw.toLowerCase();
    return (
      pipelineOptions.find((pipeline) => pipeline.id === raw || pipeline.name.toLowerCase() === normalized)?.id ?? raw
    );
  }

  const selectedPipelineId = resolvePipelineId(config.pipeline_id);
  const selectedStageId = resolveStageId(config.stage_id);
  const stagesForSelectedPipeline =
    selectedPipelineId && pipelineOptions.some((pipeline) => pipeline.id === selectedPipelineId)
      ? stageOptions.filter((stage) => stage.pipelineId === selectedPipelineId)
      : stageOptions;

  useEffect(() => {
    setConfig((node.data.config as Record<string, unknown>) ?? {});
  }, [node.id, node.data.config]);

  function set(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    const next = { ...config };
    if (kind === "move_stage" || kind === "create_deal") {
      const stageId = resolveStageId(next.stage_id);
      if (stageId) next.stage_id = stageId;
    }
    if (kind === "create_deal") {
      const pipelineId = resolvePipelineId(next.pipeline_id);
      const selectedStage = stageOptions.find((stage) => stage.id === next.stage_id);
      if (pipelineId) next.pipeline_id = pipelineId;
      else if (selectedStage) next.pipeline_id = selectedStage.pipelineId;
    }
    onUpdate(next);
  }

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">{node.data.label as string}</p>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* create_lead */}
        {kind === "create_lead" && (
          <>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                placeholder="{name}"
                value={String(config.name ?? "")}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                placeholder="{phone}"
                value={String(config.phone ?? "")}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail (opcional)</Label>
              <Input
                placeholder="{email}"
                value={String(config.email ?? "")}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Input
                placeholder="automacao"
                value={String(config.source ?? "")}
                onChange={(e) => set("source", e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cria um novo lead no funil padrão. Deixe em branco para usar os dados do lead atual.
            </p>
          </>
        )}

        {/* create_deal */}
        {kind === "create_deal" && (
          <>
            <div className="space-y-1.5">
              <Label>Funil</Label>
              <Select
                value={selectedPipelineId || "auto"}
                onValueChange={(value) => {
                  if (value === "auto") {
                    setConfig((prev) => ({ ...prev, pipeline_id: undefined, stage_id: undefined }));
                    return;
                  }
                  const firstStage = stageOptions.find((stage) => stage.pipelineId === value);
                  setConfig((prev) => ({ ...prev, pipeline_id: value, stage_id: firstStage?.id }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o funil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detectar pelo lead</SelectItem>
                  {pipelineOptions.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select
                value={selectedStageId || "none"}
                onValueChange={(value) => {
                  const selectedStage = stageOptions.find((stage) => stage.id === value);
                  setConfig((prev) => ({
                    ...prev,
                    stage_id: value === "none" ? undefined : value,
                    pipeline_id: selectedStage?.pipelineId ?? prev.pipeline_id,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem etapa</SelectItem>
                  {stagesForSelectedPipeline.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.pipelineName} / {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor em centavos (opcional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={String(config.value_cents ?? "")}
                onChange={(e) => set("value_cents", Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Move o lead atual para o funil/etapa informados, criando o negócio.
            </p>
          </>
        )}

        {/* send_message */}
        {kind === "send_message" && (
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea
              rows={4}
              placeholder="Ola {name}! Seja bem-vindo..."
              value={String(config.message ?? "")}
              onChange={(e) => set("message", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Variaveis: <code>{"{name}"}</code>, <code>{"{phone}"}</code>, <code>{"{email}"}</code>
            </p>
          </div>
        )}

        {/* wait */}
        {kind === "wait" && (
          <div className="space-y-1.5">
            <Label>Aguardar (minutos)</Label>
            <Input
              type="number"
              min={1}
              placeholder="60"
              value={String(config.minutes ?? "")}
              onChange={(e) => set("minutes", Number(e.target.value))}
            />
          </div>
        )}

        {/* move_stage */}
        {kind === "move_stage" && (
          <div className="space-y-1.5">
            <Label>Etapa</Label>
            <Select
              value={selectedStageId || "none"}
              onValueChange={(value) => set("stage_id", value === "none" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha a etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione uma etapa</SelectItem>
                {stageOptions.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.pipelineName} / {stage.name}
                  </SelectItem>
                ))}
                {selectedStageId && !stageOptions.some((stage) => stage.id === selectedStageId) && (
                  <SelectItem value={selectedStageId}>Etapa atual nao encontrada</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Escolha pelo nome da etapa. O CRM salva o ID automaticamente.
            </p>
          </div>
        )}

        {/* assign_lead */}
        {kind === "assign_lead" && (
          <div className="space-y-1.5">
            <Label>ID do usuario</Label>
            <Input
              placeholder="uuid do usuario"
              value={String(config.user_id ?? "")}
              onChange={(e) => set("user_id", e.target.value)}
            />
          </div>
        )}

        {/* create_task */}
        {kind === "create_task" && (
          <>
            <div className="space-y-1.5">
              <Label>Titulo da tarefa</Label>
              <Input
                placeholder="Ligar para {name}"
                value={String(config.title ?? "")}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo em dias (0 = sem prazo)</Label>
              <Input
                type="number"
                min={0}
                placeholder="3"
                value={String(config.due_days ?? "")}
                onChange={(e) => set("due_days", Number(e.target.value))}
              />
            </div>
          </>
        )}

        {/* api4com_call */}
        {kind === "api4com_call" && (
          <>
            <div className="space-y-1.5">
              <Label>Ramal Api4com</Label>
              <Input
                placeholder="1000"
                value={String(config.extension ?? "")}
                onChange={(e) => set("extension", e.target.value.replace(/\D/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                O ramal precisa existir na Api4com e estar online no Webphone/extensao.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Observação da ligação</Label>
              <Input
                placeholder="Ligação iniciada por automação"
                value={String(config.note ?? "")}
                onChange={(e) => set("note", e.target.value)}
              />
            </div>
          </>
        )}

        {/* add_tag */}
        {kind === "add_tag" && (
          <div className="space-y-1.5">
            <Label>Tag</Label>
            <Input
              placeholder="nova-cliente"
              value={String(config.tag ?? "")}
              onChange={(e) => set("tag", e.target.value)}
            />
          </div>
        )}

        {/* log_activity */}
        {kind === "log_activity" && (
          <div className="space-y-1.5">
            <Label>Mensagem da atividade</Label>
            <Input
              placeholder="Automacao executada para {name}"
              value={String(config.message ?? "")}
              onChange={(e) => set("message", e.target.value)}
            />
          </div>
        )}

        {/* condition */}
        {kind === "condition" && (
          <>
            <div className="space-y-1.5">
              <Label>Campo do lead</Label>
              <Select
                value={String(config.field ?? "")}
                onValueChange={(v) => set("field", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="source">Origem</SelectItem>
                  <SelectItem value="stage_id">Etapa</SelectItem>
                  <SelectItem value="assigned_to">Responsavel</SelectItem>
                  <SelectItem value="tags">Tags</SelectItem>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Operador</Label>
              <Select
                value={String(config.operator ?? "eq")}
                onValueChange={(v) => set("operator", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">Igual a</SelectItem>
                  <SelectItem value="neq">Diferente de</SelectItem>
                  <SelectItem value="contains">Contem</SelectItem>
                  <SelectItem value="gt">Maior que</SelectItem>
                  <SelectItem value="lt">Menor que</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input
                placeholder="instagram"
                value={String(config.value ?? "")}
                onChange={(e) => set("value", e.target.value)}
              />
            </div>
          </>
        )}

        {/* randomizer */}
        {kind === "randomizer" && (
          <div className="space-y-1.5">
            <Label>Número de caminhos</Label>
            <Input
              type="number"
              min={2}
              max={5}
              placeholder="2"
              value={String(config.branches ?? "")}
              onChange={(e) => set("branches", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Distribui os leads aleatoriamente entre os caminhos (teste A/B).
            </p>
          </div>
        )}

        {/* api_call */}
        {kind === "api_call" && (
          <>
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select value={String(config.method ?? "POST")} onValueChange={(v) => set("method", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL do endpoint</Label>
              <Input
                placeholder="https://api.exemplo.com/webhook"
                value={String(config.url ?? "")}
                onChange={(e) => set("url", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Corpo (JSON)</Label>
              <Textarea
                rows={3}
                placeholder='{"name": "{name}", "phone": "{phone}"}'
                value={String(config.body ?? "")}
                onChange={(e) => set("body", e.target.value)}
              />
            </div>
          </>
        )}

        {/* field_ops */}
        {kind === "field_ops" && (
          <>
            <div className="space-y-1.5">
              <Label>Campo</Label>
              <Input
                placeholder="ex: score"
                value={String(config.field ?? "")}
                onChange={(e) => set("field", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Novo valor</Label>
              <Input
                placeholder="ex: 10"
                value={String(config.value ?? "")}
                onChange={(e) => set("value", e.target.value)}
              />
            </div>
          </>
        )}

        {/* ai */}
        {kind === "ai" && (
          <>
            <div className="space-y-1.5">
              <Label>Instrução para a IA</Label>
              <Textarea
                rows={4}
                placeholder="Classifique o interesse do lead com base na última mensagem e retorne uma tag."
                value={String(config.prompt ?? "")}
                onChange={(e) => set("prompt", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A IA recebe os dados do lead e processa segundo a instrução.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo (opcional)</Label>
              <Input
                placeholder="meta/llama-3.3-70b-instruct"
                value={String(config.model ?? "")}
                onChange={(e) => set("model", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar o modelo padrão configurado no servidor.
              </p>
            </div>
          </>
        )}

        {/* javascript */}
        {kind === "javascript" && (
          <div className="space-y-1.5">
            <Label>Código JavaScript</Label>
            <Textarea
              rows={5}
              className="font-mono text-xs"
              placeholder="// lead disponível como `lead`\nreturn lead.value > 1000;"
              value={String(config.code ?? "")}
              onChange={(e) => set("code", e.target.value)}
            />
          </div>
        )}

        {/* message_sent: filtro opcional por mensagem rapida */}
        {kind === "message_sent" && (
          <div className="space-y-1.5">
            <Label>Mensagem rápida (opcional)</Label>
            <Select
              value={String(config.quick_message_id ?? "any")}
              onValueChange={(v) => set("quick_message_id", v === "any" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer mensagem enviada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer mensagem enviada</SelectItem>
                {quickMessages.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se escolher uma mensagem rápida, o gatilho só dispara quando ela for usada para enviar.
            </p>
          </div>
        )}

        {/* Triggers: no config needed */}
        {node.type === "trigger" && kind !== "message_sent" && (
          <p className="text-xs text-muted-foreground italic">
            O gatilho e ativado automaticamente pelo CRM. Nenhuma configuracao necessaria.
          </p>
        )}

        {/* End */}
        {kind === "end" && (
          <p className="text-xs text-muted-foreground italic">
            Encerra o fluxo quando atingido.
          </p>
        )}
      </div>

      {(node.type !== "trigger" || kind === "message_sent") && kind !== "end" && (
        <Button size="sm" className="w-full" onClick={handleSave}>
          Aplicar
        </Button>
      )}
    </div>
  );
}
