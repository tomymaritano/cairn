import { describe, expect, it } from "vitest";
import { get } from "svelte/store";
import { FlowEngine, createFlow, defineFlow } from "./index.js";

interface Ctx {
  hasTeam: boolean;
}

const flow = defineFlow<Ctx>({
  id: "t",
  initialContext: { hasTeam: false },
  steps: [
    { id: "a", next: "b" },
    { id: "b", next: (c) => (c.hasTeam ? "c" : null) },
    { id: "c", next: null },
  ],
});

describe("svelte-cairn", () => {
  it("seeds the current step and emits on every transition", () => {
    const f = createFlow(flow, { autoStart: true });
    const seen: (string | null)[] = [];
    const unsub = f.state.subscribe((s) => seen.push(s.currentStepId));
    expect(seen[0]).toBe("a"); // immediate seed
    f.next();
    expect(seen.at(-1)).toBe("b");
    unsub();
  });

  it("get(state) reflects the current snapshot", () => {
    const f = createFlow(flow, { autoStart: true });
    expect(get(f.state).currentStepId).toBe("a");
    expect(get(f.state).status).toBe("active");
  });

  it("reflects branching driven from context", () => {
    const f = createFlow(flow, { autoStart: true });
    f.setContext({ hasTeam: true });
    f.next(); // a → b
    f.next(); // b → c (team)
    expect(get(f.state).currentStepId).toBe("c");
  });

  it("completes the no-team branch", () => {
    const f = createFlow(flow, { autoStart: true });
    f.next(); // b
    f.next(); // null → complete
    expect(get(f.state).status).toBe("completed");
    expect(get(f.state).currentStepId).toBeNull();
  });

  it("stops emitting after unsubscribe", () => {
    const f = createFlow(flow, { autoStart: true });
    const seen: (string | null)[] = [];
    const unsub = f.state.subscribe((s) => seen.push(s.currentStepId));
    unsub();
    const count = seen.length;
    f.next();
    expect(seen.length).toBe(count);
  });

  it("adopts a pre-built engine", () => {
    const engine = new FlowEngine<Ctx>(flow, { autoStart: true });
    const f = createFlow(engine);
    expect(f.engine).toBe(engine);
    expect(get(f.state).currentStepId).toBe("a");
  });
});
