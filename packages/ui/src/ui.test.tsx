import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FlowProvider, defineFlow, useFlow } from "react-cairn";
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
