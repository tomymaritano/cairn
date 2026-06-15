# @cairn/svelte

Svelte bindings for [Cairn](https://github.com/tomymaritano/cairn) — the
workflow engine for onboarding, product adoption, and user guidance. A Svelte
**store** + controls over the framework-agnostic
[`@cairn/core`](https://www.npmjs.com/package/@cairn/core) engine (re-exported, so
it's the only install you need). Works with Svelte 4 and 5.

```bash
npm i @cairn/svelte
```

```svelte
<script>
  import { createFlow, defineFlow } from "@cairn/svelte";

  const onboarding = defineFlow({
    id: "onboarding",
    steps: [
      { id: "welcome", next: "profile", meta: { title: "Welcome 👋" } },
      { id: "profile", next: null },
    ],
  });

  const flow = createFlow(onboarding, { autoStart: true });
  const { state } = flow;
</script>

{#if $state.currentStep}
  <div>
    <h3>{$state.currentStep.meta?.title ?? $state.currentStep.id}</h3>
    <small>Step {$state.stepIndex + 1} / {$state.totalSteps}</small>
    <button on:click={flow.next}>Next</button>
    <button on:click={flow.skip}>Skip</button>
  </div>
{/if}
```

## API

**`createFlow(flowOrEngine, options?)`** returns:

- **`state`** — a Svelte `readable` store of the live flow state. Use `$state`
  in markup; it updates on every transition.
- **controls** — `start`, `next`, `back`, `goTo`, `skip`, `dismiss`,
  `setContext`, `retry`.
- **`engine`** — the underlying `FlowEngine`, for `engine.on(...)` event
  subscriptions or advanced use.

Cairn's engine exposes a `subscribe(listener) => unsubscribe` contract — the
same shape a Svelte store wants — so the binding is a thin `readable` wrapper.
All core features (branching, `canEnter` guards, async `run` steps, persistence,
the typed event stream) work unchanged.

📖 **[Full documentation & live demo →](https://react-cairn.vercel.app)**
