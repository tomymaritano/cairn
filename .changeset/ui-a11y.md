---
"cairn-ui": minor
---

Accessibility: `CairnSpotlight` now respects `prefers-reduced-motion` (drops its
transition), and a new `usePrefersReducedMotion()` hook is exported. Adds an
automated axe-core test asserting the active tour (popover + spotlight) has no
accessibility violations.
