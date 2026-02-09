---
'@irvinebroque/http-rfc-utils': patch
---

Refactor internal module structure to improve maintainability while preserving the public API exported from `src/index.ts`.
Split large `types`, `auth`, and `jsonpath` modules into focused submodules with compatibility facades, add structure guardrails (`pnpm check:structure`), and align repository tooling/docs metadata (CI Node version, pnpm-only lockfile workflow, and TypeDoc output paths).
