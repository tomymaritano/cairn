# cairn-core

The framework-agnostic state-machine engine behind
[Cairn](https://github.com/tomymaritano/cairn) — the workflow engine for
onboarding, product adoption, and user guidance. Zero dependencies.

```bash
npm i cairn-core
```

```ts
import { FlowEngine, defineFlow } from "cairn-core";

const flow = defineFlow<{ hasTeam: boolean }>({
  id: "onboarding",
  initialContext: { hasTeam: false },
  steps: [
    { id: "welcome", next: "profile" },
    { id: "profile", next: (ctx) => (ctx.hasTeam ? "invite" : null) },
    { id: "invite", next: null },
  ],
});

const engine = new FlowEngine(flow, { autoStart: true });
engine.onAny((e) => console.log(e.type, e.state.currentStepId));
engine.next();
```

Features: branching (`next` resolves on live context), `canEnter` guards,
history/back-navigation, a typed event stream for analytics, and
persistence/resume adapters.

Using React? Install [`react-cairn`](https://www.npmjs.com/package/react-cairn)
instead — it re-exports this package.

📖 **[Full documentation & live demo →](https://react-cairn.vercel.app)**
