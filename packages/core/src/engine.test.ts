import { describe, expect, it, vi } from "vitest";
import { FlowEngine } from "./engine.js";
import { defineFlow } from "./define-flow.js";
import type { CairnEvent } from "./events.js";

interface Ctx {
  hasTeam: boolean;
}

function makeFlow() {
  return defineFlow<Ctx>({
    id: "onboarding",
    initialContext: { hasTeam: false },
    steps: [
      { id: "welcome", next: "profile" },
      { id: "profile", next: (ctx) => (ctx.hasTeam ? "invite" : null) },
      { id: "invite", next: null },
    ],
  });
}

describe("FlowEngine", () => {
  it("starts on the first step", () => {
    const engine = new FlowEngine(makeFlow());
    engine.start();
    expect(engine.getState().currentStepId).toBe("welcome");
    expect(engine.getState().status).toBe("active");
    expect(engine.getState().totalSteps).toBe(3);
  });

  it("advances through static `next` targets", () => {
    const engine = new FlowEngine(makeFlow(), { autoStart: true });
    engine.next();
    expect(engine.getState().currentStepId).toBe("profile");
  });

  it("branches on live context (no team → completes)", () => {
    const engine = new FlowEngine(makeFlow(), { autoStart: true });
    engine.next(); // profile
    engine.next(); // ctx.hasTeam === false → null → complete
    expect(engine.getState().status).toBe("completed");
    expect(engine.getState().currentStepId).toBeNull();
  });

  it("branches the other way when context changes", () => {
    const engine = new FlowEngine(makeFlow(), { autoStart: true });
    engine.setContext({ hasTeam: true });
    engine.next(); // profile
    engine.next(); // ctx.hasTeam === true → invite
    expect(engine.getState().currentStepId).toBe("invite");
  });

  it("navigates back through history", () => {
    const engine = new FlowEngine(makeFlow(), { autoStart: true });
    engine.next(); // profile
    engine.back();
    expect(engine.getState().currentStepId).toBe("welcome");
  });

  it("skips steps whose canEnter guard is false", () => {
    const flow = defineFlow<Ctx>({
      id: "guarded",
      initialContext: { hasTeam: false },
      steps: [
        { id: "a", next: "b" },
        { id: "b", canEnter: (ctx) => ctx.hasTeam, next: "c" },
        { id: "c", next: null },
      ],
    });
    const engine = new FlowEngine(flow, { autoStart: true });
    engine.next(); // tries b, guard false → c
    expect(engine.getState().currentStepId).toBe("c");
  });

  it("emits a full analytics-friendly event stream via onAny", () => {
    const engine = new FlowEngine(makeFlow());
    const events: CairnEvent<Ctx>["type"][] = [];
    engine.onAny((e) => events.push(e.type));
    engine.start();
    engine.next(); // profile
    engine.next(); // complete
    expect(events).toEqual([
      "flow:start",
      "step:enter", // welcome
      "step:exit", // welcome
      "step:enter", // profile
      "step:exit", // profile
      "flow:complete",
    ]);
  });

  it("notifies state subscribers on every transition", () => {
    const engine = new FlowEngine(makeFlow(), { autoStart: true });
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.next();
    expect(listener).toHaveBeenCalled();
  });
});
