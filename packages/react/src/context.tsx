import { createContext, useContext, useEffect, useMemo } from "react";
import {
  FlowEngine,
  type EngineOptions,
  type FlowDefinition,
} from "cairn-core";
import type { ReactNode } from "react";

const EngineContext = createContext<FlowEngine<any> | null>(null);

export interface FlowProviderProps<C extends object> {
  /** A flow definition — the provider builds and owns the engine. */
  flow?: FlowDefinition<C>;
  /** Or pass a pre-built engine if you manage its lifecycle yourself. */
  engine?: FlowEngine<C>;
  /** Forwarded to the engine when `flow` is given. */
  options?: EngineOptions;
  children: ReactNode;
}

/**
 * Provides a single flow engine to the tree. Pass `flow` (provider owns the
 * engine, recreated only when the definition identity changes) or `engine`
 * (you own it). The engine is destroyed on unmount when the provider owns it.
 */
export function FlowProvider<C extends object>({
  flow,
  engine,
  options,
  children,
}: FlowProviderProps<C>) {
  if (!flow && !engine) {
    throw new Error("Cairn: <FlowProvider> needs either `flow` or `engine`.");
  }

  const owned = useMemo(
    () => (engine ? null : new FlowEngine<C>(flow!, options)),
    // The definition object identity is the intended dependency.
    [flow, engine, options],
  );
  const active = engine ?? owned!;

  useEffect(() => {
    return () => {
      if (owned) owned.destroy();
    };
  }, [owned]);

  return (
    <EngineContext.Provider value={active}>{children}</EngineContext.Provider>
  );
}

/** Internal: read the engine or throw a helpful error. */
export function useEngine<C extends object>(): FlowEngine<C> {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error("Cairn: hooks must be used inside a <FlowProvider>.");
  }
  return engine as FlowEngine<C>;
}
