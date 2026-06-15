import type { FlowSpec } from "./spec.js";

/**
 * Check a (Zod-parsed) spec for referential integrity — the things a schema
 * can't catch. Throws a descriptive `Error` listing every problem so a caller
 * can surface it or re-prompt. Pure.
 */
export function validateSpec(spec: FlowSpec): void {
  const ids = new Set(spec.steps.map((s) => s.id));
  const fields = new Set(Object.keys(spec.initialContext));
  const errors: string[] = [];

  const checkRef = (label: string, to: string | null) => {
    if (to !== null && !ids.has(to)) {
      errors.push(`${label} references unknown step "${to}"`);
    }
  };

  const seen = new Set<string>();
  for (const step of spec.steps) {
    if (seen.has(step.id)) errors.push(`duplicate step id "${step.id}"`);
    seen.add(step.id);

    const n = step.next;
    if (n.type === "step") {
      checkRef(`step "${step.id}".next.to`, n.to);
    } else if (n.type === "branch") {
      checkRef(`step "${step.id}".next.ifTrue`, n.ifTrue);
      checkRef(`step "${step.id}".next.ifFalse`, n.ifFalse);
      if (!fields.has(n.field)) {
        errors.push(
          `step "${step.id}" branches on "${n.field}", which is not declared in initialContext`,
        );
      }
    }
  }

  const hasTerminal = spec.steps.some(
    (s) => s.next.type === "end" || (s.next.type === "branch" && s.next.ifFalse === null),
  );
  if (!hasTerminal) {
    errors.push("flow has no terminal path (no step ends the flow)");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid flow spec:\n- ${errors.join("\n- ")}`);
  }
}
