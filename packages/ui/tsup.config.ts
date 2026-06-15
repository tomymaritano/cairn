import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom", "react-cairn", "cairn-core"],
  // `"use client"` is prepended by scripts/add-use-client.mjs after the build —
  // esbuild tree-shakes a banner/directive away, so we add it deterministically.
});
