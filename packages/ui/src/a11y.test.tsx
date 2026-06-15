import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { FlowProvider, defineFlow, useFlow } from "cairn-react";
import { CairnPopover } from "./popover.js";
import { CairnSpotlight } from "./spotlight.js";

afterEach(cleanup);

const flow = defineFlow({
  id: "tour",
  steps: [{ id: "s1", next: null, meta: { target: "#anchor", title: "First step" } }],
});

function Controls() {
  const { next } = useFlow();
  return <button onClick={next}>next</button>;
}

function renderTour() {
  return render(
    <FlowProvider flow={flow} options={{ autoStart: true }}>
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

describe("accessibility", () => {
  it("the active tour has no axe violations", async () => {
    renderTour();
    // The popover is portaled to body, so scan the whole document — but exclude
    // Floating UI's focus-guard sentinels (inert 1px spans with role=button that
    // axe flags as unnamed commands; they're an internal focus-management trick).
    const results = await axe.run(
      { include: [["body"]], exclude: [["[data-floating-ui-focus-guard]"]] },
      {
        rules: {
          // jsdom can't compute layout → color-contrast isn't meaningful.
          "color-contrast": { enabled: false },
          // Page-structure rules don't apply to a component test fixture.
          region: { enabled: false },
          "landmark-one-main": { enabled: false },
          "page-has-heading-one": { enabled: false },
        },
      },
    );
    expect(results.violations).toEqual([]);
  });

  it("drops the spotlight transition when prefers-reduced-motion is set", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { container } = renderTour();
    // Find the spotlight (portaled to body).
    const spotlight = document.querySelector<HTMLElement>("[data-cairn-spotlight]");
    expect(spotlight).not.toBeNull();
    expect(spotlight!.style.transition).toBe("none");
    vi.unstubAllGlobals();
    void container;
  });
});
