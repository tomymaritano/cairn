import type { FlowContext, FlowState, StepDefinition } from "./types.js";

/**
 * Every observable thing that happens in a flow. Analytics adapters,
 * the React bindings, and the future visual builder all subscribe here
 * instead of reaching into the engine — one event bus, many listeners.
 */
export interface CairnEventMap<C extends object = FlowContext> {
  "flow:start": { flowId: string; state: FlowState<C> };
  "flow:resume": { flowId: string; state: FlowState<C> };
  "flow:complete": { flowId: string; state: FlowState<C> };
  "flow:skip": { flowId: string; state: FlowState<C> };
  "flow:dismiss": { flowId: string; state: FlowState<C> };
  "step:enter": { flowId: string; step: StepDefinition<C>; state: FlowState<C> };
  "step:exit": { flowId: string; step: StepDefinition<C>; state: FlowState<C> };
  "context:update": { flowId: string; patch: Partial<C>; state: FlowState<C> };
}

export type CairnEventType = keyof CairnEventMap;

export type CairnEvent<
  C extends object = FlowContext,
  T extends CairnEventType = CairnEventType,
> = {
  [K in T]: { type: K } & CairnEventMap<C>[K];
}[T];

export type Listener<C extends object, T extends CairnEventType> = (
  payload: CairnEventMap<C>[T],
) => void;

export type AnyListener<C extends object> = (event: CairnEvent<C>) => void;

/**
 * A tiny dependency-free emitter. Kept internal so the public engine
 * surface stays small; supports per-type listeners and a firehose `onAny`
 * (which is how analytics adapters capture everything in one place).
 */
export class Emitter<C extends object> {
  private readonly listeners = new Map<CairnEventType, Set<Listener<C, never>>>();
  private readonly anyListeners = new Set<AnyListener<C>>();

  on<T extends CairnEventType>(type: T, listener: Listener<C, T>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as Listener<C, never>);
    return () => set!.delete(listener as Listener<C, never>);
  }

  onAny(listener: AnyListener<C>): () => void {
    this.anyListeners.add(listener);
    return () => this.anyListeners.delete(listener);
  }

  emit<T extends CairnEventType>(type: T, payload: CairnEventMap<C>[T]): void {
    const set = this.listeners.get(type);
    if (set) {
      for (const listener of set) {
        (listener as Listener<C, T>)(payload);
      }
    }
    if (this.anyListeners.size > 0) {
      const event = { type, ...payload } as CairnEvent<C>;
      for (const listener of this.anyListeners) listener(event);
    }
  }

  clear(): void {
    this.listeners.clear();
    this.anyListeners.clear();
  }
}
