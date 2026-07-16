"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, Zap, Play, Pause, History, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TriggerNode, ActionNode, ConditionNode, WaitNode, EndNode, AVAILABLE_SUB_ACTIONS, AVAILABLE_TRIGGERS } from "./node-types";
import { BlockPanel } from "./block-panel";
import { NodeConfigPanel } from "./node-config-panel";
import { saveFlowVersion, saveFlowDraft, updateFlowStatus } from "@/app/(app)/automations/actions";

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode,
  end: EndNode,
};

type FlowBlock = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label?: string; kind?: string; config?: Record<string, unknown> };
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
};

type PipelineOption = {
  id: string;
  name: string;
  stages: { id: string; name: string; position: number | null }[];
};

function toReactFlowNodes(blocks: FlowBlock[]): Node[] {
  return blocks.map((b) => ({
    id: b.id,
    type: b.type,
    position: b.position,
    data: b.data,
  }));
}

function edgeLabel(handle?: string | null): string | undefined {
  if (handle === "yes") return "Sim";
  if (handle === "no") return "Não";
  return undefined;
}

function edgeColor(handle?: string | null): string {
  if (handle === "yes") return "#10b981";
  if (handle === "no") return "#f87171";
  return "hsl(var(--brand))";
}

function toReactFlowEdges(connections: FlowEdge[]): Edge[] {
  return connections.map((c) => ({
    id: c.id,
    source: c.source,
    target: c.target,
    sourceHandle: c.sourceHandle ?? null,
    type: "smoothstep",
    animated: true,
    label: edgeLabel(c.sourceHandle),
    labelStyle: { fontSize: 10, fontWeight: 600, fill: edgeColor(c.sourceHandle) },
    labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
    style: { stroke: edgeColor(c.sourceHandle), strokeWidth: 2 },
  }));
}

