# cairn-devtools — `<FlowGraph>` flow visualizer (v1)

**Date:** 2026-06-15
**Status:** Approved (design)
**New package:** `cairn-devtools` (0.1.0)

## Goal

A **read-only** visualizer for Cairn flows: drop `<FlowGraph flow={...} />` into a
dev tool, Storybook, or the docs and see the flow as a graph — steps as nodes,
`next`/`onError` as edges, auto-laid-out. Optionally pass a live `engine` and the
graph **lights up in real time** as the flow runs (current step, visited path,
running/error state, the actually-taken branches).

This is the first slice of the "visual flow builder" roadmap item. It is
explicitly **not** an authoring/editing tool — no editing, no code export, no
declarative condition language. Those are a separate future effort; keeping v1
read-only sidesteps the hard "branching-as-functions-vs-data" problem entirely.

## Decisions (resolved during brainstorming)

- **Scope v1:** visualizer, read-only.
- **Form:** an embeddable React component, shipped as `cairn-devtools`.
- **Live trace (`engine` prop):** in scope for v1 — the headline feature.
- **Rendering:** React Flow (`@xyflow/react`) + dagre auto-layout.
- **Name:** `cairn-devtools`.

## Package

`cairn-devtools` (unscoped, public, 0.1.0). React-only component.

- **dependencies:** `@xyflow/react`, `@dagrejs/dagre`
- **peerDependencies:** `react >=18`, `cairn-core` (types). `cairn-react` is NOT
  required — live mode subscribes to the `FlowEngine` directly via its
  `subscribe`/`getState` contract from `cairn-core`.
- Marked `"use client"` (interactive component; post-build prepend like cairn-ui).

## API

```tsx
import { FlowGraph } from "cairn-devtools";

<FlowGraph
  flow={onboarding}              // FlowDefinition<C> — the graph source (required)
  engine={engine}                // FlowEngine<C> — optional, enables live trace
  direction="TB"                 // "TB" | "LR", default "TB"
  onSelectStep={(step) => {}}    // optional; fired on node click
  className={...}
/>
```

Clicking a node opens a built-in side panel showing the step's `id`, `meta`
(target / title / body / placement), and its badges. `onSelectStep` also fires
for host integration.

## Architecture

Two clean units:

### 1. `buildGraph(flow)` — pure, framework-free (the testable core)

```ts
function buildGraph<C>(flow: FlowDefinition<C>): {
  nodes: GraphNode[];   // { id, badges: ("async"|"guarded"|"start"|"end")[] }
  edges: GraphEdge[];   // { from, to, kind: "next"|"error"|"possible" }
  dynamic: string[];    // ids whose next/onError is a function (can't resolve statically)
};
```

Edge inference:

- **`next: string`** → `kind: "next"` (solid) edge.
- **`onError: string`** → `kind: "error"` (dashed) edge.
- **`next` / `onError` is a function** → the node is added to `dynamic` and badged
  "dynamic"; no definite edge. If the step declares `meta.targets: string[]`,
  emit `kind: "possible"` (dotted) edges to each listed target.
- **`next` omitted / `null`** → terminal; node badged "end".
- **has `run`** → badge "async". **has `canEnter`** → badge "guarded".
- The flow's `initialStep` (or first step) → badge "start".

This function has no React/DOM/React-Flow dependency and is the unit-test target.

### 2. `<FlowGraph>` — React Flow renderer

- Feeds `buildGraph(flow)` through **dagre** to compute node positions
  (`direction`), maps to React Flow `nodes`/`edges` with a custom node component
  (renders id + badges + live status) and edge styles per `kind`.
- Includes React Flow `Background`, `Controls`, `MiniMap`, fit-to-view.
- Side panel state is local; node click selects + calls `onSelectStep`.

### Live trace (when `engine` is provided)

- Subscribe via `engine.subscribe` (+ seed `engine.getState()`); unsubscribe on
  unmount. (Uses the core contract directly — no `cairn-react` dependency.)
- From the live `FlowState`: highlight `currentStepId`, mark `history` nodes as
  visited, draw "taken" edges along the history path (this reveals the dynamic
  branches static analysis can't), and show `running` (pulsing) / `error` (red)
  on the active node.

## Where it's shown (dogfood)

A docs page `apps/docs-site/content/docs/devtools.mdx` renders
`<FlowGraph flow={...} engine={...} />` wired to the same engine as the agentic
demo, so the docs show the graph lighting up as the agent routes. Registered as
a global MDX component and added to `meta.json`.

## Testing

- **Unit (`buildGraph`)**: string `next` edges; `onError` dashed edge; function
  `next` → `dynamic` + no solid edge; `meta.targets` → "possible" edges; `run`
  → "async" badge; `canEnter` → "guarded"; terminal → "end"; start badge.
  Plain JS, no DOM.
- **Component smoke (jsdom)**: `<FlowGraph>` renders without crashing and emits a
  node per step. (React Flow needs sizing/ResizeObserver — polyfill like cairn-ui;
  assert the graph model wired through, not pixel layout.)

## Versioning / release

New package `cairn-devtools@0.1.0`. Independent of the published 0.2.0 line.
Publish via the same flow (CI on `NPM_TOKEN`, or manual `pnpm publish`).

## Out of scope (v1)

Editing, drag-to-connect, code/JSON export, a declarative condition language,
round-trip code↔canvas. These belong to a future "authoring" builder with its
own spec.

## Risks

- **React Flow in jsdom** is layout-blind (no real sizing). Mitigation: keep the
  testable logic in `buildGraph`; the component test is a render smoke only.
- **dagre placement of dynamic-only nodes** (no static incoming/outgoing edge):
  place them as islands near their source; acceptable for v1.
- **Bundle size**: React Flow + dagre are sizable, but this is a devtools package
  (not the runtime) — acceptable, and tree-shakeable away from apps that don't
  import it.
