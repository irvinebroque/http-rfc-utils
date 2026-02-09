# Codebase Structure and Maintainability Plan

## Objective

Improve long-term maintainability and clarity without breaking the public API.
The current conceptual module layout is strong (RFC/topic-oriented), but several files have grown large enough to slow onboarding, reviews, and safe change velocity.

## Current Pressure Points

- Large modules are hard to reason about in isolation (`src/jsonpath.ts`, `src/auth.ts`, `src/types.ts`, `src/index.ts`).
- `src/types.ts` acts as a high-coupling hub across most modules.
- Flat `src/` structure is becoming harder to scan as module count grows.
- Tooling and metadata drift adds maintenance overhead (docs output paths, lockfile/version mismatches, Node version messaging).

## Constraints

- Keep current public exports stable from `src/index.ts` during refactor.
- Preserve behavior and RFC alignment.
- Keep changes incremental and releasable in small PRs.
- Require `pnpm test` and `pnpm build` passing at every phase.

## Non-Goals

- No major API redesign in this refactor.
- No new RFC feature work except where needed to keep parity during file moves.
- No broad formatting/style churn.

## Refactor Phases

### Phase 0 - Guardrails and Baseline

1. Capture a baseline of module sizes and test/runtime behavior.
2. Add a lightweight architecture check script to verify expected barrel exports and prevent accidental orphan modules.
3. Record a dependency snapshot (which modules import which internals) for regression comparison.

Done when:

- Baseline notes are committed.
- A repeatable structure check can run in CI or locally.

### Phase 1 - Decompose `types.ts` into Domain Type Modules

1. Create `src/types/` with focused files by domain (for example: `auth.ts`, `cache.ts`, `link.ts`, `jsonpath.ts`, `signature.ts`, `shared.ts`).
2. Keep compatibility by turning `src/types.ts` into a re-export facade.
3. Migrate internal imports to domain type files gradually (do not do all modules at once).

Done when:

- `src/types.ts` is thin and mostly re-exports.
- No behavior or export changes.
- Tests and build pass.

### Phase 2 - Split `auth.ts` by Protocol Area

1. Create `src/auth/` with `basic.ts`, `bearer.ts`, `digest.ts`, and `shared.ts`.
2. Move parsing helpers common to auth schemes into `shared.ts`.
3. Keep `src/auth.ts` as compatibility barrel that re-exports existing API.
4. Ensure test coverage still maps cleanly to Basic/Bearer/Digest sections.

Done when:

- `src/auth.ts` is primarily exports.
- No public API delta.
- Existing auth tests remain green.

### Phase 3 - Split `jsonpath.ts` into Lexer/Parser/Evaluator

1. Create `src/jsonpath/` modules:
   - `tokens.ts` (token types/constants)
   - `lexer.ts`
   - `parser.ts`
   - `evaluator.ts`
   - `builtins.ts`
   - `index.ts` (internal barrel)
2. Keep top-level `src/jsonpath.ts` as the stable public facade.
3. Add focused tests for lexer/parser/evaluator boundaries where useful.

Done when:

- JSONPath logic is navigable by concern.
- Public API and behavior are unchanged.
- Full test suite passes.

### Phase 4 - Improve Source Discoverability

1. Introduce domain folders for high-level grouping while preserving top-level facades:
   - `src/headers/`
   - `src/linking/`
   - `src/security/`
   - `src/negotiation/`
2. Move only when a folder gives clear value; avoid churn-only moves.
3. Keep `src/index.ts` as the canonical package entrypoint.

Done when:

- Module discovery is easier for new contributors.
- Import paths used by consumers are unchanged.

### Phase 5 - Tooling and Metadata Consistency

1. Reconcile Node version messaging across README, package engines, and GitHub workflows.
2. Choose one lockfile strategy (`pnpm-lock.yaml` only, or explicit npm support) and align checked-in files.
3. Fix docs generation assumptions (TypeDoc output path and post-processing script) so docs tooling reflects actual repo layout.

Done when:

- Build/test/docs commands are coherent.
- Repo metadata no longer conflicts.

### Phase 6 - Final Hardening

1. Run full verification:
   - `pnpm test`
   - `pnpm build`
2. Spot-check README import examples against `src/index.ts` exports.
3. Document the resulting architecture briefly for contributors.

Done when:

- CI is green.
- Public API remains stable.
- The architecture is easier to maintain than before.

## Suggested PR Sequence

1. PR 1: Guardrails and baseline docs.
2. PR 2: `types.ts` decomposition with compatibility re-exports.
3. PR 3: `auth.ts` split.
4. PR 4: `jsonpath.ts` split.
5. PR 5: Optional domain grouping moves.
6. PR 6: Tooling/version/lockfile/docs consistency cleanup.

## Risk Management

- Risk: accidental API break during file moves.
  - Mitigation: keep stable top-level facades and verify exports in tests/scripts.
- Risk: behavior drift in parser-heavy modules.
  - Mitigation: move code first, then refactor internals; keep tests unchanged during moves.
- Risk: large PRs reduce review quality.
  - Mitigation: enforce small, phase-scoped PRs.

## Exit Criteria

- Large hotspot files are decomposed.
- Type coupling is reduced.
- Public API remains unchanged.
- Tooling and docs are internally consistent.
- Contributors can quickly locate logic by domain.
