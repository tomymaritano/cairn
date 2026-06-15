# Agentic Guidance — `run` steps + multi-route demo

**Date:** 2026-06-15
**Status:** Approved (design)
**Packages affected:** `cairn-core` (0.2.0), `cairn-react` (0.2.0), `apps/docs-site` (demo)

## Goal

Make Cairn flows _reason_, not just play back a fixed script. A step can run an
async action (`run`) that fetches state, calls an API, or asks an LLM, write
the result into the flow context, and **branch on it** — while the output stays
what Cairn is good at: UI guidance.

This is the **"agentic guidance"** positioning: defensible, in Cairn's niche
(onboarding / product adoption), and unlike static tour libraries
(react-joyride, Shepherd, Intro.js).

**Non-goal:** Cairn does not become a general agent-orchestration engine
(LangGraph/Inngest territory), and the core API does **not** model "agents" —
it models flows and steps. `run` is just an async function returning a context
patch. Anything "agent"-shaped lives in userland / the demo.

## Decisions (resolved during brainstorming)

- Field name: **`run`**.
- `retry()` and `onError` ship in **v0.2** (error handling is not optional for
  async/LLM calls).
- The headline demo lives in **`apps/docs-site`**.
- Demo agent is **pluggable**: `SimAgent` now (self-contained, no keys),
  `LLMAgent` (Vercel AI Gateway) later behind the same interface.

## 1. Core: `cairn-core` v0.2 — async `run` steps

### API additions

`StepDefinition<C>` gains two optional fields:

```ts
interface StepDefinition<C> {
  id: string;
  next?: StepTarget<C>;
  canEnter?: StepGuard<C>;
  meta?: Record<string, unknown>;
  // NEW
  run?: (ctx: Readonly<C>, signal: AbortSignal) => Promise<Partial<C> | void>;
  onError?: StepTarget<C>; // where to go if run() rejects; default: stay + expose error
}
```

`FlowState<C>` gains:

```ts
running: boolean;     // a run() is in flight for the current step
error: Error | null;  // last run() rejection on the current step
```

New engine method: `retry()` — re-executes the current step's `run` (clears `error`).

New events: `step:run:start`, `step:run:success`, `step:run:error`.

### Semantics on entering a step

- **No `run`** → identical to today: synchronous, waits for `engine.next()`.
  **100% backward-compatible** — existing flows never touch the async path.
- **Has `run`**:
  1. Set `running = true`, emit `step:run:start`.
  2. `await run(ctx, signal)`.
  3. **Success** → merge the returned `Partial<C>` (if any) into context, emit
     `step:run:success`, set `running = false`, then **auto-advance** via `next`
     (resolved against the now-updated context).
  4. **Error** → emit `step:run:error`, set `running = false`. If `onError` is
     set, transition there; otherwise set `state.error` and stay on the step.

### Cancellation

If the flow leaves the step (`skip` / `dismiss` / `goTo` / `reset` / `back`)
while a `run` is in flight, the step's `AbortSignal` aborts and the
resolved/rejected result is **discarded** (no stale writes, no stale
auto-advance). Implemented with a per-run generation token: only the latest
run for the current step may mutate state.

### Interactions

- **Guards:** auto-advance after `run` respects the next step's `canEnter`
  (same `enter()` path, including loop protection).
- **Persistence:** the snapshot is persisted when a `run` **settles**, never
  mid-flight. A resumed flow whose saved step has a `run` re-runs it on resume
  (runs are assumed idempotent/safe; documented).
- **`next()` while running:** ignored (no-op) to avoid double transitions.

### Sync purity

The async machinery is fully isolated behind "does this step have `run`?".
Flows without `run` keep the current synchronous behaviour and the existing 16
core tests must stay green unchanged.

## 2. `cairn-react` v0.2

- `useFlow()` `state` now surfaces `running` and `error`.
- `FlowControls` gains `retry()`.
- No breaking changes; renderers opt into showing a "thinking…" state.

## 3. `cairn-ui`

Minimal / YAGNI: `<CairnPopover>` content already reads `useFlow()`, so it can
show a spinner when `running` without an API change. Add a small
`data-cairn-running` attribute on the popover root for styling hooks. No new
exports unless the demo proves a need.

## 4. Demo: multi-route agentic onboarding (`apps/docs-site`)

A self-contained widget embedded in the docs (sibling to the existing
`LiveDemo`).

- **Mini-app with multiple views** switched client-side (`dashboard` →
  `billing` → `team`) inside the demo box — no real navigation, fully
  contained.
- A Cairn flow with a `decide` step whose `run` "thinks": it reads mock user
  state and calls a **pluggable agent**.
- **Agent interface (demo-only, not core):**
  ```ts
  interface DemoAgent {
    decide(ctx: DemoCtx): Promise<{ next: string; reason: string }>;
  }
  ```
  - `SimAgent`: realistic delay, canned reasoning derived from `ctx`, mock
    fetch. Deterministic, no keys, never flaky.
  - `LLMAgent` (later): same interface, calls a real model via Vercel AI
    Gateway behind a serverless route. Out of scope for this spec; the
    interface is the seam.
- **What the visitor sees:** the "agent thinking…" state, the agent's
  **reasoning** ("you're on the free plan and near your limit → routing to
  upgrade"), **cross-view** guidance chosen by the agent, and a toggle
  (e.g. "usage 90%") to watch the agent **pick a different route** live.
- **Why it beats react-joyride/multi-route:** theirs replays a fixed
  cross-route script; ours **reasons** the route, shows the reasoning, and runs
  self-contained in static docs.

## 5. Testing

**core (`cairn-core`):**

- `run` success → context patched → auto-advance to resolved `next`.
- `run` rejects with `onError` set → transitions to `onError` target.
- `run` rejects without `onError` → `state.error` set, stays; `retry()` clears
  error and re-runs.
- branching reads the patched context (decision after `run`).
- cancellation: leaving the step mid-run aborts and discards the result.
- backward-compat: a flow with no `run` behaves exactly as before; the existing
  suite passes unchanged.
- event order: `step:enter` → `step:run:start` → `step:run:success` →
  (`step:exit` → `step:enter`)…

**react (`cairn-react`):**

- `state.running` toggles around a `run` step; `state.error` surfaces on
  failure; `retry()` re-runs.

**demo:** covered by the docs build; a smoke test that `SimAgent.decide`
returns a valid step id for representative contexts.

## 6. Versioning / release

- `cairn-core`: **minor → 0.2.0** (additive, backward-compatible).
- `cairn-react`: **minor → 0.2.0** (surfaces `running`/`error`/`retry`; depends
  on `cairn-core@0.2.0`).
- `cairn-ui`: patch/minor only if the popover styling hook is added.
- One changeset describes the feature. Publish via CI (automation token) or
  the manual `pnpm -r publish` path.

## Build sequence

1. `cairn-core` `run` semantics + tests.
2. `cairn-react` surfaces `running` / `error` / `retry` + tests.
3. Multi-route agentic demo with `SimAgent` in `apps/docs-site`.
4. `LLMAgent` adapter — interface ready now, implementation later (own spec).

## Open questions / risks

- **Resume + `run`:** re-running `run` on resume assumes idempotency. Documented
  as a constraint; a future `runOnce` flag could opt out. Not in v0.2.
- **`next()` semantics for `run` steps:** auto-advance is the default; a future
  `manual: true` could let a `run` step wait for user confirmation before
  advancing. Not in v0.2.