export function FlowEditor({
  flowId,
  flowName,
  flowStatus,
  initialBlocks,
  initialConnections,
  quickMessages,
  pipelineOptions,
}: {
  flowId: string;
  flowName: string;
  flowStatus: string;
  initialBlocks: FlowBlock[];
  initialConnections: FlowEdge[];
  quickMessages: { id: string; title: string }[];
  pipelineOptions: PipelineOption[];
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toReactFlowNodes(initialBlocks));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toReactFlowEdges(initialConnections));
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");

  // O bloco "Inicio" acumula gatilhos (semantica OU); o bloco "Acao" acumula
  // sub-acoes executadas em sequencia. Ambos sao editados por dentro do
  // proprio no no canvas, entao injetamos os callbacks via `data` apenas na
  // copia usada para renderizar (o estado `nodes` fica limpo para salvar).
  function patchNodeConfig(nodeId: string, updater: (config: Record<string, unknown>) => Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config: updater((n.data.config as Record<string, unknown>) ?? {}) } } : n)),
    );
  }

  function addSubTrigger(nodeId: string, triggerId: string, kind: string) {
    patchNodeConfig(nodeId, (config) => {
      const triggers = Array.isArray(config.triggers) ? (config.triggers as unknown[]) : [];
      return { ...config, triggers: [...triggers, { id: triggerId, kind, config: {} }] };
    });
  }

  function removeSubTrigger(nodeId: string, triggerId: string) {
    patchNodeConfig(nodeId, (config) => {
      const triggers = Array.isArray(config.triggers) ? (config.triggers as { id: string }[]) : [];
      return { ...config, triggers: triggers.filter((t) => t.id !== triggerId) };
    });
    if (selectedSubId === triggerId) setSelectedSubId(null);
  }

  function updateSubTriggerConfig(nodeId: string, triggerId: string, config: Record<string, unknown>) {
    patchNodeConfig(nodeId, (nodeConfig) => {
      const triggers = Array.isArray(nodeConfig.triggers) ? (nodeConfig.triggers as { id: string; kind: string; config?: Record<string, unknown> }[]) : [];
      return { ...nodeConfig, triggers: triggers.map((t) => (t.id === triggerId ? { ...t, config } : t)) };
    });
  }

  function addSubAction(nodeId: string, actionId: string, kind: string) {
    patchNodeConfig(nodeId, (config) => {
      const actions = Array.isArray(config.actions) ? (config.actions as unknown[]) : [];
      return { ...config, actions: [...actions, { id: actionId, kind, config: {} }] };
    });
  }

  function removeSubAction(nodeId: string, actionId: string) {
    patchNodeConfig(nodeId, (config) => {
      const actions = Array.isArray(config.actions) ? (config.actions as { id: string }[]) : [];
      return { ...config, actions: actions.filter((a) => a.id !== actionId) };
    });
    if (selectedSubId === actionId) setSelectedSubId(null);
  }

  function updateSubActionConfig(nodeId: string, actionId: string, config: Record<string, unknown>) {
    patchNodeConfig(nodeId, (nodeConfig) => {
      const actions = Array.isArray(nodeConfig.actions) ? (nodeConfig.actions as { id: string; kind: string; config?: Record<string, unknown> }[]) : [];
      return { ...nodeConfig, actions: actions.map((a) => (a.id === actionId ? { ...a, config } : a)) };
    });
  }

  const nodesForRender = useMemo(
    () =>
      nodes.map((n) => {
        if (n.type === "trigger") {
          return {
            ...n,
            data: {
              ...n.data,
              onAddTrigger: (triggerId: string, kind: string) => addSubTrigger(n.id, triggerId, kind),
              onRemoveTrigger: (triggerId: string) => removeSubTrigger(n.id, triggerId),
              onSelectSubTrigger: (triggerId: string) => setSelectedSubId(triggerId),
              selectedSubId: selectedNode?.id === n.id ? selectedSubId : null,
            },
          };
        }
        if (n.type === "action" && n.data.kind === "action_group") {
          return {
            ...n,
            data: {
              ...n.data,
              onAddAction: (actionId: string, kind: string) => addSubAction(n.id, actionId, kind),
              onRemoveAction: (actionId: string) => removeSubAction(n.id, actionId),
              onSelectSubAction: (actionId: string) => setSelectedSubId(actionId),
              selectedSubId: selectedNode?.id === n.id ? selectedSubId : null,
            },
          };
        }
        return n;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, selectedNode, selectedSubId],
  );

  function buildConfig() {
    return {
      blocks: nodes.map((n) => ({
        id: n.id,
        type: n.type ?? "action",
        position: n.position,
        data: n.data,
      })),
      connections: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
      })),
    };
  }

  // Autosave: persiste o rascunho no banco do tenant sempre que o fluxo muda,
  // para nunca perder o trabalho ao atualizar a pagina. Debounce de 1.2s.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setAutosaveState("saving");
    const config = buildConfig();
    const timer = setTimeout(() => {
      void saveFlowDraft(flowId, config)
        .then((res) => setAutosaveState(res.ok ? "saved" : "idle"))
        .catch(() => setAutosaveState("idle"));
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, flowId]);

  // Avisa se houver mudanca ainda nao persistida ao tentar sair da pagina.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (autosaveState === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [autosaveState]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            label: edgeLabel(params.sourceHandle),
            labelStyle: { fontSize: 10, fontWeight: 600, fill: edgeColor(params.sourceHandle) },
            labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
            labelBgPadding: [4, 2] as [number, number],
            labelBgBorderRadius: 4,
            style: { stroke: edgeColor(params.sourceHandle), strokeWidth: 2 },
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode((prev) => {
      if (!prev || prev.id !== node.id) setSelectedSubId(null);
      return node;
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedSubId(null);
  }, []);

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode((prev) => (prev?.id === nodeId ? null : prev));
      setSelectedSubId(null);
    },
    [setEdges, setNodes],
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      const deletedIds = new Set(deletedNodes.map((node) => node.id));
      setEdges((eds) => eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)));
      setSelectedNode((prev) => (prev && deletedIds.has(prev.id) ? null : prev));
      setSelectedSubId(null);
    },
    [setEdges],
  );

  function addBlock(type: string, kind: string, label: string) {
    const id = `${type}_${Date.now()}`;
    // Distribui os novos blocos em diagonal suave para evitar sobreposição
    const offset = nodes.length;
    const x = 320 + (offset % 3) * 60;
    const y = 120 + offset * 90;
    const initialConfig =
      kind === "trigger_group" ? { triggers: [] } : kind === "action_group" ? { actions: [] } : {};
    setNodes((nds) => [
      ...nds,
      {
        id,
        type,
        position: { x, y },
        data: { label, kind, config: initialConfig, stats: {} },
      },
    ]);
  }

  function updateNodeConfig(nodeId: string, config: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, config } } : n,
      ),
    );
    setSelectedNode((prev) =>
      prev?.id === nodeId ? { ...prev, data: { ...prev.data, config } } : prev,
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await saveFlowVersion(flowId, buildConfig());
    if (!result.ok) setSaveError(result.error ?? "Nao foi possivel salvar.");
    setSaving(false);
  }

  async function toggleStatus() {
    const next = flowStatus === "active" ? "paused" : "active";
    await updateFlowStatus(flowId, next);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Block palette */}
      <BlockPanel onAddBlock={addBlock} />

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodesForRender}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={["Delete", "Backspace"]}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} className="opacity-40" />
          <Controls className="!rounded-xl !border !border-border !bg-card !shadow-lg [&>button]:!border-border [&>button]:!bg-card" />
          <MiniMap
            nodeColor={() => "hsl(var(--brand))"}
            pannable
            zoomable
            className="!rounded-xl !border !border-border !bg-card"
          />

          <Panel position="top-left">
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2 shadow-lg">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/15 text-brand">
                <Zap className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{flowName}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {flowStatus === "active" ? "Ativo" : flowStatus === "paused" ? "Pausado" : "Rascunho"}
                </p>
              </div>
              <span
                className={cn(
                  "ml-1 h-2 w-2 rounded-full",
                  flowStatus === "active" ? "bg-emerald-500" : flowStatus === "paused" ? "bg-amber-500" : "bg-muted-foreground/40",
                )}
              />
            </div>
          </Panel>

          <Panel position="top-right">
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-lg">
              <button
                onClick={toggleStatus}
                title={flowStatus === "active" ? "Pausar" : "Ativar"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {flowStatus === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {flowStatus === "active" ? "Pausar" : "Ativar"}
              </button>
              <Link
                href={`/automations/${flowId}/logs`}
                title="Logs de execução"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <History className="h-3.5 w-3.5" />
                Logs
              </Link>
              <span className="px-1 text-[11px] font-medium text-muted-foreground">
                {autosaveState === "saving" ? "Salvando rascunho..." : autosaveState === "saved" ? "Rascunho salvo" : ""}
              </span>
              {selectedNode && (
                <>
                  <div className="mx-0.5 h-5 w-px bg-border" />
                  <button
                    type="button"
                    onClick={() => deleteNode(selectedNode.id)}
                    title="Excluir bloco selecionado"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir bloco
                  </button>
                </>
              )}
              <div className="mx-0.5 h-5 w-px bg-border" />
              <Button size="sm" className="h-8 rounded-lg" onClick={handleSave} disabled={saving}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Salvando..." : "Salvar e publicar"}
              </Button>
            </div>
            {saveError && (
              <p className="mt-1.5 max-w-[260px] rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-right text-[11px] text-amber-700 dark:text-amber-400">
                {saveError}
              </p>
            )}
          </Panel>

          {nodes.length === 0 && (
            <Panel position="top-center">
              <div className="mt-16 flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border bg-card/90 px-5 py-4 text-center shadow-sm">
                <p className="text-sm font-medium">Comece arrastando um bloco da esquerda</p>
                <p className="text-xs text-muted-foreground">
                  Escolha um Gatilho para iniciar o fluxo, na ordem que fizer sentido para voce.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Config panel: gatilhos nao tem config propria; o bloco "Acao" so mostra
          o painel quando uma sub-acao especifica esta selecionada. Busca o no
          atual pelo id (em vez de usar `selectedNode` direto) para nao mostrar
          dados desatualizados apos adicionar/remover sub-itens. */}
      {selectedNode && (() => {
        const liveNode = nodes.find((n) => n.id === selectedNode.id) ?? selectedNode;

        if (liveNode.data.kind === "trigger_group") {
          if (!selectedSubId) return null;
          const triggers = ((liveNode.data.config as Record<string, unknown>)?.triggers as
            | { id: string; kind: string; config?: Record<string, unknown> }[]
            | undefined) ?? [];
          const sub = triggers.find((t) => t.id === selectedSubId);
          if (!sub || sub.kind !== "message_sent") return null;
          const subOption = AVAILABLE_TRIGGERS.find((o) => o.kind === sub.kind);
          const syntheticNode: Node = {
            ...liveNode,
            data: { ...liveNode.data, kind: sub.kind, config: sub.config ?? {}, label: subOption?.label ?? sub.kind },
          };
          return (
            <NodeConfigPanel
              node={syntheticNode}
              quickMessages={quickMessages}
              pipelineOptions={pipelineOptions}
              onUpdate={(config) => updateSubTriggerConfig(liveNode.id, selectedSubId, config)}
              onClose={() => setSelectedSubId(null)}
            />
          );
        }

        if (liveNode.data.kind === "action_group") {
          if (!selectedSubId) return null;
          const actions = ((liveNode.data.config as Record<string, unknown>)?.actions as
            | { id: string; kind: string; config?: Record<string, unknown> }[]
            | undefined) ?? [];
          const sub = actions.find((a) => a.id === selectedSubId);
          if (!sub) return null;
          const subOption = AVAILABLE_SUB_ACTIONS.find((o) => o.kind === sub.kind);
          const syntheticNode: Node = {
            ...liveNode,
            data: { ...liveNode.data, kind: sub.kind, config: sub.config ?? {}, label: subOption?.label ?? sub.kind },
          };
          return (
            <NodeConfigPanel
              node={syntheticNode}
              quickMessages={quickMessages}
              pipelineOptions={pipelineOptions}
              onUpdate={(config) => updateSubActionConfig(liveNode.id, selectedSubId, config)}
              onClose={() => setSelectedSubId(null)}
            />
          );
        }
        return (
          <NodeConfigPanel
            node={liveNode}
            quickMessages={quickMessages}
            pipelineOptions={pipelineOptions}
            onUpdate={(config) => updateNodeConfig(liveNode.id, config)}
            onClose={() => setSelectedNode(null)}
          />
        );
      })()}
    </div>
  );
}
