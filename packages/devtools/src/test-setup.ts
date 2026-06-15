// React Flow relies on ResizeObserver, which jsdom lacks.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const g = globalThis as unknown as Record<string, unknown>;
g["ResizeObserver"] ??= NoopObserver;
