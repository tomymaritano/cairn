import type { FlowStatus } from "./types.js";

/** Bump when the serialized shape changes; older payloads are ignored. */
export const PERSISTENCE_VERSION = 1;

/**
 * The snapshot Cairn writes per flow. Kept minimal and JSON-serializable —
 * adapters only ever see a string, so any key-value store works.
 */
export interface PersistedFlow<C extends object = Record<string, unknown>> {
  version: number;
  flowId: string;
  status: FlowStatus;
  currentStepId: string | null;
  context: C;
  history: string[];
}

/**
 * A synchronous key-value store. Implement these three methods against
 * anything (localStorage, a cookie, an in-memory map). Async/remote stores
 * are a future addition via a separate `hydrate()` path.
 */
export interface PersistenceAdapter {
  load(key: string): string | null;
  save(key: string, value: string): void;
  remove(key: string): void;
}

export interface PersistenceConfig {
  adapter: PersistenceAdapter;
  /** Override the storage key. Defaults to `cairn:[namespace:]flowId`. */
  key?: string;
  /** Scope the key, e.g. a user id, so flows persist per-user. */
  namespace?: string;
  /**
   * If a flow was already completed/skipped/dismissed, don't auto-restart it
   * on `start()` — Cairn stays terminal so you never re-show finished
   * onboarding. Defaults to true.
   */
  respectCompleted?: boolean;
}

/** Compute the effective storage key for a flow. */
export function persistenceKey(config: PersistenceConfig, flowId: string): string {
  if (config.key) return config.key;
  return config.namespace
    ? `cairn:${config.namespace}:${flowId}`
    : `cairn:${flowId}`;
}

/** An in-memory adapter — handy for tests and SSR fallback. */
export function createMemoryAdapter(): PersistenceAdapter {
  const store = new Map<string, string>();
  return {
    load: (k) => store.get(k) ?? null,
    save: (k, v) => void store.set(k, v),
    remove: (k) => void store.delete(k),
  };
}

/**
 * Wraps a Web Storage object (localStorage / sessionStorage). Safe in SSR
 * and privacy-mode environments: if storage is unavailable it degrades to a
 * no-op rather than throwing.
 */
export function createWebStorageAdapter(
  getStorage: () => Storage | undefined = () =>
    typeof window !== "undefined" ? window.localStorage : undefined,
): PersistenceAdapter {
  const safe = <T>(fn: (s: Storage) => T, fallback: T): T => {
    try {
      const s = getStorage();
      return s ? fn(s) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    load: (k) => safe((s) => s.getItem(k), null),
    save: (k, v) => safe((s) => s.setItem(k, v), undefined),
    remove: (k) => safe((s) => s.removeItem(k), undefined),
  };
}

/** Read + validate a persisted snapshot. Returns null on miss / bad data. */
export function readPersisted<C extends object>(
  config: PersistenceConfig,
  flowId: string,
): PersistedFlow<C> | null {
  const raw = config.adapter.load(persistenceKey(config, flowId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedFlow<C>;
    if (parsed.version !== PERSISTENCE_VERSION || parsed.flowId !== flowId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePersisted<C extends object>(
  config: PersistenceConfig,
  snapshot: PersistedFlow<C>,
): void {
  config.adapter.save(
    persistenceKey(config, snapshot.flowId),
    JSON.stringify(snapshot),
  );
}

export function clearPersisted(config: PersistenceConfig, flowId: string): void {
  config.adapter.remove(persistenceKey(config, flowId));
}
