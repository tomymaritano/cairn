// esbuild/tsup drop the `"use client"` directive when bundling (it's treated
// as a no-op string and tree-shaken). We prepend it deterministically after
// the build so React Server Component consumers (Next App Router) treat the
// whole package as a Client Component.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../dist/index.js", import.meta.url);
const directive = '"use client";\n';
const code = readFileSync(file, "utf8");

if (!code.startsWith(directive)) {
  writeFileSync(file, directive + code);
}
