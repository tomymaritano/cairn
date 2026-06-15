"use client";

import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";

const MANAGERS = [
  { id: "npm", cmd: "npm install cairn-react" },
  { id: "pnpm", cmd: "pnpm add cairn-react" },
  { id: "yarn", cmd: "yarn add cairn-react" },
  { id: "bun", cmd: "bun add cairn-react" },
];

/** Package-manager install tabs for the landing hero. */
export function InstallTabs() {
  return (
    <Tabs items={MANAGERS.map((m) => m.id)}>
      {MANAGERS.map((m) => (
        <Tab key={m.id} value={m.id}>
          <DynamicCodeBlock lang="bash" code={m.cmd} />
        </Tab>
      ))}
    </Tabs>
  );
}
