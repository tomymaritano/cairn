"use client";

import { useMemo } from "react";
import { FlowEngine, FlowProvider, defineFlow, useFlow } from "react-cairn";
import { FlowGraph } from "cairn-devtools";

interface Ctx {
  highUsage: boolean;
}

// A small branching + async flow so the graph shows every badge
// (start / async / dynamic / end) and lights up as you drive it.
const flow = defineFlow<Ctx>({
  id: "devtools-demo",
  initialContext: { highUsage: false },
  steps: [
    {
      // A brief `run` so the flow auto-advances on Start — the point of the demo
      // is to watch it trace itself, with no manual "Next".
      id: "welcome",
      async run() {
        await new Promise((r) => setTimeout(r, 400));
      },
      next: "decide",
    },
    {
      id: "decide",
      async run() {
        await new Promise((r) => setTimeout(r, 700)); // "thinking"
      },
      next: (ctx) => (ctx.highUsage ? "billing" : "team"),
      meta: { targets: ["billing", "team"] }, // hint → dotted "possible" edges
    },
    { id: "billing", next: null },
    { id: "team", next: null },
  ],
});

export function FlowGraphDemo() {
  const engine = useMemo(() => new FlowEngine<Ctx>(flow), []);
  return (
    <FlowProvider engine={engine}>
      <div className="not-prose my-6 space-y-3">
        <Controls />
        <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card">
          <FlowGraph flow={flow} engine={engine} />
        </div>
      </div>
    </FlowProvider>
  );
}

function Controls() {
  const { state, start, reset, setContext } = useFlow<Ctx>();
  const active = state.status === "active";
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {active ? (
        <button onClick={reset} className="rounded-md border border-fd-border px-3 py-1.5 font-medium">
          ↺ Reset
        </button>
      ) : (
        <button onClick={start} className="rounded-md bg-fd-primary px-3 py-1.5 font-medium text-fd-primary-foreground">
          ▶ Run the flow
        </button>
      )}
      <label className="flex items-center gap-2 text-fd-muted-foreground">
        <input
          type="checkbox"
          disabled={state.running}
          checked={state.context.highUsage}
          onChange={(e) => setContext({ highUsage: e.target.checked })}
        />
        Usage 90% <span className="opacity-70">(flips the branch)</span>
      </label>
      <span className="ml-auto text-xs text-fd-muted-foreground">
        status: <code className="text-fd-foreground">{state.status}</code>
        {state.running && " · thinking…"}
      </span>
    </div>
  );
}
