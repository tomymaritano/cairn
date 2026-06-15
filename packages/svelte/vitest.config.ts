import { defineConfig } from "vitest/config";

// Store logic is plain JS — no DOM needed.
export default defineConfig({
  test: { environment: "node" },
});
