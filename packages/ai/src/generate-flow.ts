import { generateObject } from "ai";
import type { FlowDefinition } from "cairn-core";
import { FlowSpecSchema, type FlowSpec } from "./spec.js";
import { validateSpec } from "./validate-spec.js";
import { specToCode } from "./spec-to-code.js";
import { specToFlow } from "./spec-to-flow.js";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

export interface GenerateContext {
  /** Available CSS selectors, to ground each step's `target`. */
  targets?: string[];
  /** Available routes/views. */
  routes?: string[];
  /** Known context fields a branch may read. */
  contextFields?: string[];
}

export interface GenerateOptions {
  /** AI Gateway "provider/model" string. Default: anthropic/claude-sonnet-4.6. */
  model?: string;
  /**
   * Inject the generation step — return the raw object to be parsed as a
   * FlowSpec. Bypasses the AI SDK entirely, so tests run with no model/key.
   */
  generate?: (args: { prompt: string }) => Promise<unknown>;
  context?: GenerateContext;
}

export interface GenerateFlowResult<C extends object = Record<string, unknown>> {
  /** The validated declarative spec the model produced. */
  spec: FlowSpec;
  /** A ready-to-paste `defineFlow(...)` TypeScript source. */
  code: string;
  /** A runnable flow (run it, or render it with cairn-devtools). */
  flow: FlowDefinition<C>;
}

function buildPrompt(prompt: string, context?: GenerateContext): string {
  const lines = [
    "You design onboarding/product-guidance flows as a declarative spec.",
    "Output a flow with steps; each step has an id and a `next` that is one of:",
    '- { "type": "step", "to": <stepId> }',
    '- { "type": "end" }',
    '- { "type": "branch", "field", "op", "value", "then", "else" } — a SINGLE comparison',
    "Operators: == != >= <= > <. No AND/OR, no nested logic — one comparison per branch.",
    "Every `field` used in a branch MUST be declared in initialContext with a seed value.",
    "Every `to`/`then`/`else` must reference an existing step id (or null to end).",
    "At least one step must end the flow.",
    "Steps that point at UI should set `target` (a CSS selector), `title`, and `body`.",
  ];
  if (context?.targets?.length) lines.push(`Available target selectors: ${context.targets.join(", ")}.`);
  if (context?.routes?.length) lines.push(`Available routes: ${context.routes.join(", ")}.`);
  if (context?.contextFields?.length) lines.push(`Prefer these context fields: ${context.contextFields.join(", ")}.`);
  lines.push("", `Request: ${prompt}`);
  return lines.join("\n");
}

/**
 * Generate a Cairn flow from a natural-language prompt. Returns the validated
 * spec, ready-to-paste `defineFlow` code, and a runnable flow.
 *
 * The model only ever produces the declarative spec (validated by Zod +
 * `validateSpec`); code and the runnable flow are derived deterministically.
 */
export async function generateFlow<C extends object = Record<string, unknown>>(
  prompt: string,
  options: GenerateOptions = {},
): Promise<GenerateFlowResult<C>> {
  const fullPrompt = buildPrompt(prompt, options.context);

  const raw = options.generate
    ? await options.generate({ prompt: fullPrompt })
    : (await generateObject({
        model: options.model ?? DEFAULT_MODEL,
        schema: FlowSpecSchema,
        prompt: fullPrompt,
      })).object;

  const spec = FlowSpecSchema.parse(raw);
  validateSpec(spec);

  return {
    spec,
    code: specToCode(spec),
    flow: specToFlow<C>(spec),
  };
}
