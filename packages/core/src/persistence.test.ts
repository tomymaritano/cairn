import { describe, expect, it } from "vitest";
import { FlowEngine } from "./engine.js";
import { defineFlow } from "./define-flow.js";
import {
  createMemoryAdapter,
  persistenceKey,
  type PersistenceAdapter,
} from "./persistence.js";

interface Ctx {
  hasTeam: boolean;
}

const flow = defineFlow<Ctx>({
  id: "onboarding",
  initialContext: { hasTeam: false },
  steps: [
    { id: "welcome", next: "search" },
    { id: "search", next: "profile" },
    { id: "profile", next: null },
  ],
});

/** Build two engines sharing one store — simulates a page reload. */
function withSharedStore() {
  const adapter = createMemoryAdapter();
  const make = () => new FlowEngine<Ctx>(flow, { persistence: { adapter } });
  return { adapter, make };
}

describe("persistence", () => {
  it("resumes an in-progress flow on the next start()", () => {
    const { make } = withSharedStore();

    const first = make();
    first.start();
    first.next(); // → search
    expect(first.getState().currentStepId).toBe("search");

    // "reload": a fresh engine over the same store.
    const second = make();
    second.start();
    expect(second.getState().currentStepId).toBe("search");
    expect(second.getState().status).toBe("active");
  });

  it("persists context across reloads", () => {
    const { make } = withSharedStore();
    const first = make();
    first.start();
    first.setContext({ hasTeam: true });

    const second = make();
    second.start();
    expect(second.getState().context.hasTeam).toBe(true);
  });

  it("does not re-show a completed flow (respectCompleted default)", () => {
    const { make } = withSharedStore();
    const first = make();
    first.start();
    first.next(); // search
    first.next(); // profile
    first.next(); // complete
    expect(first.getState().status).toBe("completed");

    const second = make();
    second.start();
    expect(second.getState().status).toBe("completed");
    expect(second.getState().currentStepId).toBeNull();
  });

  it("respectCompleted:false lets a finished flow restart", () => {
    const adapter = createMemoryAdapter();
    const opts = { persistence: { adapter, respectCompleted: false } };
    const first = new FlowEngine<Ctx>(flow, opts);
    first.start();
    first.skip();

    const second = new FlowEngine<Ctx>(flow, opts);
    second.start();
    expect(second.getState().status).toBe("active");
    expect(second.getState().currentStepId).toBe("welcome");
  });

  it("emits flow:resume (not flow:start) when resuming", () => {
    const { make } = withSharedStore();
    make().start(); // seed: enters welcome, persisted as active

    const second = make();
    const seen: string[] = [];
    second.onAny((e) => seen.push(e.type));
    second.start();
    expect(seen).toContain("flow:resume");
    expect(seen).not.toContain("flow:start");
  });

  it("reset() clears storage and starts fresh", () => {
    const { make, adapter } = withSharedStore();
    const e = make();
    e.start();
    e.next();
    e.reset();
    expect(adapter.load(persistenceKey({ adapter }, "onboarding"))).toBeNull();
    e.start();
    expect(e.getState().currentStepId).toBe("welcome");
  });

  it("ignores a snapshot whose step no longer exists", () => {
    const adapter = createMemoryAdapter();
    // Hand-write a snapshot pointing at a removed step.
    adapter.save(
      "cairn:onboarding",
      JSON.stringify({
        version: 1,
        flowId: "onboarding",
        status: "active",
        currentStepId: "ghost-step",
        context: { hasTeam: false },
        history: ["ghost-step"],
      }),
    );
    const engine = new FlowEngine<Ctx>(flow, { persistence: { adapter } });
    engine.start();
    expect(engine.getState().currentStepId).toBe("welcome");
  });

  it("ignores corrupt JSON gracefully", () => {
    const adapter: PersistenceAdapter = createMemoryAdapter();
    adapter.save("cairn:onboarding", "{not json");
    const engine = new FlowEngine<Ctx>(flow, { persistence: { adapter } });
    engine.start();
    expect(engine.getState().currentStepId).toBe("welcome");
  });
});
