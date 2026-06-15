// esbuild/tsup tree-shake a bare `"use client"` directive away; prepend it
// deterministically after the build so React Server Component consumers
// (Next App Router) can import the provider/hooks without a server-component error.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../dist/index.js", import.meta.url);
const directive = '"use client";\n';
const code = readFileSync(file, "utf8");
if (!code.startsWith(directive)) writeFileSync(file, directive + code);
