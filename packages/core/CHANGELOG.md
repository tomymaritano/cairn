# @cairn/core

## 0.2.0

### Minor Changes

- Agentic guidance: steps can now run async actions and branch on the result.

  - **@cairn/core**: `StepDefinition` gains `run?: (ctx, signal) => Promise<Partial<C> | void>` and `onError`. On entering a `run` step the engine sets `state.running`, awaits the action, merges the returned patch, and auto-advances via `next` (resolved against the updated context). Adds `state.running` / `state.error`, a `retry()` method, and `step:run:start` / `step:run:success` / `step:run:error` events. In-flight runs are cancelled (via an `AbortSignal` + generation token) when the flow leaves the step, including via `back()`. Flows without `run` stay fully synchronous and unchanged.
  - **@cairn/react**: `useFlow()` surfaces `state.running` / `state.error` and a `retry()` control.
  - **@cairn/ui**: `<CairnPopover>` exposes a `data-cairn-running` attribute while a `run` step is in flight, for styling a "thinking" state.

## 0.1.0

### Minor Changes

- Initial public release of Cairn — the workflow engine for onboarding, product
  adoption, and user guidance.

  - `@cairn/core`: framework-agnostic state-machine engine with branching,
    guards, history, a typed event stream, and persistence/resume adapters.
  - `@cairn/react`: React bindings (`<FlowProvider>`, `useFlow`,
    `useCurrentStep`) built on `useSyncExternalStore`.
  - `@cairn/ui`: headless, accessible primitives (`<CairnSpotlight>`,
    `<CairnPopover>`) powered by Floating UI.
