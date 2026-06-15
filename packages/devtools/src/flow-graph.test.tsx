import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FlowEngine, defineFlow } from "@cairn/core";
import { FlowGraph } from "./flow-graph.js";

afterEach(cleanup);

interface Ctx {
  plan: "free" | "team";
}

const flow = defineFlow<Ctx>({
  id: "f",
  initialContext: { plan: "free" },
  steps: [
    { id: "a", next: "b" },
    { id: "b", next: null },
  ],
});

// React Flow needs a real layout engine to paint nodes, which jsdom lacks — so
// these are render smokes: the component mounts and its container is present.
// The graph *model* is covered by build-graph.test.ts.
describe("<FlowGraph>", () => {
  it("renders its container without crashing (static)", () => {
    const { container } = render(<FlowGraph flow={flow} />);
    expect(container.querySelector("[data-cairn-flowgraph]")).not.toBeNull();
  });

  it("accepts a live engine without crashing", () => {
    const engine = new FlowEngine<Ctx>(flow, { autoStart: true });
    const onSelectStep = vi.fn();
    const { container } = render(
      <FlowGraph flow={flow} engine={engine} onSelectStep={onSelectStep} direction="LR" />,
    );
    expect(container.querySelector("[data-cairn-flowgraph]")).not.toBeNull();
  });
});
