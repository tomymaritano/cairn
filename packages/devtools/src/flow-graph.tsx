import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import type {
  FlowDefinition,
  FlowEngine,
  FlowState,
  StepDefinition,
} from "cairn-core";
import { buildGraph, type Badge, type EdgeKind } from "./build-graph.js";
import type { CSSProperties } from "react";

export interface FlowGraphProps<C extends object> {
  /** The flow to visualize. */
  flow: FlowDefinition<C>;
  /** Optional: a live engine. When set, the graph highlights the running flow. */
  engine?: FlowEngine<C>;
  /** Layout direction. Default "TB" (top→bottom). */
  direction?: "TB" | "LR";
  /** Fired when a node is clicked. */
  onSelectStep?: (step: StepDefinition<C>) => void;
  className?: string;
  style?: CSSProperties;
}

type NodeStatus = "idle" | "visited" | "current" | "running" | "error";

interface StepNodeData extends Record<string, unknown> {
  label: string;
  badges: Badge[];
  status: NodeStatus;
}

type StepFlowNode = Node<StepNodeData, "step">;

const NODE_W = 180;
const NODE_H = 60;

const STATUS_RING: Record<NodeStatus, string> = {
  idle: "1px solid var(--cairn-border, #d1d5db)",
  visited: "1px solid #6366f1",
  current: "2px solid #4f46e5",
  running: "2px solid #4f46e5",
  error: "2px solid #ef4444",
};

const BADGE_LABEL: Record<Badge, string> = {
  start: "▶ start",
  end: "■ end",
  async: "⚡ async",
  guarded: "🔒 guard",
  dynamic: "↯ dynamic",
};

function StepNode({ data }: NodeProps<StepFlowNode>) {
  const { label, badges, status } = data;
  return (
    <div
      data-cairn-node={label}
      data-status={status}
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        padding: "8px 10px",
        borderRadius: 10,
        background: "var(--cairn-node-bg, #fff)",
        color: "var(--cairn-node-fg, #15171c)",
        border: STATUS_RING[status],
        boxShadow:
          status === "running"
            ? "0 0 0 4px rgba(79,70,229,.25)"
            : "0 1px 2px rgba(0,0,0,.08)",
        fontSize: 13,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontWeight: 600 }}>
        {label}
        {status === "running" && " …"}
      </div>
      {badges.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {badges.map((b) => (
            <span
              key={b}
              style={{
                fontSize: 10,
                padding: "1px 5px",
                borderRadius: 999,
                background: "var(--cairn-badge-bg, #eef2ff)",
                color: "var(--cairn-badge-fg, #4338ca)",
              }}
            >
              {BADGE_LABEL[b]}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { step: StepNode };

const EDGE_STYLE: Record<EdgeKind, CSSProperties> = {
  next: { stroke: "#9ca3af" },
  error: { stroke: "#ef4444", strokeDasharray: "4 3" },
  possible: { stroke: "#a5b4fc", strokeDasharray: "2 4" },
};

function useLiveState<C extends object>(engine?: FlowEngine<C>): FlowState<C> | null {
  const [state, setState] = useState<FlowState<C> | null>(() => engine?.getState() ?? null);
  useEffect(() => {
    if (!engine) {
      setState(null);
      return;
    }
    setState(engine.getState());
    return engine.subscribe(setState);
  }, [engine]);
  return state;
}

function statusFor<C extends object>(
  id: string,
  live: FlowState<C> | null,
): NodeStatus {
  if (!live) return "idle";
  if (id === live.currentStepId) {
    if (live.error) return "error";
    if (live.running) return "running";
    return "current";
  }
  return live.history.includes(id) ? "visited" : "idle";
}

/**
 * Renders a Cairn flow as a graph (React Flow + dagre auto-layout). Static by
 * default; pass `engine` to highlight the running flow live — current step,
 * visited path, running/error state, and the edges actually taken (which
 * reveals the dynamic branches static analysis can't show).
 *
 * Consumers must import React Flow's stylesheet once:
 * `import "@xyflow/react/dist/style.css";`
 */
export function FlowGraph<C extends object>({
  flow,
  engine,
  direction = "TB",
  onSelectStep,
  className,
  style,
}: FlowGraphProps<C>) {
  const live = useLiveState(engine);
  const stepsById = useMemo(
    () => new Map(flow.steps.map((s) => [s.id, s])),
    [flow],
  );

  const { nodes, edges } = useMemo(() => {
    const model = buildGraph(flow);
    const pos = layout(model.nodes.map((n) => n.id), model.edges, direction);

    const rfNodes: StepFlowNode[] = model.nodes.map((n) => ({
      id: n.id,
      type: "step",
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      data: { label: n.id, badges: n.badges, status: statusFor(n.id, live) },
    }));

    // Static edges, plus any "taken" edges from the live history that the static
    // model didn't know about (i.e. dynamic branches).
    const known = new Set(model.edges.map((e) => `${e.from}->${e.to}`));
    const taken = new Set<string>();
    if (live) {
      for (let i = 0; i < live.history.length - 1; i++) {
        taken.add(`${live.history[i]}->${live.history[i + 1]}`);
      }
    }

    const rfEdges: Edge[] = model.edges.map((e) => {
      const isTaken = taken.has(`${e.from}->${e.to}`);
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        animated: isTaken,
        style: { ...EDGE_STYLE[e.kind], ...(isTaken ? { stroke: "#4f46e5", strokeWidth: 2 } : {}) },
      };
    });

    for (const key of taken) {
      if (!known.has(key)) {
        const [from, to] = key.split("->");
        rfEdges.push({
          id: `taken:${key}`,
          source: from!,
          target: to!,
          animated: true,
          style: { stroke: "#4f46e5", strokeWidth: 2, strokeDasharray: "4 4" },
        });
      }
    }

    return { nodes: rfNodes, edges: rfEdges };
  }, [flow, direction, live]);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const step = stepsById.get(node.id);
      if (step && onSelectStep) onSelectStep(step);
    },
    [stepsById, onSelectStep],
  );

  return (
    <div
      data-cairn-flowgraph=""
      className={className}
      style={{ width: "100%", height: 420, ...style }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

/** dagre auto-layout → a map of node id → top-left position. */
function layout(
  ids: string[],
  edges: { from: string; to: string }[],
  direction: "TB" | "LR",
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 70 });
  for (const id of ids) g.setNode(id, { width: NODE_W, height: NODE_H });
  for (const e of edges) if (ids.includes(e.from) && ids.includes(e.to)) g.setEdge(e.from, e.to);
  dagre.layout(g);
  const out = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const n = g.node(id);
    out.set(id, { x: (n?.x ?? 0) - NODE_W / 2, y: (n?.y ?? 0) - NODE_H / 2 });
  }
  return out;
}
