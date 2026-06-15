# cairn-gen

Generate [Cairn](https://github.com/tomymaritano/cairn) flows from a
natural-language prompt. Returns a validated declarative spec, ready-to-paste
`defineFlow(...)` code, and a runnable flow.

```bash
npm i cairn-gen
```

```ts
import { generateFlow } from "cairn-gen";

const { spec, code, flow } = await generateFlow(
  "onboard a new user to the billing page; if usage is over 80%, push the upgrade",
  { model: "anthropic/claude-sonnet-4.6" }, // AI Gateway string (default)
);

console.log(code);  // paste-ready defineFlow(...)
// `flow` is runnable now — render it with cairn-devtools or run it with a FlowEngine
```

## How it's safe

The model only ever produces a **declarative spec** (data), never executable
code. From that spec, deterministically:

- **`specToCode(spec)`** → a `defineFlow(...)` TypeScript string to paste.
- **`specToFlow(spec)`** → a runnable `FlowDefinition` (branch closures are built
  by us from the comparisons — there is no `eval`).

Branching is restricted to a **single comparison** (`field op value`, with
`== != >= <= > <`), so the generated code is predictable and verifiable.
`validateSpec` rejects dangling step references and undeclared fields with a
descriptive error.

## Testing without a model

Inject `generate` to bypass the LLM entirely — ideal for tests and for wiring a
custom provider:

```ts
const { code } = await generateFlow("…", {
  generate: async ({ prompt }) => myFlowSpec, // return a FlowSpec-shaped object
});
```

## Exports

`generateFlow` · `specToCode` · `specToFlow` · `validateSpec` · `compare` ·
`FlowSpecSchema` (+ types). Deps: `ai`, `zod`. Peer: `cairn-core`.

## Not in v1

AND/OR conditions, function stubs, generating `run`/async steps, and the Studio
UI / CLI (thin wrappers over `generateFlow`).

📖 **[Full documentation →](https://react-cairn.vercel.app)**
