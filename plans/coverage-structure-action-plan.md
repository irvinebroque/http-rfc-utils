# Coverage and Structure Action Plan

## Objective

Turn current findings into a concrete, phased plan that improves test coverage, reduces code duplication, and keeps architecture maintainable without breaking the public API.

## Baseline (2026-02-08)

- Test status: `1749` passing, `0` failing (`pnpm test`).
- Coverage status (`node --import tsx --experimental-test-coverage --test test/*.test.ts`):
  - all files: line `96.46%`, branch `81.18%`, functions `95.82%`
  - lowest-covered runtime modules:
    - `src/response.ts` (line `85.38%`, functions `44.44%`)
    - `src/cache-status.ts` (line `85.56%`, branch `51.35%`)
    - `src/cookie.ts` (line `90.68%`, branch `44.14%`)
    - `src/trace-context.ts` (line `90.74%`, branch `59.09%`)
    - `src/cors.ts` (functions `77.78%`)
    - `src/ni.ts` (branch `57.69%`)
- Structure guardrails are working: `pnpm check:structure` passes.

## Progress update (2026-02-09)

- Validation status:
  - `pnpm check:structure` ✅
  - `pnpm typecheck` ✅
  - `pnpm test` ✅
  - `pnpm test:coverage:check` ✅
  - `pnpm build` ✅
- Coverage status (`pnpm test:coverage:check`):
  - all files: line `97.25%`, branch `83.46%`, functions `97.36%`
  - priority modules:
    - `src/response.ts`: line `99.65%`, branch `95.45%`, functions `100.00%`
    - `src/cors.ts`: line `98.99%`, branch `94.81%`, functions `100.00%`
    - `src/cache-status.ts`: line `95.81%`, branch `74.14%`, functions `100.00%`
    - `src/cookie.ts`: line `98.04%`, branch `81.03%`, functions `100.00%`
    - `src/trace-context.ts`: line `95.69%`, branch `80.54%`, functions `100.00%`
    - `src/ni.ts`: line `93.39%`, branch `77.42%`, functions `90.48%`
- SemVer policy target achieved:
  - `scripts/semver/policy.ts`: line `96.39%`, branch `89.83%`, functions `100.00%`
- Shared type decomposition progress:
  - `src/types/shared.ts` is now a thin compatibility facade with star re-exports across domain modules
  - moved authentication and cache/validator type blocks into `src/types/auth.ts` and `src/types/cache.ts`
  - moved link and negotiation type blocks into `src/types/link.ts` and `src/types/negotiation.ts`
  - moved JSONPath and HTTP Signature type ownership into `src/types/jsonpath.ts` and `src/types/signature.ts`
  - moved URI/URI Template/NI/Well-Known, Digest, and discovery document types into `src/types/uri.ts`, `src/types/digest.ts`, and `src/types/discovery.ts`
  - moved header-focused types into `src/types/header.ts`
  - moved security-focused types into `src/types/security.ts`
  - moved Structured Fields and cookie types into `src/types/structured-fields.ts` and `src/types/cookie.ts`
  - moved pagination and problem-detail contracts into `src/types/pagination.ts` and `src/types/problem.ts`
  - extended structure checks to require the new `src/types/*` domain modules
- Structure/export-maintenance progress:
  - strengthened `pnpm check:structure` to verify root public modules in `src/` are exported by `src/index.ts`, with explicit utility exclusions and automatic exclusion for modules prefixed `internal-`
- `src/types/shared.ts` reduced to `17` lines (down from `216` in the previous slice, `248` before that, `491` before that, `982` before that, `1030` before that, and `1427` at this point in the branch)
- Remaining explicit work:
  - keep `src/types/shared.ts` as a stable compatibility facade as new domain modules are added
  - keep the explicit exclusion list and `internal-*` convention current as root modules evolve, and evaluate export-manifest generation as a follow-up optimization

## Scope

### In Scope

1. Add a first-class coverage command and CI thresholds.
2. Raise coverage in prioritized low-covered modules.
3. Extract shared parsing/quoting primitives to reduce duplication.
4. Continue structure work: shrink `src/types/shared.ts` and reduce manual export churn in `src/index.ts`.
5. Keep semver guard tests and raise coverage for `scripts/semver/policy.ts`.

### Out of Scope

- Public API redesign.
- RFC feature expansion not needed for coverage/refactor goals.

## Workstreams

## 1) Coverage command + CI thresholds

### Tasks

1. Add a canonical coverage script to `package.json`:
   - `"test:coverage": "node --import tsx --experimental-test-coverage --test test/*.test.ts"`
2. Add a small coverage gate script (for CI parsing/fail conditions) under `scripts/`.
3. Enforce repository-level thresholds in CI (start conservative, then ratchet):
   - initial floor: line `>= 96`, branch `>= 81`, functions `>= 95`
