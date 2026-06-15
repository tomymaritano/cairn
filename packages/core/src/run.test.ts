import { describe, expect, it, vi } from "vitest";
import { FlowEngine } from "./engine.js";
import { defineFlow } from "./define-flow.js";
import { createMemoryAdapter } from "./persistence.js";
import type { CairnEvent } from "./events.js";

interface Ctx {
  plan: "free" | "pro";
  usage: number;
  route: string | null;
}

/** A deferred promise so tests can control when a `run` settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("async run steps", () => {
  it("runs, merges the patch, and auto-advances to the resolved next", async () => {
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          {
            id: "decide",
            run: async () => ({ route: "billing" }),
            next: "guide",
          },
          { id: "guide", next: null },
        ],
      }),
      { autoStart: true },
    );

    await flush();
    expect(engine.getState().context.route).toBe("billing");
    expect(engine.getState().currentStepId).toBe("guide");
    expect(engine.getState().running).toBe(false);
  });

  it("toggles running true during the run and false after", async () => {
    const gate = deferred<Partial<Ctx>>();
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          { id: "decide", run: () => gate.promise, next: "guide" },
          { id: "guide", next: null },
        ],
      }),
      { autoStart: true },
    );

    await flush();
    expect(engine.getState().running).toBe(true);
    expect(engine.getState().currentStepId).toBe("decide");

    gate.resolve({ route: "team" });
    await flush();
    expect(engine.getState().running).toBe(false);
    expect(engine.getState().currentStepId).toBe("guide");
  });

  it("branches on the patched context (decision after run)", async () => {
    const make = (usage: number) =>
      new FlowEngine<Ctx>(
        defineFlow<Ctx>({
          id: "agentic",
          initialContext: { plan: "free", usage, route: null },
          steps: [
            {
              id: "decide",
              run: async (ctx) => ({
                route: ctx.usage >= 90 ? "upgrade" : "explore",
              }),
              next: (ctx) => ctx.route,
            },
            { id: "upgrade", next: null },
            { id: "explore", next: null },
          ],
        }),
        { autoStart: true },
      );

    const near = make(95);
    await flush();
    expect(near.getState().currentStepId).toBe("upgrade");

    const low = make(10);
    await flush();
    expect(low.getState().currentStepId).toBe("explore");
  });

  it("transitions to onError when run rejects and onError is set", async () => {
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          {
            id: "decide",
            run: async () => {
              throw new Error("model unavailable");
            },
            next: "guide",
            onError: "fallback",
          },
          { id: "guide", next: null },
          { id: "fallback", next: null },
        ],
      }),
      { autoStart: true },
    );

    await flush();
    expect(engine.getState().currentStepId).toBe("fallback");
    expect(engine.getState().error).toBeNull();
    expect(engine.getState().running).toBe(false);
  });

  it("sets state.error and stays when run rejects without onError; retry() re-runs", async () => {
    let attempts = 0;
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          {
            id: "decide",
            run: async () => {
              attempts += 1;
              if (attempts === 1) throw new Error("transient");
              return { route: "billing" };
            },
            next: "guide",
          },
          { id: "guide", next: null },
        ],
      }),
      { autoStart: true },
    );

    await flush();
    expect(engine.getState().currentStepId).toBe("decide");
    expect(engine.getState().error).toBeInstanceOf(Error);
    expect(engine.getState().error?.message).toBe("transient");
    expect(engine.getState().running).toBe(false);

    engine.retry();
    expect(engine.getState().error).toBeNull();
    expect(engine.getState().running).toBe(true);

    await flush();
    expect(engine.getState().error).toBeNull();
    expect(engine.getState().currentStepId).toBe("guide");
    expect(engine.getState().context.route).toBe("billing");
  });

  it("wraps non-Error rejections in an Error", async () => {
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          {
            id: "decide",
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            run: async () => {
              return Promise.reject("boom");
            },
            next: null,
          },
        ],
      }),
      { autoStart: true },
    );

    await flush();
    expect(engine.getState().error).toBeInstanceOf(Error);
    expect(engine.getState().error?.message).toBe("boom");
  });

  it("aborts and discards an in-flight run when the flow leaves the step", async () => {
    const gate = deferred<Partial<Ctx>>();
    let abortedSignal: AbortSignal | null = null;
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          {
            id: "decide",
            run: (_ctx, signal) => {
              abortedSignal = signal;
              return gate.promise;
            },
            next: "guide",
          },
          { id: "guide", next: null },
          { id: "elsewhere", next: null },
        ],
      }),
      { autoStart: true },
    );

    await flush();
    expect(engine.getState().running).toBe(true);

    // Leave the step mid-run.
    engine.goTo("elsewhere");
    expect(abortedSignal).not.toBeNull();
    expect(abortedSignal!.aborted).toBe(true);
    expect(engine.getState().currentStepId).toBe("elsewhere");
    expect(engine.getState().running).toBe(false);

    // The stale run settles late — its result must be discarded.
    gate.resolve({ route: "billing" });
    await flush();
    expect(engine.getState().currentStepId).toBe("elsewhere");
    expect(engine.getState().context.route).toBeNull();
  });

  it("discards a late rejection from an aborted run", async () => {
    const gate = deferred<Partial<Ctx>>();
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          { id: "decide", run: () => gate.promise, next: "guide" },
          { id: "guide", next: null },
          { id: "elsewhere", next: null },
        ],
      }),
      { autoStart: true },
    );

    await flush();
    engine.goTo("elsewhere");
    gate.reject(new Error("too late"));
    await flush();
    expect(engine.getState().currentStepId).toBe("elsewhere");
    expect(engine.getState().error).toBeNull();
  });

  it("next() is a no-op while a run is in flight", async () => {
    const gate = deferred<Partial<Ctx>>();
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          { id: "decide", run: () => gate.promise, next: "guide" },
          { id: "guide", next: null },
        ],
      }),
      { autoStart: true },
    );

    await flush();
    engine.next(); // ignored while running
    expect(engine.getState().currentStepId).toBe("decide");

    gate.resolve({ route: "billing" });
    await flush();
    expect(engine.getState().currentStepId).toBe("guide");
  });

  it("emits step events in order: enter → run:start → run:success → exit → enter", async () => {
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          { id: "decide", run: async () => ({ route: "billing" }), next: "guide" },
          { id: "guide", next: null },
        ],
      }),
    );
    const events: CairnEvent<Ctx>["type"][] = [];
    engine.onAny((e) => events.push(e.type));
    engine.start();
    await flush();

    // `guide` has next:null but no run, so it waits for next() rather than
    // auto-completing — only run steps auto-advance.
    expect(events).toEqual([
      "flow:start",
      "step:enter", // decide
      "step:run:start",
      "step:run:success",
      "step:exit", // decide
      "step:enter", // guide
    ]);
  });

  it("emits step:run:error carrying the error", async () => {
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 0, route: null },
        steps: [
          {
            id: "decide",
            run: async () => {
              throw new Error("nope");
            },
            next: null,
          },
        ],
      }),
    );
    const seen: { type: string; error: Error | null }[] = [];
    engine.onAny((e) => {
      seen.push({ type: e.type, error: "error" in e ? e.error : null });
    });
    engine.start();
    await flush();

    const errEvent = seen.find((e) => e.type === "step:run:error");
    expect(errEvent).toBeDefined();
    expect(errEvent!.error).toBeInstanceOf(Error);
    expect(errEvent!.error!.message).toBe("nope");
  });

  it("re-runs the resumed step on resume (persistence)", async () => {
    const adapter = createMemoryAdapter();
    const run = vi.fn(async () => ({ route: "billing" }));
    const flow = defineFlow<Ctx>({
      id: "agentic",
      initialContext: { plan: "free", usage: 0, route: null },
      steps: [
        { id: "land", next: "decide" },
        { id: "decide", run, next: "guide" },
        { id: "guide", next: null },
      ],
    });

    // Hand-write an active snapshot parked on the `decide` (run) step.
    adapter.save(
      "cairn:agentic",
      JSON.stringify({
        version: 1,
        flowId: "agentic",
        status: "active",
        currentStepId: "decide",
        context: { plan: "free", usage: 0, route: null },
        history: ["land", "decide"],
      }),
    );

    const engine = new FlowEngine<Ctx>(flow, { persistence: { adapter } });
    engine.start();
    expect(run).toHaveBeenCalledTimes(1);
    await flush();
    expect(engine.getState().currentStepId).toBe("guide");
    expect(engine.getState().context.route).toBe("billing");
  });

  it("does not persist a mid-flight run snapshot", async () => {
    const adapter = createMemoryAdapter();
    const gate = deferred<Partial<Ctx>>();
    const flow = defineFlow<Ctx>({
      id: "agentic",
      initialContext: { plan: "free", usage: 0, route: null },
      steps: [
        { id: "land", next: "decide" },
        { id: "decide", run: () => gate.promise, next: "guide" },
        { id: "guide", next: null },
      ],
    });

    const engine = new FlowEngine<Ctx>(flow, { persistence: { adapter } });
    engine.start();
    engine.next(); // → decide, run starts
    await flush();
    expect(engine.getState().running).toBe(true);

    // The persisted snapshot may point at the run step (resume re-runs it),
    // but must NOT contain a mid-flight context patch.
    const raw = adapter.load("cairn:agentic");
    expect(raw).not.toBeNull();
    const parked = JSON.parse(raw!);
    expect(parked.currentStepId).toBe("decide");
    expect(parked.context.route).toBeNull();

    gate.resolve({ route: "billing" });
    await flush();
    // Now decide settled and advanced to guide → persisted with the patch.
    const settled = JSON.parse(adapter.load("cairn:agentic")!);
    expect(settled.currentStepId).toBe("guide");
    expect(settled.context.route).toBe("billing");
  });

  it("re-executes the run when the step is re-entered via back()", async () => {
    const run = vi.fn(async (ctx: Ctx) => ({
      route: ctx.usage >= 90 ? "upgrade" : "explore",
    }));
    const engine = new FlowEngine<Ctx>(
      defineFlow<Ctx>({
        id: "agentic",
        initialContext: { plan: "free", usage: 10, route: null },
        steps: [
          { id: "land", next: "decide" },
          { id: "decide", run, next: (ctx) => ctx.route },
          { id: "explore", next: null },
          { id: "upgrade", next: null },
        ],
      }),
      { autoStart: true },
    );

    engine.next(); // land → decide (run starts)
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(engine.getState().currentStepId).toBe("explore");

    // Back onto the run step must re-run it — not wedge.
    engine.back();
    expect(engine.getState().currentStepId).toBe("decide");
    expect(engine.getState().running).toBe(true);
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
    expect(engine.getState().currentStepId).toBe("explore");
  });
});

describe("backward compatibility (no run)", () => {
  it("a no-run flow behaves identically and stays synchronous", () => {
    interface SimpleCtx {
      hasTeam: boolean;
    }
    const engine = new FlowEngine<SimpleCtx>(
      defineFlow<SimpleCtx>({
        id: "plain",
        initialContext: { hasTeam: false },
        steps: [
          { id: "a", next: "b" },
          { id: "b", next: null },
        ],
      }),
      { autoStart: true },
    );
    // Synchronous transition, no awaiting.
    expect(engine.getState().currentStepId).toBe("a");
    expect(engine.getState().running).toBe(false);
    expect(engine.getState().error).toBeNull();
    engine.next();
    expect(engine.getState().currentStepId).toBe("b");
    engine.next();
    expect(engine.getState().status).toBe("completed");
  });
});
