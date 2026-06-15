# cairn-devtools

Visualize [Cairn](https://github.com/tomymaritano/cairn) flows as a graph — the
static structure, and the **live runtime trace** as a flow runs.

```bash
npm i cairn-devtools
```

```tsx
import { FlowGraph } from "cairn-devtools";
import "@xyflow/react/dist/style.css"; // once, app-wide

// Static structure:
<FlowGraph flow={onboarding} />

// Live: pass a running engine and the graph highlights the current step,
// the visited path, running/error state, and the edges actually taken.
<FlowGraph flow={onboarding} engine={engine} direction="LR" />
```

## What it shows

- **Edges** — solid for string `next`, dashed red for `onError`, dotted for the
  *possible* targets of a dynamic step (from `meta.targets`).
- **Badges** — `start`, `end`, `async` (`run` steps), `guard` (`canEnter`),
  `dynamic` (function `next`/`onError`).
- **Live trace** (`engine` prop) — current step, visited path, running/error,
  and the dynamic branches that static analysis can't see.

## API

- **`<FlowGraph flow engine? direction? onSelectStep? />`** — React Flow + dagre
  auto-layout. Peers: `react`, `cairn-core`.
- **`buildGraph(flow)`** — the pure flow→`{ nodes, edges, dynamic }` model behind
  the component, exported for custom renderers.

Read-only by design. A visual *editor* that authors flows is a separate effort.

> Requires importing `@xyflow/react/dist/style.css` once (in your root layout).

📖 **[Full documentation & live demo →](https://react-cairn.vercel.app/docs/devtools)**
