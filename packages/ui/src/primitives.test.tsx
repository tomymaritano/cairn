import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FlowProvider, defineFlow } from "cairn-react";
import { CairnProgress } from "./progress.js";
import { CairnBeacon } from "./beacon.js";

afterEach(cleanup);

const flow = defineFlow({
  id: "tour",
  steps: [
    { id: "a", next: "b", meta: { target: "#anchor", title: "First" } },
    { id: "b", next: "c" },
    { id: "c", next: null },
  ],
});

function withProvider(ui: React.ReactNode, autoStart = true) {
  return render(
    <FlowProvider flow={flow} options={{ autoStart }}>
      <div id="anchor">anchor</div>
      {ui}
    </FlowProvider>,
  );
}

describe("CairnProgress", () => {
  it("shows the count and a dot per step when active", () => {
    const { container } = withProvider(<CairnProgress />);
    expect(screen.getByText("1 / 3")).toBeDefined();
    expect(container.querySelectorAll("[data-cairn-dot]").length).toBe(3);
    expect(container.querySelector('[data-cairn-dot="active"]')).not.toBeNull();
  });

  it("renders nothing when the flow is idle", () => {
    const { container } = withProvider(<CairnProgress />, false);
    expect(container.querySelector("[data-cairn-progress]")).toBeNull();
  });
});

describe("CairnBeacon", () => {
  it("renders an accessible button for the active step's target", () => {
    withProvider(<CairnBeacon />);
    const beacon = screen.getByRole("button", { name: "Continue: First" });
    expect(beacon).toBeDefined();
  });

  it("advances the flow when clicked", () => {
    const Probe = () => {
      return <CairnBeacon />;
    };
    const { container } = render(
      <FlowProvider flow={flow} options={{ autoStart: true }}>
        <div id="anchor">anchor</div>
        <Probe />
        <CairnProgress />
      </FlowProvider>,
    );
    expect(screen.getByText("1 / 3")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Continue: First" }));
    expect(screen.getByText("2 / 3")).toBeDefined();
    void container;
  });

  it("renders nothing when idle", () => {
    const { container } = withProvider(<CairnBeacon />, false);
    expect(container.querySelector("[data-cairn-beacon]")).toBeNull();
  });
});
