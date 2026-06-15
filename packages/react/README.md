# @cairn/react

React bindings for [Cairn](https://github.com/tomymaritano/cairn) — the
workflow engine for onboarding, product adoption, and user guidance. Built on
`useSyncExternalStore` (concurrent-safe). Re-exports the entire
[`@cairn/core`](https://www.npmjs.com/package/@cairn/core) surface, so this is
the only package you need.

```bash
npm i @cairn/react
```

```tsx
import { FlowProvider, defineFlow, useFlow } from "@cairn/react";

const onboarding = defineFlow({
  id: "onboarding",
  steps: [
    { id: "welcome", next: "profile", meta: { title: "Welcome 👋" } },
    { id: "profile", next: null },
  ],
});

function App() {
  return (
    <FlowProvider flow={onboarding} options={{ autoStart: true }}>
      <Tour />
    </FlowProvider>
  );
}

function Tour() {
  const { state, next, skip } = useFlow();
  const step = state.currentStep;
  if (!step) return null;
  return (
    <div>
      <h3>{String(step.meta?.title ?? step.id)}</h3>
      <button onClick={next}>Next</button>
      <button onClick={skip}>Skip</button>
    </div>
  );
}
```

Want accessible popover + spotlight out of the box? Add
[`@cairn/ui`](https://www.npmjs.com/package/@cairn/ui).

📖 **[Full documentation →](https://github.com/tomymaritano/cairn)**