4. Add per-file guardrails for known hotspots (warn first, fail later).
5. Document local/CI coverage workflow in `README.md`.

### Acceptance Criteria

- `pnpm test:coverage` runs locally and in CI.
- PRs fail when global thresholds regress.
- Coverage instructions are documented and reproducible.

## 2) Targeted test expansion (highest ROI modules)

### Priority order

1. `src/response.ts`
2. `src/cors.ts`
3. `src/cache-status.ts`
4. `src/cookie.ts`
5. `src/trace-context.ts`
6. `src/ni.ts`

### Tasks by module

- `src/response.ts`
  - Add tests for untested helpers: `headResponse`, `redirectResponse`, `noContentResponse`, `textResponse`.
  - Add negative/edge tests around optional headers and OPTIONS behavior.
- `src/cors.ts`
  - Add coverage for `buildPreflightHeaders`, `isOriginAllowed`, `corsHeaders`.
  - Add branch tests for explicit/default origin handling and `Vary` merge behavior.
- `src/cache-status.ts`
  - Add tests for invalid `fwd` token handling, integer validation branches, and extension parameter preservation.
- `src/cookie.ts`
  - Add tests for `parseCookieDate` edge cases, quoted/unquoted cookie value branches, and domain/path edge behavior.
- `src/trace-context.ts`
  - Add tests for validation failure branches, truncation boundaries, malformed tracestate entries, and strict key/value validation.
- `src/ni.ts`
  - Add tests for query parsing failures, malformed hierarchy edge cases, canonical base64url rejections, and digest-length mismatch branches.

### Acceptance Criteria

- Each priority module increases in line + branch coverage.
- `src/response.ts` function coverage improves from `44.44%` to at least `85%`.
- No regressions in existing tests; `pnpm test` remains green.

## 3) Shared utility extraction (code reuse)

### Tasks

1. Introduce internal helpers for repeated quoting logic:
   - `escapeQuotedString(value)`
   - `quoteString(value)`
2. Consolidate repeated weighted-header/q parsing used across:
   - `src/negotiate.ts`
   - `src/language.ts`
   - `src/encoding.ts`
3. Consolidate structured-field param mapping patterns shared by:
   - `src/cache-status.ts`
   - `src/proxy-status.ts`
4. Normalize empty-header checks to a single helper (`isEmptyHeader`) where appropriate.

### Acceptance Criteria

- Duplicated parsing/quoting snippets are reduced in affected files.
- Behavior remains unchanged (all tests pass).
- New helpers are covered by dedicated tests.

## 4) Structure continuation and export maintainability

### Tasks

1. Continue decomposition of `src/types/shared.ts` into domain files while preserving `src/types.ts` compatibility facade.
2. Reduce manual export maintenance burden in `src/index.ts`:
   - evaluate scripted generation of export manifests or validation checks.
3. Extend `pnpm check:structure` expectations as decomposition progresses.
4. Keep docs aligned (`docs/architecture.md`, relevant README sections).

### Acceptance Criteria

- `src/types/shared.ts` shrinks materially across incremental PRs.
- Public exports remain stable.
- `pnpm check:structure`, `pnpm test`, and `pnpm build` all pass during each phase.

## 5) SemVer guard hardening

### Tasks

1. Expand tests for semver policy logic (`test/semver-guard.test.ts`) to cover:
   - invalid allowlist file and schema cases
   - expired allowlist behavior
   - strict mode behavior and bump-order checks
   - no-code-change vs code-change intent paths
2. Add focused fixtures to hit low-covered branches in `scripts/semver/policy.ts`.
3. Add target threshold for semver policy module coverage:
   - line `>= 85`, branch `>= 75`, functions `>= 85`

### Acceptance Criteria

- `scripts/semver/policy.ts` coverage rises from current baseline (`66.80%` line, `52.63%` branch, `50.00%` funcs).
- Semver guard behavior is fully test-backed for allowlist and strict-mode edge cases.

## Delivery sequence (PR plan)

1. **PR 1:** coverage command + CI thresholds + docs.
2. **PR 2:** `response` + `cors` test expansion.
3. **PR 3:** `cache-status` + `cookie` + `ni` test expansion.
4. **PR 4:** `trace-context` and semver policy test expansion.
5. **PR 5:** shared utility extraction (quoting/parsing/SF mapping).
6. **PR 6+:** incremental `types/shared` decomposition + index export maintenance improvements.

## Definition of Done

- All five recommendations are implemented and documented.
- Coverage command is canonical and enforced in CI.
- Priority modules show measurable branch/line/function coverage improvements.
- Shared parsing/quoting code is centralized and tested.
- `src/types/shared.ts` is trending downward via incremental decomposition.
- Semver policy guard has robust branch coverage and stable tests.
