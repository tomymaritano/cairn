import type { FlowDefinition } from "@cairn/core";

export type Badge = "start" | "end" | "async" | "guarded" | "dynamic";

export interface GraphNode {
  id: string;
  badges: Badge[];
}

export type EdgeKind = "next" | "error" | "possible";

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface FlowGraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Ids of steps whose `next`/`onError` is a function (can't resolve statically). */
  dynamic: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Turn a flow definition into a static graph model — the framework-free core of
 * the visualizer. No React, no DOM, no layout: just nodes, edges, and badges,
 * so it's trivially unit-testable.
 *
 * Edge inference:
 * - `next: string`        → solid `"next"` edge
 * - `onError: string`     → dashed `"error"` edge
 * - `next`/`onError` fn   → step marked `dynamic` (+ `"dynamic"` badge); if the
 *                           step declares `meta.targets: string[]`, dotted
 *                           `"possible"` edges are drawn to each
 * - `next` null/omitted   → terminal (`"end"` badge)
 *
 * Edges whose target id doesn't exist in the flow are dropped (a broken `next`
 * simply doesn't draw) so the rendered graph is always valid.
 */
export function buildGraph<C extends object>(flow: FlowDefinition<C>): FlowGraphModel {
  const ids = new Set(flow.steps.map((s) => s.id));
  const startId = flow.initialStep ?? flow.steps[0]?.id;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const dynamic: string[] = [];

  const pushEdge = (from: string, to: string, kind: EdgeKind) => {
    if (ids.has(to)) edges.push({ id: `${from}:${kind}:${to}`, from, to, kind });
  };
  const markDynamic = (id: string, badges: Badge[]) => {
    if (!dynamic.includes(id)) dynamic.push(id);
    if (!badges.includes("dynamic")) badges.push("dynamic");
  };

  for (const step of flow.steps) {
    const badges: Badge[] = [];
    if (step.id === startId) badges.push("start");
    if (step.run) badges.push("async");
    if (step.canEnter) badges.push("guarded");

    if (typeof step.next === "string") {
      pushEdge(step.id, step.next, "next");
    } else if (typeof step.next === "function") {
      markDynamic(step.id, badges);
      const targets = step.meta?.["targets"];
      if (isStringArray(targets)) {
        for (const t of targets) pushEdge(step.id, t, "possible");
      }
    } else {
      // null or omitted → terminal
      badges.push("end");
    }

    if (typeof step.onError === "string") {
      pushEdge(step.id, step.onError, "error");
    } else if (typeof step.onError === "function") {
      markDynamic(step.id, badges);
    }

    nodes.push({ id: step.id, badges });
  }

  return { nodes, edges, dynamic };
}
