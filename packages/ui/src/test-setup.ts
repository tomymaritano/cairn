// jsdom doesn't implement these observers, but Floating UI's `autoUpdate`
// relies on them. Minimal no-op polyfills keep the components mountable in
// tests (positioning math is integration-tested in the playground, not here).
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
g["IntersectionObserver"] ??= NoopObserver;

if (typeof globalThis.requestAnimationFrame !== "function") {
  g["requestAnimationFrame"] = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
  g["cancelAnimationFrame"] = (id: number) => clearTimeout(id);
}
