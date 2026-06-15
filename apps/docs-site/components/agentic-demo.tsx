"use client";

import { useMemo } from "react";
import {
  FlowEngine,
  FlowProvider,
  defineFlow,
  useFlow,
} from "react-cairn";
import { CairnPopover } from "cairn-ui";

// ---------------------------------------------------------------------------
// Demo context + pluggable agent
// ---------------------------------------------------------------------------

type View = "dashboard" | "billing" | "team";

interface DemoCtx {
  /** Flips the mock user's state so the agent reasons toward a different route. */
  highUsage: boolean;
  /** Written by the `decide` step's `run` — the agent's chosen route + why. */
  route: View | null;
  reason: string | null;
}

/**
 * The agent seam. Anything "agent"-shaped lives here in userland, NOT in
 * cairn-core — the core only knows about an async `run` returning a context
 * patch. Swap `SimAgent` for an `LLMAgent` (same interface) to call a real
 * model behind a serverless route later; nothing else in the demo changes.
 */
interface DemoAgent {
  decide(ctx: DemoCtx, signal?: AbortSignal): Promise<{ next: View; reason: string }>;
}

/** Mocked "fetch" of the signals a real agent would pull before deciding. */
interface UserState {
  plan: "free" | "team";
  usagePct: number;
  seatsUsed: number;
  seatsTotal: number;
}

function fetchUserState(ctx: DemoCtx): Promise<UserState> {
  // Stand-in for an API call. Deterministic, no network, never flaky.
  return Promise.resolve({
    plan: "free",
    usagePct: ctx.highUsage ? 90 : 35,
    seatsUsed: 1,
    seatsTotal: 3,
  });
}

/**
 * Deterministic simulated agent: realistic ~700ms "thinking" delay, canned
 * reasoning derived from the (mock-fetched) user state. No API keys, no flake.
 *
 * To go live later, implement `DemoAgent` with a model call instead — e.g.
 *
 *   class LLMAgent implements DemoAgent {
 *     async decide(ctx: DemoCtx) {
 *       const state = await fetchUserState(ctx);
 *       const res = await fetch("/api/agent", { method: "POST", body: ... });
 *       return res.json(); // { next: View; reason: string }
 *     }
 *   }
 *
 * The `decide` step's `run` is written against `DemoAgent`, so the swap is
 * a one-line `const agent: DemoAgent = new LLMAgent()`.
 */
class SimAgent implements DemoAgent {
  async decide(ctx: DemoCtx, signal?: AbortSignal): Promise<{ next: View; reason: string }> {
    const state = await delay(700, () => fetchUserState(ctx), signal);
    if (state.usagePct >= 80) {
      return {
        next: "billing",
        reason: `You're on the ${state.plan} plan and at ${state.usagePct}% of your limit — routing you to billing to upgrade before you hit the wall.`,
      };
    }
    return {
      next: "team",
      reason: `Usage is healthy (${state.usagePct}%) and you've only filled ${state.seatsUsed}/${state.seatsTotal} seats — let's get your teammates on board.`,
    };
  }
}

/**
 * Real-LLM agent: posts the user state to `/api/agent`, which asks a model
 * (via the Vercel AI Gateway) for a structured `{ next, reason }`. Same
 * `DemoAgent` interface as `SimAgent` — that's the whole point of the seam.
 */
class LLMAgent implements DemoAgent {
  async decide(ctx: DemoCtx, signal?: AbortSignal): Promise<{ next: View; reason: string }> {
    const state = await fetchUserState(ctx);
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state }),
      signal,
    });
    if (!res.ok) throw new Error(`agent route ${res.status}`);
    return res.json();
  }
}

/** Tries the primary agent, falls back to the secondary on any error — so a
 *  disabled/rate-limited LLM route never breaks the public demo. */
class ResilientAgent implements DemoAgent {
  constructor(
    private readonly primary: DemoAgent,
    private readonly fallback: DemoAgent,
  ) {}
  async decide(ctx: DemoCtx, signal?: AbortSignal): Promise<{ next: View; reason: string }> {
    try {
      return await this.primary.decide(ctx, signal);
    } catch {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return this.fallback.decide(ctx, signal);
    }
  }
}

