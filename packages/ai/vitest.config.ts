import { defineConfig } from "vitest/config";

// All units are pure / inject the LLM — no DOM, no network.
export default defineConfig({
  test: { environment: "node" },
});
