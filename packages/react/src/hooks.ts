import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { FlowEngine, FlowState } from "cairn-core";
import { useEngine } from "./context.js";

export interface FlowControls<C extends object> {
  /** Live, render-safe snapshot of the flow. */
  state: FlowState<C>;
  start: () => void;
  next: () => void;
  back: () => void;
  goTo: (stepId: string) => void;
  skip: () => void;
  dismiss: () => void;
  setContext: (patch: Partial<C>) => void;
  /** Clear persisted progress and return to idle (replay onboarding). */
  reset: () => void;
}

/**
 * Subscribes to the engine via `useSyncExternalStore`, so flow state stays
 * correct under React 18 concurrent rendering (no tearing) — and returns
 * stable, memoized control callbacks.
 */
export function useFlow<C extends object = Record<string, unknown>>(): FlowControls<C> {
  const engine = useEngine<C>();

  const state = useSyncExternalStore(
    useCallback((cb) => engine.subscribe(cb), [engine]),
    () => engine.getState(),
    () => engine.getState(),
  );

  const controls = useMemo(() => bindControls(engine), [engine]);
  return { state, ...controls };
}

/**
 * Reads just the current step's `meta` — the renderer-facing payload
 * (target selector, title, body…). Returns `null` when no step is active.
 */
export function useCurrentStep<C extends object = Record<string, unknown>>() {
  const { state } = useFlow<C>();
  return state.currentStep;
}

function bindControls<C extends object>(engine: FlowEngine<C>) {
  return {
    start: () => engine.start(),
    next: () => engine.next(),
    back: () => engine.back(),
    goTo: (stepId: string) => engine.goTo(stepId),
    skip: () => engine.skip(),
    dismiss: () => engine.dismiss(),
    setContext: (patch: Partial<C>) => engine.setContext(patch),
    reset: () => engine.reset(),
  };
}
