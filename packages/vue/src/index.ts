import {
  computed,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from "vue";
import {
  FlowEngine,
  type EngineOptions,
  type FlowDefinition,
  type FlowState,
  type StepDefinition,
} from "cairn-core";

const ENGINE_KEY: InjectionKey<FlowEngine<any>> = Symbol("cairn-engine");

export interface FlowControls<C extends object> {
  /** Live, reactive snapshot of the flow. */
  state: Ref<FlowState<C>>;
  start: () => void;
  next: () => void;
  back: () => void;
  goTo: (stepId: string) => void;
  skip: () => void;
  dismiss: () => void;
  setContext: (patch: Partial<C>) => void;
  /** Clear the current step's error and re-run its `run`. */
  retry: () => void;
}

/**
 * Build (or adopt) a flow engine and provide it to descendant components.
 * Pass a `FlowDefinition` (this composable owns the engine and destroys it when
 * the component scope is disposed) or a pre-built `FlowEngine` (you own it).
 * Returns the engine so the providing component can drive it too.
 */
export function provideFlow<C extends object>(
  source: FlowDefinition<C> | FlowEngine<C>,
  options?: EngineOptions,
): FlowEngine<C> {
  const owned = !(source instanceof FlowEngine);
  const engine = owned ? new FlowEngine<C>(source, options) : source;
  provide(ENGINE_KEY, engine);
  if (owned) onScopeDispose(() => engine.destroy());
  return engine;
}

/**
 * Subscribe to the provided flow engine. `state` is a `shallowRef` updated on
 * every transition (the engine hands out a fresh immutable snapshot, so a
 * shallow ref is exactly right). Controls are plain functions.
 */
export function useFlow<C extends object = Record<string, unknown>>(): FlowControls<C> {
  const engine = inject(ENGINE_KEY) as FlowEngine<C> | undefined;
  if (!engine) {
    throw new Error("Cairn: useFlow() must be used inside a component that called provideFlow().");
  }

  const state = shallowRef(engine.getState());
  const unsubscribe = engine.subscribe((snapshot) => {
    state.value = snapshot;
  });
  onScopeDispose(unsubscribe);

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
  };
}

/** Reactive ref of the active step (or `null` when no step is active). */
export function useCurrentStep<C extends object = Record<string, unknown>>(): ComputedRef<StepDefinition<C> | null> {
  const { state } = useFlow<C>();
  return computed(() => state.value.currentStep);
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
