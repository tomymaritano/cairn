# Contributing to Cairn

Thanks for helping build Cairn! This repo uses a **PR-based git flow** with
automated releases via [Changesets](https://github.com/changesets/changesets).

## Workflow

`main` is protected: no direct pushes. All changes land through a pull request
that passes CI.

```bash
# 1. branch off main
git switch -c feat/my-thing

# 2. make changes, then verify locally
pnpm verify        # build + typecheck + test (packages/*)

# 3. add a changeset describing the user-facing change
pnpm changeset     # pick the bumped packages + semver level

# 4. push and open a PR
git push -u origin feat/my-thing
```

CI runs on every PR:

- **Build · Typecheck · Test** across Node 20 & 22
- **Docs build** (Next.js / Fumadocs)

Both must pass before merge.

## Releases (automated)

When PRs with changesets merge to `main`, the **Release** workflow opens a
"Version Packages" PR that bumps versions and updates changelogs. Merging that
PR publishes the changed packages to npm (with provenance).

> Requires an `NPM_TOKEN` repository secret with publish access to the
> `@cairn` scope.

## Conventions

- **Commits**: conventional style (`feat:`, `fix:`, `docs:`, `chore:`).
- **Branches**: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- **Engine logic** (transitions, branching, events) → add a test in
  `packages/core`. **Hooks/UI** → test in `packages/react` / `packages/ui`.

## Project layout

| Path                  | What                                         |
| --------------------- | -------------------------------------------- |
| `packages/core`       | `cairn-core` — framework-agnostic engine    |
| `packages/react`      | `cairn-react` — React bindings              |
| `packages/ui`         | `cairn-ui` — headless accessible primitives |
| `examples/playground` | Vite demo (`pnpm play`)                      |
| `apps/docs-site`      | Fumadocs docs (`pnpm docs`)                  |
