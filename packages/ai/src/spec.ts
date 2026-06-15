import { z } from "zod";

/** Comparison operators a generated branch may use (single comparison only). */
export const OPERATORS = ["==", "!=", ">=", "<=", ">", "<"] as const;
export type Operator = (typeof OPERATORS)[number];

const ScalarValue = z.union([z.string(), z.number(), z.boolean()]);

/** Where a step goes next — a static step, the end, or a single-comparison branch. */
export const StepNextSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("step"), to: z.string() }),
  z.object({ type: z.literal("end") }),
  z.object({
    type: z.literal("branch"),
    field: z.string().describe("a key in initialContext"),
    op: z.enum(OPERATORS),
    value: ScalarValue,
    then: z.string().describe("step id to enter when the comparison is true"),
    else: z.string().nullable().describe("step id when false, or null to end the flow"),
  }),
]);

export const StepSpecSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  body: z.string().optional(),
  target: z.string().optional().describe("CSS selector for the UI element to point at"),
  placement: z.string().optional(),
  next: StepNextSchema,
});

export const FlowSpecSchema = z.object({
  id: z.string(),
  initialContext: z
    .record(z.string(), ScalarValue)
    .default({})
    .describe("seed context; branch fields must be declared here"),
  steps: z.array(StepSpecSchema).min(1),
});

export type StepNext = z.infer<typeof StepNextSchema>;
export type StepSpec = z.infer<typeof StepSpecSchema>;
export type FlowSpec = z.infer<typeof FlowSpecSchema>;
