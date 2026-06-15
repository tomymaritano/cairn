import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineFlow } from "@cairn/core";
import { FlowProvider } from "./context.js";
import { useCurrentStep, useFlow } from "./hooks.js";

afterEach(cleanup);

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
