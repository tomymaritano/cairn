import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  // React 18 automatic JSX runtime for .tsx test files.
  esbuild: {
    jsx: "automatic",
  },
});