// Real AI is opt-in: set NEXT_PUBLIC_CAIRN_LLM=1 (client) + CAIRN_LLM_ENABLED=1
// (server) to use the model, with SimAgent as a safety net. Default: SimAgent.
const agent: DemoAgent =
  process.env.NEXT_PUBLIC_CAIRN_LLM === "1"
    ? new ResilientAgent(new LLMAgent(), new SimAgent())
    : new SimAgent();

function delay<T>(ms: number, fn: () => Promise<T> | T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal?.aborted) return abort();
    const id = setTimeout(() => {
      Promise.resolve().then(fn).then(resolve, reject);
    }, ms);
    // Forward the engine's cancellation: leaving the step clears the timer so
    // the simulated work actually stops (not just gets its result discarded).
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        abort();
      },
      { once: true },
    );
  });
}

// ---------------------------------------------------------------------------
// Flow — a `decide` step whose run() asks the agent, then branches on its pick
// ---------------------------------------------------------------------------

const flow = defineFlow<DemoCtx>({
  id: "docs-agentic-demo",
  initialContext: { highUsage: false, route: null, reason: null },
  steps: [
    {
      id: "welcome",
      next: "decide",
      meta: {
        target: "#agentic-demo-logo",
        placement: "bottom-start",
        title: "Welcome to Acme 👋",
        body: "This tour doesn't replay a fixed script — an agent decides where to send you next.",
      },
    },
    {
      // No UI: this step *thinks*. Its run() calls the agent, writes the chosen
      // route into context, then auto-advances via `next` (resolved against the
      // freshly-patched context).
      id: "decide",
      async run(ctx, signal) {
        const { next, reason } = await agent.decide(ctx, signal);
        return { route: next, reason };
      },
      next: (ctx) => ctx.route,
    },
    {
      id: "billing",
      next: null,
      meta: {
        target: "#agentic-demo-billing",
        placement: "bottom",
        title: "Upgrade your plan",
        body: "The agent routed you here because you're close to your usage limit.",
      },
    },
    {
      id: "team",
      next: null,
      meta: {
        target: "#agentic-demo-team",
        placement: "bottom-end",
        title: "Invite your team",
        body: "The agent routed you here because there's plenty of headroom — time to grow.",
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export function AgenticDemo() {
  const engine = useMemo(() => new FlowEngine<DemoCtx>(flow), []);
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
        {(step) => (
          <PopoverCard title={String(step.meta?.title)} body={String(step.meta?.body ?? "")} />
        )}
      </CairnPopover>
    </FlowProvider>
  );
}

function MockApp() {
  const { state } = useFlow<DemoCtx>();
  const view: View = viewForStep(state.currentStepId, state.context.route);
  const active = state.currentStepId;
  const ring = (id: string) =>
    `transition-shadow ${active === id ? "shadow-[0_0_0_3px_var(--color-fd-primary)] rounded-md" : ""}`;

  return (
    <div className="border-b border-fd-border">
      {/* Top chrome — switches the client-side view; no real navigation. */}
      <div className="flex items-center gap-3 bg-fd-secondary/40 px-4 py-3">
        <span id="agentic-demo-logo" className={`font-bold ${ring("welcome")}`}>
          ▲ Acme
        </span>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Tab label="Dashboard" current={view === "dashboard"} />
          <Tab id="agentic-demo-billing" label="Billing" current={view === "billing"} />
          <Tab id="agentic-demo-team" label="Team" current={view === "team"} />
        </nav>
      </div>

      {/* The active view's body. */}
      <div className="min-h-28 px-4 py-4 text-sm">
        {view === "dashboard" && (
          <p className="text-fd-muted-foreground">
            Your workspace overview. The agent reads your usage and seat data to
            decide where you should go next.
          </p>
        )}
        {view === "billing" && (
          <p className="text-fd-muted-foreground">
            <span className="font-semibold text-fd-foreground">Free plan.</span>{" "}
            Upgrade to lift your usage limits.
          </p>
        )}
        {view === "team" && (
          <p className="text-fd-muted-foreground">
            <span className="font-semibold text-fd-foreground">1 / 3 seats used.</span>{" "}
            Invite teammates to collaborate.
          </p>
        )}
      </div>
    </div>
  );
}

function Tab({ id, label, current }: { id?: string; label: string; current: boolean }) {
  return (
    <span
      id={id}
      className={`cursor-default rounded-md px-2.5 py-1 ${
        current
          ? "bg-fd-primary/10 font-medium text-fd-foreground"
          : "text-fd-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function PopoverCard({ title, body }: { title: string; body: string }) {
  const { state, back, skip, dismiss } = useFlow<DemoCtx>();
  const last = state.currentStep?.next == null;
  return (
    <>
      <div className="mb-1 text-xs text-fd-muted-foreground">
        Step {state.stepIndex + 1} / {state.totalSteps}
      </div>
      <div className="mb-1 font-semibold text-fd-foreground">{title}</div>
      <p className="mb-2 text-fd-muted-foreground">{body}</p>
      {state.context.reason && (
        <p className="mb-3 rounded-md border border-fd-border bg-fd-secondary/40 p-2 text-xs text-fd-muted-foreground">
          <span className="font-semibold text-fd-foreground">Agent reasoning: </span>
          {state.context.reason}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={back}
          disabled={state.history.length < 2}
          className="rounded-md border border-fd-border px-2.5 py-1 text-xs disabled:opacity-40"
        >
          Back
        </button>
        {last ? (
          <button
            onClick={dismiss}
            className="rounded-md bg-fd-primary px-2.5 py-1 text-xs text-fd-primary-foreground"
          >
            Finish
          </button>
        ) : (
          <button
            onClick={skip}
            className="rounded-md px-2.5 py-1 text-xs text-fd-muted-foreground"
          >
            Skip
          </button>
        )}
      </div>
    </>
  );
}

function Controls() {
  const { state, start, reset, setContext, goTo } = useFlow<DemoCtx>();
  const active = state.status === "active";
  return (
    <div className="flex flex-col gap-3 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {active ? (
          <button
            onClick={reset}
            className="rounded-md border border-fd-border px-3 py-1.5 font-medium"
          >
            ↺ Reset
          </button>
        ) : (
          <button
            onClick={start}
            className="rounded-md bg-fd-primary px-3 py-1.5 font-medium text-fd-primary-foreground"
          >
            ▶ Let the agent guide me
          </button>
        )}
        <label className="flex items-center gap-2 text-fd-muted-foreground">
          <input
            type="checkbox"
            // Disabled mid-think: you can't change the agent's inputs while it's
            // deciding (that would race the in-flight run). Change it, and if a
            // tour is live, re-run `decide` so the agent re-decides cleanly.
            disabled={state.running}
            checked={state.context.highUsage}
            onChange={(e) => {
              setContext({ highUsage: e.target.checked });
              if (state.status === "active") goTo("decide");
            }}
          />
          Usage 90%{" "}
          <span className="opacity-70">(makes the agent pick a different route)</span>
        </label>
        <span className="ml-auto text-xs text-fd-muted-foreground">
          status: <code className="text-fd-foreground">{state.status}</code>
        </span>
      </div>

      {/* The "thinking…" state, read straight off state.running. */}
      {state.running && (
        <div className="flex items-center gap-2 rounded-md border border-fd-border bg-fd-secondary/40 px-3 py-2 text-xs text-fd-muted-foreground">
          <Spinner />
          Agent thinking — reading your usage and seat data…
        </div>
      )}

      {/* The cross-view route the agent chose, once it has decided. */}
      {!state.running && state.context.route && (
        <div className="rounded-md border border-fd-border bg-fd-secondary/40 px-3 py-2 text-xs text-fd-muted-foreground">
          <span className="font-semibold text-fd-foreground">Agent chose: </span>
          <code className="text-fd-foreground">{state.context.route}</code>
          {state.context.reason && <> — {state.context.reason}</>}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3 animate-spin rounded-full border-2 border-fd-border border-t-fd-primary"
    />
  );
}

/** Which client-side view to show for the current step (and agent route). */
function viewForStep(stepId: string | null, route: View | null): View {
  if (stepId === "billing") return "billing";
  if (stepId === "team") return "team";
  // While deciding, keep showing the last decided route if any, else dashboard.
  if (stepId === "decide" && route) return route;
  return "dashboard";
}
