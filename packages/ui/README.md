# cairn-ui

Headless, accessible UI primitives for [Cairn](https://github.com/tomymaritano/cairn)
flows. Cairn owns the hard parts — positioning and accessibility — and you own
the content and styling.

```bash
npm i cairn-ui cairn-react
```

## Components

### `<CairnSpotlight>`

Dims the page and cuts a hole around the current step's target element
(`step.meta.target`). `aria-hidden`, GPU-friendly (a single `box-shadow`), and
tracks the target through scroll/resize.

```tsx
<CairnSpotlight padding={6} radius={8} overlayColor="rgba(0,0,0,0.5)" />
```

### `<CairnProgress>`

A progress indicator for the active flow — "step N / total" plus a dot per step.
Reads `stepIndex` / `totalSteps`; renders nothing when idle. Style via
`data-cairn-progress*` / `--cairn-dot*`.

```tsx
<CairnProgress showCount showDots />
```

### `<CairnBeacon>`

A pulsing hotspot anchored to the current step's target — a click-to-continue
affordance. A real `<button>` with an accessible name; clicking advances the
flow (or runs `onActivate`). Pulse is disabled under `prefers-reduced-motion`.

```tsx
<CairnBeacon color="#4f46e5" size={14} />
```

### `<CairnPopover>`

An accessible dialog anchored to the current step's target, positioned with
[Floating UI](https://floating-ui.com) (`flip`, `shift`, `autoUpdate`).
Handles focus management (`role="dialog"`, focus moves in on open and returns
on close) and Escape-to-dismiss.

```tsx
<CairnPopover placement="bottom" className="my-card">
  {(step) => (
    <>
      <h3>{String(step.meta?.title)}</h3>
      <p>{String(step.meta?.body)}</p>
    </>
  )}
</CairnPopover>
```

Per-step placement comes from `step.meta.placement`. Style via the
`data-cairn-popover` / `data-cairn-spotlight` attributes or `className`.

## Hooks

For custom renderers:

- `useTargetElement(selector)` — resolves a selector to a live element, with a
  `MutationObserver` for targets that mount later (multi-page flows).
- `useElementRect(element)` — tracks an element's viewport rect (synchronous
  first measure, rAF-coalesced updates).

## Notes

- The package is marked `"use client"` — safe to import from React Server
  Components.
- `cairn-react` and `react` / `react-dom` are peer dependencies.
