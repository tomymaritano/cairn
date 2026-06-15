import { describe, expect, it } from "vitest";
import { FlowEngine } from "@cairn/core";
import { compare, specToFlow } from "./spec-to-flow.js";
import type { FlowSpec } from "./spec.js";

const spec = (usage: number): FlowSpec => ({
  id: "f",
  initialContext: { usage },
  steps: [
    { id: "a", next: { type: "branch", field: "usage", op: ">=", value: 80, ifTrue: "up", ifFalse: "ok" } },
    { id: "up", next: { type: "end" } },
    { id: "ok", next: { type: "end" } },
  ],
});

describe("specToFlow", () => {
  it("builds a runnable flow whose branch routes on context (true)", () => {
    const engine = new FlowEngine(specToFlow<{ usage: number }>(spec(90)), { autoStart: true });
    engine.next(); // a → usage 90 >= 80 → up
    expect(engine.getState().currentStepId).toBe("up");
  });

  it("routes the other way when the comparison is false", () => {
    const engine = new FlowEngine(specToFlow<{ usage: number }>(spec(10)), { autoStart: true });
    engine.next(); // a → usage 10 >= 80 false → ok
    expect(engine.getState().currentStepId).toBe("ok");
  });

  it("carries meta and terminal steps", () => {
    const flow = specToFlow({
      id: "f",
      initialContext: {},
      steps: [{ id: "a", title: "T", target: "#x", next: { type: "end" } }],
    });
    expect(flow.steps[0]!.meta).toEqual({ title: "T", target: "#x" });
    expect(flow.steps[0]!.next).toBeNull();
  });
});

describe("compare", () => {
  it("evaluates each operator", () => {
    expect(compare(90, ">=", 80)).toBe(true);
    expect(compare(80, ">", 80)).toBe(false);
    expect(compare("free", "==", "free")).toBe(true);
    expect(compare("free", "!=", "pro")).toBe(true);
    expect(compare(3, "<", 5)).toBe(true);
    expect(compare(3, "<=", 3)).toBe(true);
  });
});
