import { defineFlow, type FlowDefinition, type StepDefinition } from "@cairn/core";
import type { FlowSpec, Operator, StepSpec } from "./spec.js";

/** Evaluate a single comparison. Built by us from declarative data — never `eval`. */
export function compare(a: unknown, op: Operator, b: unknown): boolean {
  switch (op) {
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    case ">=":
      return (a as number) >= (b as number);
    case "<=":
      return (a as number) <= (b as number);
    case ">":
      return (a as number) > (b as number);
    case "<":
      return (a as number) < (b as number);
  }
}

function metaOf(s: StepSpec): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  if (s.title !== undefined) meta["title"] = s.title;
  if (s.body !== undefined) meta["body"] = s.body;
  if (s.target !== undefined) meta["target"] = s.target;
  if (s.placement !== undefined) meta["placement"] = s.placement;
  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * Build a runnable `FlowDefinition` from a spec. Branch `next` becomes a closure
 * *we* construct from the comparison (no `eval`), so the generated flow can be
 * run or visualized immediately.
 */
export function specToFlow<C extends object = Record<string, unknown>>(
  spec: FlowSpec,
): FlowDefinition<C> {
  const steps = spec.steps.map((s): StepDefinition<C> => {
    const meta = metaOf(s);
    const n = s.next;
    const base = { id: s.id, ...(meta ? { meta } : {}) };

    if (n.type === "step") return { ...base, next: n.to };
    if (n.type === "end") return { ...base, next: null };
    return {
      ...base,
      next: (ctx: Readonly<C>) =>
        compare((ctx as Record<string, unknown>)[n.field], n.op, n.value) ? n.ifTrue : n.ifFalse,
    };
  });

  return defineFlow<C>({
    id: spec.id,
    initialContext: spec.initialContext as C,
    steps,
  });
}
