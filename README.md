<div align="center">

# Cairn

**The workflow engine for onboarding, product adoption, and user guidance.**

Cairn /kɛrn/ — _the stacked stones that mark a trail. You place the markers; your users find the way._

[![license](https://img.shields.io/badge/license-MIT-black)](./LICENSE)

</div>

---

Cairn is **not another tooltip or product-tour library**. It's a **state-machine-driven workflow engine** for guiding users through your product — multi-page flows, branching paths, live context, and a first-class event stream for analytics.

The engine is **framework-agnostic**; React is the first official binding (Vue and Svelte to follow). A visual flow builder is on the roadmap.

## Why Cairn

|  | Tour libraries (Joyride, Shepherd, Intro.js) | **Cairn** |
|--|----------------------------------------------|-----------|
| Mental model | A linear list of tooltips | A **state machine** of waypoints |
| Branching | ✗ | ✓ context-driven `next()` |
| Multi-page flows | painful | ✓ engine survives navigation |
| Analytics | bolt-on | ✓ typed event stream, built in |
| Renderer | coupled to the DOM | **decoupled** core + adapters |
| TypeScript | partial | **TypeScript-first**, fully inferred |

## Install

```bash
npm i @cairn/react        # React bindings (re-exports the core)
# or just the engine, for any framework / a custom renderer:
npm i @cairn/core
```

## Quickstart

```tsx
import { FlowProvider, defineFlow, useFlow } from "@cairn/react";

// 1. Define a flow. `next` can branch on live context.
const onboarding = defineFlow<{ hasTeam: boolean }>({
  id: "onboarding",
  initialContext: { hasTeam: false },
  steps: [
    { id: "welcome", next: "profile", meta: { target: "#logo", title: "Welcome 👋" } },
    { id: "profile", next: (ctx) => (ctx.hasTeam ? "invite" : null) },
    { id: "invite",  next: null, meta: { target: "#invite-btn" } },
  ],
});

// 2. Wrap your app.
function App() {
  return (
    <FlowProvider flow={onboarding} options={{ autoStart: true }}>
      <Tour />
    </FlowProvider>
  );
}

// 3. Render the current waypoint however you want — Cairn owns the logic, you own the UI.
function Tour() {
  const { state, next, back, skip, setContext } = useFlow<{ hasTeam: boolean }>();
  const step = state.currentStep;
  if (!step) return null;

  return (
    <div data-step={step.id}>
      <h3>{String(step.meta?.title ?? step.id)}</h3>
      <small>Step {state.stepIndex + 1} / {state.totalSteps}</small>
      <button onClick={back}>Back</button>
      <button onClick={next}>Next</button>
      <button onClick={skip}>Skip</button>
    </div>
  );
}
```

## Headless UI, if you want it

`@cairn/ui` gives you an accessible popover (positioned with Floating UI:
flip, shift, follows the target through scroll) and a spotlight overlay. Cairn
owns positioning and a11y; **you own the content and styling**.

```tsx
import { CairnSpotlight, CairnPopover } from "@cairn/ui";

<FlowProvider engine={engine}>
  <App />
  <CairnSpotlight padding={6} />
  <CairnPopover className="my-card">
    {(step) => (
      <>
        <h3>{String(step.meta?.title)}</h3>
        <Controls />
      </>
    )}
  </CairnPopover>
</FlowProvider>;
```

Prefer your own components? Skip `@cairn/ui` entirely and render from
`useFlow()` — the engine doesn't care.

## Analytics, for free

Every transition is a typed event. Pipe the firehose to PostHog, Segment, anything:

```ts
import { FlowEngine } from "@cairn/core";

const engine = new FlowEngine(onboarding);
engine.onAny((event) => {
  analytics.track(event.type, { flowId: event.flowId, step: event.state.currentStepId });
});
```

Events: `flow:start` · `step:enter` · `step:exit` · `flow:complete` · `flow:skip` · `flow:dismiss` · `context:update`.

## Persistence (resume across reloads)

Onboarding spans sessions. Point Cairn at any key-value store and it resumes
where the user left off — and won't re-show a flow they already finished.

```ts
import { FlowEngine, createWebStorageAdapter } from "@cairn/core";

const engine = new FlowEngine(onboarding, {
  persistence: {
    adapter: createWebStorageAdapter(), // localStorage by default
    namespace: currentUser.id,          // optional: persist per-user
  },
});

engine.start();  // resumes if there's saved progress, else starts fresh
engine.reset();  // clear progress and replay from the top
```

Bring your own store by implementing three methods — `load`, `save`, `remove`.

## Packages

| Package | What it is |
|---------|------------|
| [`@cairn/core`](./packages/core) | Framework-agnostic state-machine engine. Zero dependencies. |
| [`@cairn/react`](./packages/react) | React bindings: `<FlowProvider>`, `useFlow()`, `useCurrentStep()`. |
| [`@cairn/ui`](./packages/ui) | Headless, accessible primitives: `<CairnSpotlight>`, `<CairnPopover>`. |

## Roadmap

- [x] Framework-agnostic engine (branching, guards, history, events)
- [x] React bindings (`useSyncExternalStore`, concurrent-safe)
- [x] Persistence adapters (resume a flow across sessions)
- [x] Headless UI primitives (`@cairn/ui`) — accessible popover + spotlight
- [ ] Vue & Svelte adapters
- [ ] **Visual flow builder**

## License

MIT
