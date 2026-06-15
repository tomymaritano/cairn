import { describe, expect, it } from "vitest";
import { validateSpec } from "./validate-spec.js";
import type { FlowSpec } from "./spec.js";

const valid: FlowSpec = {
  id: "f",
  initialContext: { usage: 0 },
  steps: [
    { id: "a", next: { type: "branch", field: "usage", op: ">=", value: 80, then: "b", else: null } },
    { id: "b", next: { type: "end" } },
  ],
};

describe("validateSpec", () => {
  it("accepts a valid spec", () => {
    expect(() => validateSpec(valid)).not.toThrow();
  });

  it("rejects a dangling step reference", () => {
    expect(() =>
      validateSpec({ ...valid, steps: [{ id: "a", next: { type: "step", to: "ghost" } }, { id: "b", next: { type: "end" } }] }),
    ).toThrow(/unknown step "ghost"/);
  });

  it("rejects a branch on an undeclared context field", () => {
    expect(() =>
      validateSpec({
        ...valid,
        initialContext: {},
        steps: [
          { id: "a", next: { type: "branch", field: "usage", op: ">=", value: 80, then: "b", else: null } },
          { id: "b", next: { type: "end" } },
        ],
      }),
    ).toThrow(/not declared in initialContext/);
  });

  it("rejects a flow with no terminal path", () => {
    expect(() =>
      validateSpec({
        id: "f",
        initialContext: {},
        steps: [
          { id: "a", next: { type: "step", to: "b" } },
          { id: "b", next: { type: "step", to: "a" } },
        ],
      }),
    ).toThrow(/no terminal path/);
  });

  it("rejects duplicate step ids", () => {
    expect(() =>
      validateSpec({
        id: "f",
        initialContext: {},
        steps: [
          { id: "a", next: { type: "end" } },
          { id: "a", next: { type: "end" } },
        ],
      }),
    ).toThrow(/duplicate step id "a"/);
  });
});
