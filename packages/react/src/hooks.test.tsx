import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defineFlow } from "cairn-core";
import { FlowProvider } from "./context.js";
import { useCurrentStep, useFlow } from "./hooks.js";

afterEach(cleanup);

/** A promise you can settle from the outside — drives the `run` step in tests. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Ctx {
  hasTeam: boolean;
}

const flow = defineFlow<Ctx>({
  id: "onboarding",
  initialContext: { hasTeam: false },
  steps: [
    { id: "a", next: "b", meta: { title: "Step A" } },
    { id: "b", next: (ctx) => (ctx.hasTeam ? "c" : null) },
    { id: "c", next: null },
  ],
});

function Probe() {
  const { state, next, back, setContext, reset } = useFlow<Ctx>();
  return (
    <div>
      <span data-testid="step">{state.currentStepId ?? "none"}</span>
      <span data-testid="status">{state.status}</span>
      <span data-testid="index">{state.stepIndex}</span>
      <button onClick={next}>next</button>
      <button onClick={back}>back</button>
      <button onClick={() => setContext({ hasTeam: true })}>team</button>
      <button onClick={reset}>reset</button>
    </div>
  );
}

const renderFlow = (props: Partial<React.ComponentProps<typeof FlowProvider<Ctx>>> = {}) =>
  render(
    <FlowProvider flow={flow} options={{ autoStart: true }} {...props}>
      <Probe />
    </FlowProvider>,
  );

describe("useFlow", () => {
  it("renders the first step when autoStart is on", () => {
    renderFlow();
    expect(screen.getByTestId("step").textContent).toBe("a");
    expect(screen.getByTestId("status").textContent).toBe("active");
  });

  it("re-renders on transitions (useSyncExternalStore wiring)", () => {
    renderFlow();
    fireEvent.click(screen.getByText("next"));
    expect(screen.getByTestId("step").textContent).toBe("b");
    expect(screen.getByTestId("index").textContent).toBe("1");
  });

  it("reflects branching driven from the UI", () => {
    renderFlow();
    // Without a team, b → null → completes.
    fireEvent.click(screen.getByText("next")); // b
    fireEvent.click(screen.getByText("next")); // complete
    expect(screen.getByTestId("status").textContent).toBe("completed");

    // Flip context first, then walk: b → c.
    cleanup();
    renderFlow();
    fireEvent.click(screen.getByText("team"));
    fireEvent.click(screen.getByText("next")); // b
    fireEvent.click(screen.getByText("next")); // c
    expect(screen.getByTestId("step").textContent).toBe("c");
  });

  it("navigates back", () => {
    renderFlow();
    fireEvent.click(screen.getByText("next")); // b
    fireEvent.click(screen.getByText("back"));
    expect(screen.getByTestId("step").textContent).toBe("a");
  });

  it("reset returns the flow to idle", () => {
    renderFlow();
    fireEvent.click(screen.getByText("next"));
    fireEvent.click(screen.getByText("reset"));
    expect(screen.getByTestId("status").textContent).toBe("idle");
    expect(screen.getByTestId("step").textContent).toBe("none");
  });
});

describe("useCurrentStep", () => {
  it("returns the active step definition with its meta", () => {
    function StepProbe() {
      const step = useCurrentStep<Ctx>();
      return <span data-testid="title">{String(step?.meta?.title ?? "none")}</span>;
    }
    render(
      <FlowProvider flow={flow} options={{ autoStart: true }}>
        <StepProbe />
      </FlowProvider>,
    );
    expect(screen.getByTestId("title").textContent).toBe("Step A");
  });
});

interface RunCtx {
  resolved: boolean;
}

describe("useFlow with a run step", () => {
  it("toggles state.running around a run step and auto-advances on success", async () => {
    const gate = deferred<Partial<RunCtx>>();
    const runFlow = defineFlow<RunCtx>({
      id: "run-success",
      initialContext: { resolved: false },
      steps: [
        { id: "start", next: "decide" },
        { id: "decide", next: "done", run: () => gate.promise },
        { id: "done", next: null },
      ],
    });

    function RunProbe() {
      const { state, next } = useFlow<RunCtx>();
      return (
        <div>
          <span data-testid="step">{state.currentStepId ?? "none"}</span>
          <span data-testid="running">{String(state.running)}</span>
          <span data-testid="resolved">{String(state.context.resolved)}</span>
          <button onClick={next}>next</button>
        </div>
      );
    }

    render(
      <FlowProvider flow={runFlow} options={{ autoStart: true }}>
        <RunProbe />
      </FlowProvider>,
    );

    // Enter the run step — run() is in flight.
    fireEvent.click(screen.getByText("next"));
    expect(screen.getByTestId("step").textContent).toBe("decide");
    expect(screen.getByTestId("running").textContent).toBe("true");

    // Settle the run: merges context, then auto-advances to `done`.
    await act(async () => {
      gate.resolve({ resolved: true });
      await gate.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("running").textContent).toBe("false");
      expect(screen.getByTestId("step").textContent).toBe("done");
    });
    expect(screen.getByTestId("resolved").textContent).toBe("true");
  });

  it("surfaces state.error when run rejects, and retry() re-runs", async () => {
    let attempt = 0;
    const gates = [deferred<Partial<RunCtx>>(), deferred<Partial<RunCtx>>()];
    const runFlow = defineFlow<RunCtx>({
      id: "run-error",
      initialContext: { resolved: false },
      steps: [
        { id: "start", next: "decide" },
        {
          id: "decide",
          next: "done",
          run: () => gates[attempt++]!.promise,
        },
        { id: "done", next: null },
      ],
    });

    function RunProbe() {
      const { state, next, retry } = useFlow<RunCtx>();
      return (
        <div>
          <span data-testid="step">{state.currentStepId ?? "none"}</span>
          <span data-testid="running">{String(state.running)}</span>
          <span data-testid="error">{state.error?.message ?? "none"}</span>
          <button onClick={next}>next</button>
          <button onClick={retry}>retry</button>
        </div>
      );
    }

    render(
      <FlowProvider flow={runFlow} options={{ autoStart: true }}>
        <RunProbe />
      </FlowProvider>,
    );

    fireEvent.click(screen.getByText("next")); // → decide, run in flight
    expect(screen.getByTestId("running").textContent).toBe("true");

    // First attempt rejects → error surfaces, stays on the step.
    await act(async () => {
      gates[0]!.reject(new Error("boom"));
      await gates[0]!.promise.catch(() => {});
    });

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("boom");
      expect(screen.getByTestId("running").textContent).toBe("false");
      expect(screen.getByTestId("step").textContent).toBe("decide");
    });

    // retry() clears the error and re-runs.
    await act(async () => {
      fireEvent.click(screen.getByText("retry"));
    });
    expect(screen.getByTestId("error").textContent).toBe("none");
    expect(screen.getByTestId("running").textContent).toBe("true");

    // Second attempt resolves → auto-advance to done.
    await act(async () => {
      gates[1]!.resolve({ resolved: true });
      await gates[1]!.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("step").textContent).toBe("done");
      expect(screen.getByTestId("running").textContent).toBe("false");
    });
    expect(attempt).toBe(2);
  });
});

describe("FlowProvider", () => {
  it("throws when hooks are used outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/must be used inside a <FlowProvider>/);
    spy.mockRestore();
  });

  it("throws when given neither flow nor engine", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <FlowProvider>
          <Probe />
        </FlowProvider>,
      ),
    ).toThrow(/needs either `flow` or `engine`/);
    spy.mockRestore();
  });
});
