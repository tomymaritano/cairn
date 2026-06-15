import { Emitter, type AnyListener, type CairnEventType, type CairnEventMap, type Listener } from "./events.js";
import {
  clearPersisted,
  readPersisted,
  writePersisted,
  PERSISTENCE_VERSION,
  type PersistedFlow,
  type PersistenceConfig,
} from "./persistence.js";
import type {
  FlowContext,
  FlowDefinition,
  FlowState,
  FlowStatus,
  StepDefinition,
  StepTarget,
} from "./types.js";

export interface EngineOptions {
  /** Start the flow immediately on construction. Defaults to false. */
  autoStart?: boolean;
  /** Persist & resume progress across reloads/sessions. */
  persistence?: PersistenceConfig;
}

const TERMINAL: ReadonlySet<FlowStatus> = new Set([
  "completed",
  "skipped",
  "dismissed",
]);

/**
 * The framework-agnostic flow engine. Holds the live state machine for a
 * single flow, resolves branching/guards, and emits lifecycle events.
 * Renderers observe it through `subscribe()` (state snapshots) or `on()`
 * (semantic events); the engine itself never touches the DOM.
 */
export class FlowEngine<C extends object = FlowContext> {
  private readonly definition: FlowDefinition<C>;
  private readonly stepsById: Map<string, StepDefinition<C>>;
  private readonly emitter = new Emitter<C>();
  private readonly stateListeners = new Set<(state: FlowState<C>) => void>();
  private readonly persistence?: PersistenceConfig;
  private readonly initialContext: C;

  private status: FlowStatus = "idle";
  private currentStepId: string | null = null;
  private context: C;
  private history: string[] = [];
  private running = false;
  private error: Error | null = null;

  /**
   * Monotonic token identifying the in-flight `run`. Incremented whenever the
   * flow leaves the step (or starts a new run). Only the run holding the
   * latest token may mutate state — this discards aborted/stale results and
   * guards React StrictMode double-invokes.
   */
  private runGeneration = 0;
  /** Aborts the in-flight `run` when the flow leaves the step. */
  private runController: AbortController | null = null;

  /** Cached so `subscribe()` can return a stable reference (React-safe). */
  private snapshot: FlowState<C>;

  constructor(definition: FlowDefinition<C>, options: EngineOptions = {}) {
    if (definition.steps.length === 0) {
      throw new Error(`Cairn: flow "${definition.id}" has no steps.`);
    }
    this.definition = definition;
    this.stepsById = new Map(definition.steps.map((s) => [s.id, s]));
    this.initialContext = { ...(definition.initialContext ?? ({} as C)) };
    this.context = { ...this.initialContext };
    if (options.persistence) this.persistence = options.persistence;
    this.snapshot = this.computeSnapshot();

    if (options.autoStart) this.start();
  }

  // ── Reads ────────────────────────────────────────────────────────────

  getState(): FlowState<C> {
    return this.snapshot;
  }

  // ── Subscriptions ────────────────────────────────────────────────────

