# Cairn Docs

The written documentation lives in [`content/docs`](./content/docs) as MDX,
already structured the way Fumadocs expects (`*.mdx` + `meta.json`). This
folder is the **content of record** — it's complete and reviewable on its own.

## Standing up the Fumadocs site

The recommended way to add the rendering shell is the official scaffolder,
which wires up the version-specific bits (Tailwind v4, the `loader` source
API, the `[[...slug]]` route) correctly for the current Fumadocs release:

```bash
# from the repo root
pnpm create fumadocs-app apps/docs-site
```

When the CLI asks, choose **Next.js + Fumadocs MDX**. Then point it at this
content by copying the prepared pages in:

```bash
cp -R apps/docs/content/docs/* apps/docs-site/content/docs/
```

Finally, wire the new app into the workspace `dev`/`build` scripts (it's
already covered by `pnpm-workspace.yaml` via `apps/*`).

## Why not commit the full Next.js app here?

The Fumadocs shell is mechanical and tied tightly to the framework version;
the docs *content* is the durable asset. Keeping the content separate means it
never rots against a Fumadocs upgrade, and the shell can be regenerated at any
time. Once the site is scaffolded and verified to build, it can replace this
folder.

## Page map

| Page              | File                          |
| ----------------- | ----------------------------- |
| Introduction      | `content/docs/index.mdx`      |
| Quickstart        | `content/docs/quickstart.mdx` |
| Core Concepts     | `content/docs/concepts.mdx`   |
| Branching & Guards| `content/docs/branching.mdx`  |
| Persistence       | `content/docs/persistence.mdx`|
| Events & Analytics| `content/docs/analytics.mdx`  |
| `@cairn/react`    | `content/docs/react.mdx`      |
| `@cairn/core`     | `content/docs/core.mdx`       |
