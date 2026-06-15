import { readable, type Readable } from "svelte/store";
import {
  FlowEngine,
  type EngineOptions,
  type FlowDefinition,
  type FlowState,
} from "cairn-core";

export interface FlowApi<C extends object> {
  /** A Svelte readable store of the live flow state. Use as `$flow.state`. */
  state: Readable<FlowState<C>>;
  start: () => void;
  next: () => void;
  back: () => void;
  goTo: (stepId: string) => void;
  skip: () => void;
  dismiss: () => void;
  setContext: (patch: Partial<C>) => void;
  /** Clear the current step's error and re-run its `run`. */
  retry: () => void;
  /** The underlying engine, for event subscriptions / advanced use. */
  engine: FlowEngine<C>;
}

/**
 * Wrap a flow as a Svelte store + controls.
 *
 * Cairn's engine already exposes a `subscribe(listener)` returning an
 * unsubscribe — the same shape a Svelte store wants — so the binding is just a
 * `readable` that seeds the current snapshot and forwards every transition.
 *
 * Pass a `FlowDefinition` (this builds the engine) or a `FlowEngine` (adopt your
 * own). The store starts its subscription on first subscriber and tears it down
 * on the last, the standard Svelte store lifecycle.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createFlow, defineFlow } from "svelte-cairn";
 *   const flow = createFlow(onboarding, { autoStart: true });
 *   const { state } = flow;
 * </script>
 * {#if $state.currentStep}
 *   <h3>{$state.currentStep.meta?.title ?? $state.currentStep.id}</h3>
 *   <button on:click={flow.next}>Next</button>
 * {/if}
 * ```
 */
export function createFlow<C extends object = Record<string, unknown>>(
  source: FlowDefinition<C> | FlowEngine<C>,
  options?: EngineOptions,
): FlowApi<C> {
  const engine = source instanceof FlowEngine ? source : new FlowEngine<C>(source, options);

  const state = readable<FlowState<C>>(engine.getState(), (set) => {
    set(engine.getState());
    return engine.subscribe(set);
  });

  return {
    state,
    start: () => engine.start(),
    next: () => engine.next(),
    back: () => engine.back(),
    goTo: (stepId) => engine.goTo(stepId),
    skip: () => engine.skip(),
    dismiss: () => engine.dismiss(),
    setContext: (patch) => engine.setContext(patch),
    retry: () => engine.retry(),
    engine,
  };
}

// Re-export the core surface so apps can install one package to start.
export {
  FlowEngine,
  defineFlow,
  createMemoryAdapter,
  createWebStorageAdapter,
  type EngineOptions,
  type FlowContext,
  type FlowDefinition,
  type FlowState,
  type FlowStatus,
  type StepDefinition,
  type CairnEvent,
  type CairnEventType,
  type PersistenceAdapter,
  type PersistenceConfig,
} from "cairn-core";
