import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FlowProvider, defineFlow, useFlow } from "@cairn/react";
import { CairnPopover } from "./popover.js";
import { CairnSpotlight } from "./spotlight.js";

afterEach(cleanup);

const flow = defineFlow({
  id: "tour",
  steps: [
    { id: "s1", next: "s2", meta: { target: "#anchor", title: "First step" } },
    { id: "s2", next: null, meta: { target: "#anchor", title: "Second step" } },
  ],
});

/** Buttons that drive the flow from inside the popover content. */
function Controls() {
  const { next, skip } = useFlow();
  return (
    <>
      <button onClick={next}>next</button>
      <button onClick={skip}>skip</button>
    </>
  );
}

function renderTour(autoStart = true) {
  return render(
    <FlowProvider flow={flow} options={{ autoStart }}>
      <div id="anchor">anchor</div>
      <CairnSpotlight />
      <CairnPopover>
        {(step) => (
          <div>
            <h3>{String(step.meta?.title)}</h3>
            <Controls />
          </div>
        )}
      </CairnPopover>
    </FlowProvider>,
  );
}

describe("CairnPopover", () => {
  it("renders an accessible dialog anchored to the active step", () => {
    renderTour();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("data-step")).toBe("s1");
    expect(dialog.getAttribute("aria-label")).toBe("First step");
    expect(screen.getByText("First step")).toBeDefined();
  });

  it("passes the current step to the render prop and advances", () => {
    renderTour();
    fireEvent.click(screen.getByText("next"));
    expect(screen.getByText("Second step")).toBeDefined();
    expect(screen.getByRole("dialog").getAttribute("data-step")).toBe("s2");
  });

  it("renders nothing when the flow is idle", () => {
    renderTour(false); // not started
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("disappears when the flow ends", () => {
    renderTour();
    fireEvent.click(screen.getByText("skip"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

/** A promise whose resolution we control from the test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("CairnPopover run state", () => {
  it("exposes data-cairn-running while a run step is in flight", async () => {
    const gate = deferred<void>();
    const runFlow = defineFlow({
      id: "run-tour",
      steps: [
        {
          id: "thinking",
          next: "done",
          meta: { target: "#anchor", title: "Thinking" },
          run: async () => {
            await gate.promise;
          },
        },
        { id: "done", next: null, meta: { target: "#anchor", title: "Done" } },
      ],
    });

    render(
      <FlowProvider flow={runFlow} options={{ autoStart: true }}>
        <div id="anchor">anchor</div>
        <CairnPopover>{(step) => <h3>{String(step.meta?.title)}</h3>}</CairnPopover>
      </FlowProvider>,
    );

    // The run is in flight: the popover root advertises the running state.
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("data-step")).toBe("thinking");
    expect(dialog.hasAttribute("data-cairn-running")).toBe(true);

    // Settle the run; it auto-advances and the running flag clears.
    await act(async () => {
      gate.resolve();
      await gate.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog").getAttribute("data-step")).toBe("done");
    });
    expect(screen.getByRole("dialog").hasAttribute("data-cairn-running")).toBe(false);
  });
});

describe("CairnSpotlight", () => {
  it("renders an aria-hidden highlight for the active step", () => {
    renderTour();
    const spotlight = document.querySelector("[data-cairn-spotlight]");
    expect(spotlight).not.toBeNull();
    expect(spotlight?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders nothing when idle", () => {
    renderTour(false);
    expect(document.querySelector("[data-cairn-spotlight]")).toBeNull();
  });
});
