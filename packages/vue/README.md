# @cairn/vue

Vue 3 bindings for [Cairn](https://github.com/tomymaritano/cairn) — the
workflow engine for onboarding, product adoption, and user guidance. Composables
over the framework-agnostic [`@cairn/core`](https://www.npmjs.com/package/@cairn/core)
engine (which this package re-exports, so it's the only install you need).

```bash
npm i @cairn/vue
```

```vue
<script setup lang="ts">
import { provideFlow, useFlow, defineFlow } from "@cairn/vue";

const onboarding = defineFlow({
  id: "onboarding",
  steps: [
    { id: "welcome", next: "profile", meta: { title: "Welcome 👋" } },
    { id: "profile", next: null },
  ],
});

provideFlow(onboarding, { autoStart: true });
const { state, next, skip } = useFlow();
</script>

<template>
  <div v-if="state.currentStep">
    <h3>{{ state.currentStep.meta?.title ?? state.currentStep.id }}</h3>
    <small>Step {{ state.stepIndex + 1 }} / {{ state.totalSteps }}</small>
    <button @click="next">Next</button>
    <button @click="skip">Skip</button>
  </div>
</template>
```

## API

- **`provideFlow(flowOrEngine, options?)`** — build (or adopt) the engine and
  provide it to descendants. Owns + destroys the engine when given a definition;
  adopts it when given a `FlowEngine`. Returns the engine.
- **`useFlow()`** — inject the engine; returns a reactive `state` ref (updated on
  every transition) plus controls: `start`, `next`, `back`, `goTo`, `skip`,
  `dismiss`, `setContext`, `retry`.
- **`useCurrentStep()`** — a `computed` ref of the active step (or `null`).

Everything from `@cairn/core` (branching, `canEnter` guards, async `run` steps,
persistence adapters, the typed event stream) works unchanged — Vue just renders
it.

📖 **[Full documentation & live demo →](https://react-cairn.vercel.app)**
