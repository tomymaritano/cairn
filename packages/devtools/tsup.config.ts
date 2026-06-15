import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom", "cairn-core", "@xyflow/react", "@dagrejs/dagre"],
  // `"use client"` is prepended by scripts/add-use-client.mjs after the build.
});