  /** State-snapshot subscription. Shaped for React's useSyncExternalStore. */
  subscribe(listener: (state: FlowState<C>) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** Subscribe to a single semantic event (analytics, side effects). */
  on<T extends CairnEventType>(type: T, listener: Listener<C, T>): () => void {
    return this.emitter.on(type, listener);
  }

  /** Subscribe to every event — the hook analytics adapters use. */
  onAny(listener: AnyListener<C>): () => void {
    return this.emitter.onAny(listener);
  }

  // ── Transitions ──────────────────────────────────────────────────────

  start(): void {
    if (this.status === "active") return;
    if (this.persistence && this.resumeFromStorage()) return;

    this.status = "active";
    this.history = [];
    this.context = { ...this.initialContext };
    this.running = false;
    this.error = null;
    const first = this.definition.initialStep ?? this.definition.steps[0]!.id;
    this.commit();
    this.emit("flow:start", { flowId: this.definition.id, state: this.snapshot });
    this.enter(first);
  }

  /**
   * Clears any persisted progress and returns the flow to `idle`, so the
   * next `start()` runs from scratch (e.g. "replay onboarding").
   */
  reset(): void {
    this.cancelRun();
    if (this.persistence) clearPersisted(this.persistence, this.definition.id);
    this.status = "idle";
    this.currentStepId = null;
    this.history = [];
    this.context = { ...this.initialContext };
    this.running = false;
    this.error = null;
    this.commit();
  }

  /**
   * Attempt to restore a persisted snapshot. Returns true if it took over
   * the start (resumed an active flow, or honored a completed one).
   */
  private resumeFromStorage(): boolean {
    const saved = readPersisted<C>(this.persistence!, this.definition.id);
    if (!saved) return false;

    // A finished flow stays finished — don't re-show it.
    if (TERMINAL.has(saved.status)) {
      if (this.persistence!.respectCompleted === false) return false;
      this.status = saved.status;
      this.context = saved.context;
      this.history = [];
      this.currentStepId = null;
      this.commit();
      return true;
    }

    // Resume an in-progress flow, but only if its step still exists
    // (the definition may have changed since the snapshot was written).
    if (saved.status === "active" && saved.currentStepId && this.stepsById.has(saved.currentStepId)) {
      this.status = "active";
      this.context = saved.context;
      this.history = saved.history.filter((id) => this.stepsById.has(id));
      this.currentStepId = saved.currentStepId;
      this.commit();
      this.emit("flow:resume", { flowId: this.definition.id, state: this.snapshot });
      const step = this.requireCurrentStep();
      this.emitEnter(step);
      // Re-run the resumed step's action (runs are assumed idempotent).
      if (step.run) this.startRun(step);
      return true;
    }

    return false;
  }

  next(): void {
    if (!this.assertActive()) return;
    // A run is in flight; it auto-advances on settle. Ignore manual nexts to
    // avoid double transitions.
    if (this.running) return;
    const step = this.requireCurrentStep();
    const target = this.resolveTarget(step.next, undefined);
    if (target === null) {
      this.finish("completed", "flow:complete");
      return;
    }
    this.enter(target);
  }

  back(): void {
    if (!this.assertActive()) return;
    if (this.history.length < 2) return;
    this.exitCurrent();
    this.history.pop(); // drop current
    const prev = this.history[this.history.length - 1]!;
    this.currentStepId = prev;
    // Landing on a fresh step clears any prior run state.
    this.running = false;
    this.error = null;
    this.commit();
    const step = this.requireCurrentStep();
    this.emitEnter(step);
    // A run step is automated: re-entering it (via Back) must re-execute it,
    // exactly like enter()/resume — otherwise the flow wedges on it.
    if (step.run) this.startRun(step);
  }

  goTo(stepId: string): void {
    if (!this.assertActive()) return;
    if (!this.stepsById.has(stepId)) {
      throw new Error(`Cairn: unknown step "${stepId}" in flow "${this.definition.id}".`);
    }
    this.enter(stepId);
  }

  /**
   * Clear the current step's error and re-execute its `run`. No-op if the
   * step has no `run`, a run is already in flight, or the flow isn't active.
   */
  retry(): void {
    if (!this.assertActive()) return;
    if (this.running) return;
    const step = this.requireCurrentStep();
    if (!step.run) return;
    this.error = null;
    this.commit();
    this.startRun(step);
  }

  /**
   * Merge a patch into the live context and notify branching consumers.
   *
   * If a `run` is in flight, this patch applies immediately, but the run was
   * decided against the context as it was when it started — on success the
   * run's own patch merges last (last-write-wins per key). To re-decide after
   * changing inputs, wait for the run to settle (`state.running`) and then
   * `goTo()` the run step again, or `retry()`.
   */
  setContext(patch: Partial<C>): void {
    this.context = { ...this.context, ...patch };
    this.commit();
    this.emit("context:update", {
      flowId: this.definition.id,
      patch,
      state: this.snapshot,
    });
  }

  skip(): void {
    if (!this.assertActive()) return;
    this.finish("skipped", "flow:skip");
  }

  dismiss(): void {
    if (!this.assertActive()) return;
    this.finish("dismissed", "flow:dismiss");
  }

  destroy(): void {
    this.cancelRun();
    this.emitter.clear();
    this.stateListeners.clear();
  }

  // ── Internals ────────────────────────────────────────────────────────

  /** Enter a step, honoring `canEnter` guards (which skip forward). */
  private enter(stepId: string, visited: Set<string> = new Set()): void {
    if (visited.has(stepId)) {
      throw new Error(`Cairn: guard loop detected entering "${stepId}".`);
    }
    visited.add(stepId);

    const step = this.stepsById.get(stepId);
    if (!step) {
      throw new Error(`Cairn: unknown step "${stepId}" in flow "${this.definition.id}".`);
    }

    if (step.canEnter && !step.canEnter(this.context)) {
      const target = this.resolveTarget(step.next, undefined);
      if (target === null) {
        this.finish("completed", "flow:complete");
        return;
      }
      this.enter(target, visited);
      return;
    }

    if (this.currentStepId) this.exitCurrent();
    this.currentStepId = stepId;
    this.history.push(stepId);
    // Entering a fresh step clears any prior run state.
    this.running = false;
    this.error = null;
    this.commit();
    this.emitEnter(step);

    if (step.run) this.startRun(step);
  }

  /**
   * Begin (or restart) the current step's `run`. Captures a generation token
   * so only the latest run for the step may settle into state.
   */
  private startRun(step: StepDefinition<C>): void {
    const run = step.run;
    if (!run) return;

    this.cancelRun();
    const generation = ++this.runGeneration;
    const controller = new AbortController();
    this.runController = controller;

    this.running = true;
    this.commit();
    this.emit("step:run:start", {
      flowId: this.definition.id,
      step,
      state: this.snapshot,
    });

    Promise.resolve(run(this.context, controller.signal)).then(
      (patch) => this.onRunSuccess(generation, step, patch),
      (err) => this.onRunError(generation, step, err),
    );
  }

  private onRunSuccess(
    generation: number,
    step: StepDefinition<C>,
    patch: Partial<C> | void,
  ): void {
    if (generation !== this.runGeneration) return; // aborted/stale
    if (patch) this.context = { ...this.context, ...patch };
    this.running = false;
    this.runController = null;
    this.commit();
    this.emit("step:run:success", {
      flowId: this.definition.id,
      step,
      state: this.snapshot,
    });
    // Auto-advance against the now-updated context.
    const target = this.resolveTarget(step.next, undefined);
    if (target === null) {
      this.finish("completed", "flow:complete");
      return;
    }
    this.enter(target);
  }

  private onRunError(
    generation: number,
    step: StepDefinition<C>,
    err: unknown,
  ): void {
    if (generation !== this.runGeneration) return; // aborted/stale
    const error = err instanceof Error ? err : new Error(String(err));
    this.running = false;
    this.runController = null;
    this.error = step.onError !== undefined ? null : error;
    this.commit();
    this.emit("step:run:error", {
      flowId: this.definition.id,
      step,
      error,
      state: this.snapshot,
    });
    if (step.onError !== undefined) {
      const target = this.resolveTarget(step.onError, undefined);
      if (target === null) {
        this.finish("completed", "flow:complete");
        return;
      }
      this.enter(target);
    }
  }

  /**
   * Abort any in-flight run and bump the generation so its pending
   * settlement is discarded (no stale context writes / auto-advance).
   */
  private cancelRun(): void {
    if (this.runController) {
      this.runController.abort();
      this.runController = null;
    }
    this.runGeneration++;
    this.running = false;
  }

  private exitCurrent(): void {
    this.cancelRun();
    const step = this.stepsById.get(this.currentStepId ?? "");
    if (!step) return;
    this.emit("step:exit", {
      flowId: this.definition.id,
      step,
      state: this.snapshot,
    });
  }

  private emitEnter(step: StepDefinition<C>): void {
    this.emit("step:enter", {
      flowId: this.definition.id,
      step,
      state: this.snapshot,
    });
  }

  private finish(status: FlowStatus, event: "flow:complete" | "flow:skip" | "flow:dismiss"): void {
    this.exitCurrent();
    this.status = status;
    this.currentStepId = null;
    this.commit();
    this.emit(event, { flowId: this.definition.id, state: this.snapshot });
  }

  private resolveTarget(target: StepTarget<C> | undefined, fallback: string | null | undefined): string | null {
    if (target === undefined) return fallback ?? null;
    if (typeof target === "function") return target(this.context);
    return target;
  }

  private requireCurrentStep(): StepDefinition<C> {
    const step = this.stepsById.get(this.currentStepId ?? "");
    if (!step) throw new Error("Cairn: no active step.");
    return step;
  }

  private assertActive(): boolean {
    return this.status === "active" && !TERMINAL.has(this.status);
  }

  private emit<T extends CairnEventType>(type: T, payload: CairnEventMap<C>[T]): void {
    this.emitter.emit(type, payload);
  }

  /** Recompute the cached snapshot, persist it, and notify subscribers. */
  private commit(): void {
    this.snapshot = this.computeSnapshot();
    // Persist only when a run has settled, never mid-flight, so a resumed
    // snapshot never points at a half-finished async step.
    if (this.persistence && this.status !== "idle" && !this.running) {
      writePersisted<C>(this.persistence, this.toPersisted());
    }
    for (const listener of this.stateListeners) listener(this.snapshot);
  }

  private toPersisted(): PersistedFlow<C> {
    return {
      version: PERSISTENCE_VERSION,
      flowId: this.definition.id,
      status: this.status,
      currentStepId: this.currentStepId,
      context: this.context,
      history: [...this.history],
    };
  }

  private computeSnapshot(): FlowState<C> {
    const currentStep = this.currentStepId
      ? this.stepsById.get(this.currentStepId) ?? null
      : null;
    const stepIndex = this.currentStepId
      ? this.definition.steps.findIndex((s) => s.id === this.currentStepId)
      : -1;
    return Object.freeze({
      flowId: this.definition.id,
      status: this.status,
      currentStepId: this.currentStepId,
      currentStep,
      context: this.context,
      history: [...this.history],
      stepIndex,
      totalSteps: this.definition.steps.length,
      running: this.running,
      error: this.error,
    });
  }
}
