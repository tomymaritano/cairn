# cairn-gen — `generateFlow(prompt)` (v1)

**Date:** 2026-06-15
**Status:** Approved (design)
**New package:** `cairn-gen` (0.1.0)

## Goal

Generate a Cairn flow from a natural-language prompt. `generateFlow("onboard a
new user to billing")` returns a **validated declarative spec**, a ready-to-paste
**`defineFlow(...)` code string**, and a **runnable `FlowDefinition`** (so the
result can be visualized/run immediately, e.g. in `<FlowGraph>`).

Headless library first — a Studio UI and a CLI are thin wrappers for later. The
drag-to-edit visual canvas is a separate effort.

## Decisions (resolved during brainstorming)

- **Surface:** a headless library function (`generateFlow`), not a UI/CLI.
- **Branching expressiveness:** **single comparisons only** — `field op value`
  (`==`, `!=`, `>=`, `<=`, `>`, `<`). No AND/OR, no stubs. 100% predictable codegen.
- **Output:** returns `{ spec, code, flow }`.
- **Model:** AI SDK (`ai`@6) `generateObject` via the Vercel AI Gateway; default
  `anthropic/claude-sonnet-4.6`; injectable `generate` for tests.
- **Safety:** the LLM produces **data** (the spec) only — never executable code.
  `specToCode` emits a string to paste; `specToFlow` builds closures *we*
  construct from the declarative comparisons. No `eval`, ever.
- **Name:** `cairn-gen`.

## Package

`cairn-gen` (unscoped, public, 0.1.0). Node/isomorphic.

- **dependencies:** `ai` (^6), `zod`
- **peerDependencies:** `cairn-core` (types + `FlowDefinition`)

## The declarative FlowSpec (the Zod schema the model fills)

```ts
const Comparison = z.object({
  field: z.string(),               // a key in initialContext
  op: z.enum(["==", "!=", ">=", "<=", ">", "<"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
  then: z.string(),                // step id when true
  else: z.string().nullable(),     // step id when false, or null = end
});

const StepNext = z.discriminatedUnion("type", [
  z.object({ type: z.literal("step"), to: z.string() }),
  z.object({ type: z.literal("end") }),
  z.object({ type: z.literal("branch") }).merge(Comparison),
]);

const StepSpec = z.object({
  id: z.string(),
  title: z.string().optional(),
  body: z.string().optional(),
  target: z.string().optional(),       // CSS selector
  placement: z.string().optional(),
  next: StepNext,
});

const FlowSpec = z.object({
  id: z.string(),
  initialContext: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  steps: z.array(StepSpec).min(1),
});
```

## API

```ts
interface GenerateContext {
  targets?: string[];        // available CSS selectors to ground `target`
  routes?: string[];         // available routes
  contextFields?: string[];  // known context fields branches may read
}

interface GenerateOptions {
  model?: string;                 // AI Gateway "provider/model"; default sonnet
  generate?: (args: { prompt: string }) => Promise<unknown>; // inject for tests
  context?: GenerateContext;
}

interface GenerateFlowResult<C extends object = Record<string, unknown>> {
  spec: FlowSpec;               // validated declarative spec
  code: string;                 // `defineFlow(...)` TypeScript source
  flow: FlowDefinition<C>;      // runnable (closures built from the spec)
}

function generateFlow<C extends object = Record<string, unknown>>(
  prompt: string,
  options?: GenerateOptions,
): Promise<GenerateFlowResult<C>>;
```

## Three clean units

### 1. `specToCode(spec): string` — pure

Emits a `defineFlow<Ctx>({...})` TypeScript string:

- `next: { type: "step", to }` → `next: "to"`
- `next: { type: "end" }` → `next: null`
- `next: { type: "branch", field, op, value, then, else }` →
  `next: (ctx) => ctx.field <op-mapped> value ? "then" : (else ? "else" : null)`
  (`==`→`===`, `!=`→`!==`; values rendered as JSON literals)
- `Ctx` type inferred from `initialContext` value types.
- `meta` object from title/body/target/placement when present.

No LLM, no DOM. The primary unit-test target.

### 2. `specToFlow(spec): FlowDefinition` — pure

Builds a runnable definition: branch `next` becomes a closure
`(ctx) => compare(ctx[field], op, value) ? then : (else ?? null)` constructed by
us (a `compare()` helper switch on `op`) — never `eval`. Lets callers run/render
the generated flow immediately.

### 3. `generateFlow(prompt, opts)` — orchestration

- Builds a system+user prompt embedding the schema rules and the
  single-comparison constraint, plus any `context` grounding.
- Calls `ai`'s `generateObject({ model, schema: FlowSpec, prompt })`
  (or `opts.generate` when injected for tests).
- Runs `validateSpec` (below); on failure throws a descriptive error.
- Returns `{ spec, code: specToCode(spec), flow: specToFlow(spec) }`.

## Validation (`validateSpec`)

After Zod parsing, check referential integrity:

- every `to` / `then` / `else` references an existing step id;
- every branch `field` exists in `initialContext`;
- at least one terminal path exists (no all-cycles).

On violation, throw an `Error` listing the problems (so a caller can re-prompt).
This is a pure function, unit-tested independently.

## Testing

- **`specToCode` (pure):** branch → function source with correct operator
  mapping; step → string `next`; end → `null`; `Ctx` inference; value literal
  escaping; meta emission.
- **`specToFlow` (pure):** branch closure routes correctly for each op; end →
  null; the built flow runs through a `FlowEngine` to a terminal.
- **`validateSpec`:** dangling `to`/`then`/`else`; unknown `field`.
- **`generateFlow` (injected `generate`):** a canned spec yields valid
  `{ spec, code, flow }`; an invalid spec throws. **No real LLM.**

## Out of scope (v1)

- AND/OR conditions, stubs, generating `run`/async (agentic) steps.
- The Studio UI and CLI (wrappers over `generateFlow`).
- The drag-to-edit visual canvas.
- Re-prompt/repair loops (the caller handles a thrown validation error).

## Risks

- **Model emits invalid references / fields** → caught by `validateSpec` (throws,
  not silently wrong). A future version can auto-repair or re-prompt.
- **Single-comparison branching is limiting** → accepted for v1; the generated
  code is a starting point the dev edits. AND/OR is a later addition.
- **`ai` SDK / model-id drift** → model is configurable; default pinned to a
  current gateway id, overridable per call.
