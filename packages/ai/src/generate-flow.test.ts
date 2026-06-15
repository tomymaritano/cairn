import { describe, expect, it } from "vitest";
import { FlowEngine } from "cairn-core";
import { generateFlow } from "./generate-flow.js";

// A canned model output — exercises the whole pipeline with no real LLM.
const cannedSpec = {
  id: "billing-onboarding",
  initialContext: { usage: 85 },
  steps: [
    { id: "welcome", title: "Welcome", target: "#logo", next: { type: "step", to: "decide" } },
    { id: "decide", next: { type: "branch", field: "usage", op: ">=", value: 80, then: "upgrade", else: "done" } },
    { id: "upgrade", next: { type: "end" } },
    { id: "done", next: { type: "end" } },
  ],
};

describe("generateFlow", () => {
  it("returns a validated spec, code, and a runnable flow (injected generator)", async () => {
    const result = await generateFlow<{ usage: number }>("onboard to billing", {
      generate: async () => cannedSpec,
    });

    expect(result.spec.id).toBe("billing-onboarding");
    expect(result.code).toContain("export const billingOnboarding = defineFlow");
    expect(result.code).toContain('(ctx) => (ctx.usage >= 80 ? "upgrade" : "done")');

    // The runnable flow actually branches (usage 85 ≥ 80 → upgrade).
    const engine = new FlowEngine(result.flow, { autoStart: true });
    engine.next(); // welcome → decide
    engine.next(); // decide → upgrade
    expect(engine.getState().currentStepId).toBe("upgrade");
  });

  it("forwards the prompt to the injected generator", async () => {
    let seen = "";
    await generateFlow("guide users to invite their team", {
      generate: async ({ prompt }) => {
        seen = prompt;
        return cannedSpec;
      },
    });
    expect(seen).toContain("guide users to invite their team");
    expect(seen).toContain("SINGLE comparison");
  });

  it("throws a descriptive error when the model returns an invalid spec", async () => {
    await expect(
      generateFlow("x", {
        generate: async () => ({
          id: "broken",
          initialContext: {},
          steps: [{ id: "a", next: { type: "step", to: "ghost" } }],
        }),
      }),
    ).rejects.toThrow(/unknown step "ghost"/);
  });
});
