// esbuild/tsup tree-shake a bare `"use client"` directive away; prepend it
// deterministically after the build so RSC consumers (Next App Router) treat
// the package as a Client Component.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../dist/index.js", import.meta.url);
const directive = '"use client";\n';
const code = readFileSync(file, "utf8");
if (!code.startsWith(directive)) writeFileSync(file, directive + code);
