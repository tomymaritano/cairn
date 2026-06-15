"use client";

import { useMemo } from "react";
import {
  FlowEngine,
  FlowProvider,
  defineFlow,
  useFlow,
} from "@cairn/react";
import { CairnPopover } from "@cairn/ui";

interface Ctx {
  teamPlan: boolean;
}

// Unique selectors so the popover anchors correctly even inside docs.
const flow = defineFlow<Ctx>({
  id: "docs-live-demo",
  initialContext: { teamPlan: false },
  steps: [
    { id: "welcome", next: "search", meta: { target: "#cairn-demo-logo", placement: "bottom-start", title: "Welcome to Acme 👋", body: "A 3-step tour — driven by a real Cairn state machine." } },
    { id: "search", next: "billing", meta: { target: "#cairn-demo-search", placement: "bottom", title: "Search anything", body: "Steps can point at any element on the page." } },
    { id: "billing", next: (ctx) => (ctx.teamPlan ? "invite" : null), meta: { target: "#cairn-demo-billing", placement: "bottom", title: "Billing", body: "On a team plan? The flow branches to an extra step." } },
    { id: "invite", next: null, meta: { target: "#cairn-demo-invite", placement: "bottom-end", title: "Invite your team 🎉", body: "You only see this step on the team plan — that's branching." } },
  ],
});

export function LiveDemo() {
  const engine = useMemo(() => new FlowEngine<Ctx>(flow), []);
  return (
    <FlowProvider engine={engine}>
      <div className="not-prose my-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
        <MockApp />
        <Controls />
      </div>
      {/* Anchored, accessible popover — won't steal clicks/focus from the docs. */}
      <CairnPopover
        className="w-72 rounded-xl border border-fd-border bg-fd-popover p-4 text-sm shadow-xl"
        trapFocus={false}
        dismissOnInteractOutside={false}
      >
        {(step) => <PopoverCard title={String(step.meta?.title)} body={String(step.meta?.body ?? "")} />}
      </CairnPopover>
    </FlowProvider>
  );
}

function MockApp() {
  const { state } = useFlow<Ctx>();
  const active = state.currentStepId;
  const ring = (id: string) =>
    `transition-shadow ${active === id ? "shadow-[0_0_0_3px_var(--color-fd-primary)] rounded-md" : ""}`;

  return (
    <div className="flex items-center gap-3 border-b border-fd-border bg-fd-secondary/40 px-4 py-3">
      <span id="cairn-demo-logo" className={`font-bold ${ring("welcome")}`}>▲ Acme</span>
      <input
        id="cairn-demo-search"
        readOnly
        placeholder="Search…"
        className={`ml-auto w-32 rounded-md border border-fd-border bg-fd-background px-2 py-1 text-sm ${ring("search")}`}
      />
      <span id="cairn-demo-billing" className={`cursor-default rounded-md px-2 py-1 text-sm ${ring("billing")}`}>Billing</span>
      <button id="cairn-demo-invite" className={`rounded-md bg-fd-primary px-3 py-1 text-sm text-fd-primary-foreground ${ring("invite")}`}>
        Invite
      </button>
    </div>
  );
}

function PopoverCard({ title, body }: { title: string; body: string }) {
  const { state, next, back, skip } = useFlow<Ctx>();
  return (
    <>
      <div className="mb-1 text-xs text-fd-muted-foreground">
        Step {state.stepIndex + 1} / {state.totalSteps}
      </div>
      <div className="mb-1 font-semibold text-fd-foreground">{title}</div>
      <p className="mb-3 text-fd-muted-foreground">{body}</p>
      <div className="flex gap-2">
        <button onClick={back} disabled={state.history.length < 2} className="rounded-md border border-fd-border px-2.5 py-1 text-xs disabled:opacity-40">
          Back
        </button>
        <button onClick={next} className="rounded-md bg-fd-primary px-2.5 py-1 text-xs text-fd-primary-foreground">
          {state.currentStep?.next == null ? "Finish" : "Next"}
        </button>
        <button onClick={skip} className="rounded-md px-2.5 py-1 text-xs text-fd-muted-foreground">
          Skip
        </button>
      </div>
    </>
  );
}

function Controls() {
  const { state, start, reset, setContext } = useFlow<Ctx>();
  const running = state.status === "active";
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      {running ? (
        <button onClick={reset} className="rounded-md border border-fd-border px-3 py-1.5 font-medium">
          ↺ Reset
        </button>
      ) : (
        <button onClick={start} className="rounded-md bg-fd-primary px-3 py-1.5 font-medium text-fd-primary-foreground">
          ▶ Start the tour
        </button>
      )}
      <label className="flex items-center gap-2 text-fd-muted-foreground">
        <input
          type="checkbox"
          checked={state.context.teamPlan}
          onChange={(e) => setContext({ teamPlan: e.target.checked })}
        />
        Team plan <span className="opacity-70">(adds the “invite” step via branching)</span>
      </label>
      <span className="ml-auto text-xs text-fd-muted-foreground">
        status: <code className="text-fd-foreground">{state.status}</code>
      </span>
    </div>
  );
}
