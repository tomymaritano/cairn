# @cairn/ui

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

### Patch Changes

- Updated dependencies
  - @cairn/react@0.1.0
