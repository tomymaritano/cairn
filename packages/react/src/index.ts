export { FlowProvider, type FlowProviderProps } from "./context.js";
export { useFlow, useCurrentStep, type FlowControls } from "./hooks.js";

// Re-export the core surface so apps can install one package to start.
export {
  FlowEngine,
  defineFlow,
  type EngineOptions,
  type FlowContext,
  type FlowDefinition,
  type FlowState,
  type FlowStatus,
  type StepDefinition,
  type CairnEvent,
  type CairnEventType,
  createMemoryAdapter,
  createWebStorageAdapter,
  clearPersisted,
  type PersistenceAdapter,
  type PersistenceConfig,
  type PersistedFlow,
} from "@cairn/core";
