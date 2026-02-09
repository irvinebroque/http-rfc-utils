---
'@irvinebroque/http-rfc-utils': patch
---

Refactor internal module structure and tighten type-safety guardrails while preserving the public API exported from `src/index.ts`.
Split large `types`, `auth`, and `jsonpath` modules into focused submodules with compatibility facades, add structure/typecheck workflows (`pnpm check:structure`, strict/lib type checks), improve JSONPath and key-guard typing, and align tooling/docs metadata for consistent CI and API extraction.
