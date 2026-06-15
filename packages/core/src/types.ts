/**
 * The arbitrary, user-defined data a flow carries as it runs.
 * Branching decisions and guards read from this object, and the host
 * app mutates it via `engine.setContext()` (e.g. "user just created a team").
 */
export type FlowContext = Record<string, unknown>;

/**
 * Where a step goes next. Either a static step id, or a function that
 * decides at runtime based on the live context — this is what powers
 * branching workflows. Returning `null` ends the flow (completion).
 */
export type StepTarget<C extends object> =
  | string
  | null
  | ((ctx: Readonly<C>) => string | null);

/**
 * A guard deciding whether a step is allowed to be entered right now.
 * If it returns false, the engine skips forward to the step's `next`.
 */
export type StepGuard<C extends object> = (ctx: Readonly<C>) => boolean;

/**
 * A single waypoint in a flow. `meta` is an open bag the renderer
 * (`@cairn/react`, future Vue/Svelte adapters) reads to draw UI —
 * the core never touches it, keeping the engine framework-agnostic.
 */
export interface StepDefinition<C extends object = FlowContext> {
  readonly id: string;
  /** Resolves the next step. Omit to end the flow after this step. */
  readonly next?: StepTarget<C>;
  /** If present and false, the step is skipped (advances to `next`). */
  readonly canEnter?: StepGuard<C>;
  /** Renderer-facing payload: target selector, title, body, placement… */
  readonly meta?: Record<string, unknown>;
}

export interface FlowDefinition<C extends object = FlowContext> {
  readonly id: string;
  readonly steps: ReadonlyArray<StepDefinition<C>>;
  /** Defaults to the first step in `steps`. */
  readonly initialStep?: string;
  /** Seed context merged in when the flow starts. */
  readonly initialContext?: C;
}

export type FlowStatus =
  | "idle"
  | "active"
  | "completed"
  | "skipped"
  | "dismissed";

/** An immutable snapshot of a running flow, handed to subscribers. */
export interface FlowState<C extends object = FlowContext> {
  readonly flowId: string;
  readonly status: FlowStatus;
  readonly currentStepId: string | null;
  readonly currentStep: StepDefinition<C> | null;
  readonly context: Readonly<C>;
  /** Ordered ids of steps that have been entered, for back-navigation. */
  readonly history: ReadonlyArray<string>;
  readonly stepIndex: number;
  readonly totalSteps: number;
}
