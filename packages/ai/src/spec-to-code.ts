import type { FlowSpec, Operator, StepSpec } from "./spec.js";

const JS_OP: Record<Operator, string> = {
  "==": "===",
  "!=": "!==",
  ">=": ">=",
  "<=": "<=",
  ">": ">",
  "<": "<",
};

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const lit = (v: string | number | boolean): string => JSON.stringify(v);
const access = (field: string): string =>
  IDENT.test(field) ? `ctx.${field}` : `ctx[${JSON.stringify(field)}]`;

function tsType(v: string | number | boolean): string {
  return typeof v === "string" ? "string" : typeof v === "number" ? "number" : "boolean";
}

function ctxType(ctx: Record<string, string | number | boolean>): string {
  const keys = Object.keys(ctx);
  if (keys.length === 0) return "Record<string, never>";
  const fields = keys
    .map((k) => `${IDENT.test(k) ? k : JSON.stringify(k)}: ${tsType(ctx[k]!)}`)
    .join("; ");
  return `{ ${fields} }`;
}

/** A valid JS identifier for the exported const, derived from the flow id. */
function exportName(id: string): string {
  const camel = id
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""))
    .replace(/^[^A-Za-z_$]+/, "");
  return camel || "flow";
}

function metaLiteral(s: StepSpec): string | null {
  const parts: string[] = [];
  if (s.target !== undefined) parts.push(`target: ${lit(s.target)}`);
  if (s.placement !== undefined) parts.push(`placement: ${lit(s.placement)}`);
  if (s.title !== undefined) parts.push(`title: ${lit(s.title)}`);
  if (s.body !== undefined) parts.push(`body: ${lit(s.body)}`);
  return parts.length > 0 ? `{ ${parts.join(", ")} }` : null;
}

function nextCode(s: StepSpec): string {
  const n = s.next;
  if (n.type === "step") return lit(n.to);
  if (n.type === "end") return "null";
  const cond = `${access(n.field)} ${JS_OP[n.op]} ${lit(n.value)}`;
  const elseExpr = n.else === null ? "null" : lit(n.else);
  return `(ctx) => (${cond} ? ${lit(n.then)} : ${elseExpr})`;
}

function stepCode(s: StepSpec): string {
  const parts = [`id: ${lit(s.id)}`];
  const meta = metaLiteral(s);
  if (meta) parts.push(`meta: ${meta}`);
  parts.push(`next: ${nextCode(s)}`);
  return `{ ${parts.join(", ")} }`;
}

/**
 * Emit a ready-to-paste `defineFlow(...)` TypeScript source from a spec. Pure.
 * Branch steps become inline arrow functions; the context type is inferred from
 * `initialContext`. The model never produces code — only the declarative spec —
 * so there is nothing to `eval`.
 */
export function specToCode(spec: FlowSpec): string {
  const steps = spec.steps.map((s) => `    ${stepCode(s)},`).join("\n");
  return `import { defineFlow } from "cairn-core";

export const ${exportName(spec.id)} = defineFlow<${ctxType(spec.initialContext)}>({
  id: ${lit(spec.id)},
  initialContext: ${JSON.stringify(spec.initialContext)},
  steps: [
${steps}
  ],
});
`;
}
