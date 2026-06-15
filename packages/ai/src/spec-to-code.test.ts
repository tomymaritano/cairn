import { describe, expect, it } from "vitest";
import { specToCode } from "./spec-to-code.js";
import type { FlowSpec } from "./spec.js";

const spec: FlowSpec = {
  id: "onboarding",
  initialContext: { usage: 0, plan: "free" },
  steps: [
    { id: "welcome", title: "Hi", target: "#logo", next: { type: "step", to: "decide" } },
    { id: "decide", next: { type: "branch", field: "usage", op: ">=", value: 80, ifTrue: "upgrade", ifFalse: "team" } },
    { id: "upgrade", next: { type: "end" } },
    { id: "team", next: { type: "branch", field: "plan", op: "==", value: "free", ifTrue: "upgrade", ifFalse: null } },
  ],
};

describe("specToCode", () => {
  const code = specToCode(spec);

  it("imports and exports a named defineFlow with an inferred context type", () => {
    expect(code).toContain('import { defineFlow } from "cairn-core";');
    expect(code).toContain("export const onboarding = defineFlow<{ usage: number; plan: string }>(");
  });

  it("emits a string `next` for a step target and null for end", () => {
    expect(code).toContain('next: "decide"');
    expect(code).toContain("next: null");
  });

  it("emits branch arrow functions with == mapped to === and JSON value literals", () => {
    expect(code).toContain('next: (ctx) => (ctx.usage >= 80 ? "upgrade" : "team")');
    expect(code).toContain('next: (ctx) => (ctx.plan === "free" ? "upgrade" : null)');
  });

  it("emits a meta object for UI steps", () => {
    expect(code).toContain('meta: { target: "#logo", title: "Hi" }');
  });

  it("uses Record<string, never> when there is no context", () => {
    const c = specToCode({ id: "f", initialContext: {}, steps: [{ id: "a", next: { type: "end" } }] });
    expect(c).toContain("defineFlow<Record<string, never>>");
  });
});
