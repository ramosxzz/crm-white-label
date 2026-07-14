"use client";

import { useCallback, useState } from "react";
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
import { Save, Zap, Play, Pause, History } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TriggerNode, ActionNode, ConditionNode, WaitNode, EndNode } from "./node-types";
import { BlockPanel } from "./block-panel";
import { NodeConfigPanel } from "./node-config-panel";
import { saveFlowVersion, updateFlowStatus } from "@/app/(app)/automations/actions";

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
}: {
  flowId: string;
  flowName: string;
  flowStatus: string;
  initialBlocks: FlowBlock[];
  initialConnections: FlowEdge[];
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toReactFlowNodes(initialBlocks));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toReactFlowEdges(initialConnections));
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  function addBlock(type: string, kind: string, label: string) {
    const id = `${type}_${Date.now()}`;
    // Distribui os novos blocos em diagonal suave para evitar sobreposição
    const offset = nodes.length;
    const x = 320 + (offset % 3) * 60;
    const y = 120 + offset * 90;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type,
        position: { x, y },
        data: { label, kind, config: {}, stats: {} },
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
    const blocks = nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "action",
      position: n.position,
      data: n.data,
    }));
    const connections = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
    }));
    const result = await saveFlowVersion(flowId, { blocks, connections });
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
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
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

      {/* Config panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
