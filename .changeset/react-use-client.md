---
"cairn-react": patch
---

Mark the package as a Client Component (`"use client"`), so `FlowProvider`,
`useFlow`, and `useCurrentStep` can be imported in React Server Component
trees (Next.js App Router) without a server-component error.
