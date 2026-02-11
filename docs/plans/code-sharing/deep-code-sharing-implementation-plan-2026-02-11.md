# Deep Code-Sharing Implementation Plan (2026-02-11, revised)

## Goal
Implement the deep code-sharing opportunities with strict behavior parity, small rollback-safe PRs, and explicit subagent handoffs.

- Applies to: `src/**/*.ts`, `test/*.test.ts`, and docs/plans for this initiative.
- Last verified: `2026-02-11`.
- Verified against: commit `6ea2432`.
- Sources:
  - `docs/code-sharing-opportunities-deep-2026-02-11.md`
  - `AGENTS.md`
  - `package.json`

## Agent Quick Reference
- Goal: land code-sharing refactors without public behavior drift.
- Preconditions: clean install, passing baseline tests, no unresolved merge conflicts.
- Inputs: this plan, opportunities doc, AGENTS contracts, current HEAD.
- Commands (with cwd): see `Quality Gates` and `Per-Phase Verify`.
- Expected success signals: parity tests pass, API/semver checks clean, no new behavior diffs.
- Failure signals: changed parse tolerance/throwing contracts, issue-message drift, API extract diffs.
- Rollback/cleanup: revert consumer wiring first, keep helper only if used by >=2 modules, remove dead helpers within next PR.
- Source of truth paths: `AGENTS.md`, `docs/code-sharing-opportunities-deep-2026-02-11.md`, `src/index.ts`, `src/auth.ts`, `src/jsonpath.ts`.
- Last verified: `2026-02-11`.

## Execution Model (Subagent-first)

Use subagents where possible with mandatory artifacts:

1. `explore` (required first for each slice)
   - Produce: call-site inventory + edge-case map + RFC/test references.
   - Artifact path: `docs/plans/code-sharing/artifacts/<slice-id>-inventory.md`.
2. `general` (implementation)
   - Produce: helper + first consumer migration + tests.
3. `docs` (required before PR open)
   - Produce: slice note update in this plan + rationale note if any intentional behavior change.
4. Fallback: if a subagent is unavailable, `general` executes that role's checklist and records it in the artifact file.

## Hard Constraints

- Preserve parser semantics: invalid syntax-level input returns `null`/empty where current behavior does so (`AGENTS.md` parser contract).
- Preserve formatter/validator semantics: semantic-invalid input throws `Error` with field/value context.
- Keep public facades stable: `src/index.ts`, `src/auth.ts`, `src/jsonpath.ts`.
- No export expansion unless intentionally approved and validated by API/semver checks.
- New/updated tests must cite spec sources per repo conventions.

## Phase 0: Baseline Characterization (mandatory before any refactor)

### Targets
- Add: `test/code-sharing-baselines.test.ts`
- Add fixtures dir: `test/fixtures/code-sharing/` (Digest, OpenAPI issues, percent-decoding cases)
- Update: `docs/plans/code-sharing/artifacts/phase-0-baseline.md`

### Work
- Capture current behavior baselines for:
  - Digest parse/format + error text
  - OpenAPI runtime-expression/link-callback issue arrays/messages
  - Percent-decoding strict/lenient outcomes
- Add stable fixture-driven assertions before helper extraction.

### Exit Criteria
- Baseline tests pass on current HEAD.
- No refactor phases start until baseline artifacts are merged.

## Phase 1: Parameterized Member Helper

### Targets
- Add: `src/internal-parameterized-members.ts`
- Update: `src/header-utils.ts`
- Migrate in order:
  1. `src/forwarded.ts`
  2. `src/prefer.ts`
  3. `src/hsts.ts`
  4. `src/content-disposition.ts`
  5. `src/alt-svc.ts`
- Tests:
  - `test/forwarded.test.ts`
  - `test/prefer.test.ts`
  - `test/hsts.test.ts`
  - `test/content-disposition.test.ts`
  - `test/alt-svc.test.ts`
  - `test/header-utils.test.ts`

### PR Slices
- 1A: helper + `forwarded` + `prefer`
- 1B: `hsts` + `content-disposition`
- 1C: `alt-svc` + cleanup

### Risk Controls
- Freeze helper options after 1A.
- Require parse->format->parse parity cases for each migrated consumer.

## Phase 2: Auth Param Schema Engine

### Phase 2A (Basic/Bearer only)
- Add: `src/auth/internal-auth-param-schema.ts`
- Update: `src/auth/shared.ts`, `src/auth/basic.ts`, `src/auth/bearer.ts`
- Tests: `test/auth.test.ts`, targeted guard coverage in `test/digest.test.ts`

### Phase 2B (Digest incremental)
- Update: `src/auth/digest.ts`, `src/auth/shared.ts`, `src/auth/internal-auth-param-schema.ts`
- Migration order:
  1. challenge
  2. credentials
  3. auth-info
- Tests: `test/digest.test.ts`, `test/auth.test.ts`, `test/code-sharing-baselines.test.ts`

### Risk Controls
- Add explicit error text lock tests before each Digest sub-slice.
- Cross-field validator hooks required before credentials/auth-info migration.

## Phase 3: Structured-Field Projection Adapters

### Targets
- Add: `src/internal-sf-projection.ts`
- Update core: `src/structured-field-helpers.ts`
- List-first migrations:
  - `src/cache-status.ts`
  - `src/proxy-status.ts`
  - `src/client-hints.ts`
  - `src/cache-groups.ts`
  - `src/link-template.ts`
- Dict migrations:
  - `src/digest.ts`
  - `src/reporting.ts`
  - `src/priority.ts`
  - `src/compression-dictionary.ts`
  - `src/http-signatures.ts`
- Tests:
  - `test/structured-field-helpers.test.ts`
  - Per-module tests for each migrated module above

### PR Slices
- 3A: adapter API + 2 list modules
- 3B: remaining list modules
- 3C: 2 dict modules
- 3D: remaining dict modules + normalization

### Risk Controls
- No more than 3 source modules migrated per PR after adapter introduction.
- Fail-fast if any strict/tolerant policy mismatch is detected.

## Phase 4: OpenAPI Runtime Unification (split for safety)

### Phase 4A: Scanner unification only
- Add: `src/openapi/internal-runtime-template.ts`
- Update: `src/openapi/link-callback.ts`
- Tests: `test/openapi-link-callback.test.ts`, baseline test file

### Phase 4B: Descriptor registry only
- Add: `src/openapi/internal-runtime-expression-registry.ts`
- Update: `src/openapi/runtime-expression.ts`
- Tests: `test/openapi-runtime-expression.test.ts`, `test/openapi-lint.test.ts`

### Risk Controls
- Keep `src/openapi/index.ts` unchanged unless strictly required.
- If changed, API/semver checks are mandatory in same PR.

## Phase 5: Media-Type Parsing Convergence

### Targets
- Update: `src/header-utils.ts`, `src/negotiate.ts`, `src/patch.ts`
- Tests: `test/negotiate.test.ts`, `test/patch.test.ts`, `test/header-utils.test.ts`

### Required Pre-step
- Create call-site audit artifact:
  - `docs/plans/code-sharing/artifacts/phase-5-media-type-callsites.md`
  - Include all `parseMediaType` and negotiate parser call paths.

### Risk Controls
- Keep ranking logic in `negotiate` unchanged.
- Verify `Accept-Patch` behavior parity via existing and baseline tests.

## Phase 6: Percent-Decoding Policy Convergence

### Targets
- Update: `src/internal-uri-encoding.ts`, `src/uri.ts`, `src/ext-value.ts`, `src/openapi/path-server-resolver.ts`
- Tests: `test/uri.test.ts`, `test/ext-value.test.ts`, `test/openapi-path-server-resolver.test.ts`, baseline test file

### PR Slices
- 6A: shared wrappers in `internal-uri-encoding` + one consumer (`uri.ts`)
- 6B: `ext-value.ts` + `path-server-resolver.ts`

### Risk Controls
- Explicit strict-vs-lenient behavior table maintained in tests.
- No consumer migration without malformed escape fixtures.

## Phase 7: UTF-8 Helper Adoption Cleanup

### Targets
- Update: `src/internal-unicode.ts`, `src/http-signatures.ts`, `src/ext-value.ts`, `src/robots.ts`, `src/reporting.ts`, `src/auth/webauthn-client-data.ts`
- Tests:
  - `test/http-signatures.test.ts`
  - `test/ext-value.test.ts`
  - `test/robots.test.ts`
  - `test/reporting.test.ts`
  - `test/webauthn-client-data.test.ts`

### Risk Controls
- Add `tryDecodeUtf8` only if used by >=2 modules.
- Treat as mechanical-only; reject semantic diffs.

## Per-PR Quality Gates (required)

Run for every PR slice:

```bash
# cwd: /Users/brendan/src/http-rfc-utils
pnpm check:structure
pnpm typecheck
pnpm test
pnpm build
```

Run for every merge-candidate slice in this initiative (not optional):

```bash
# cwd: /Users/brendan/src/http-rfc-utils
pnpm typecheck:all
pnpm typecheck:strict
pnpm typecheck:lib
pnpm api:extract
pnpm semver:check
```

Run for parser/security-sensitive slices (Phases 1, 2B, 3, 5, 6):

```bash
# cwd: /Users/brendan/src/http-rfc-utils
pnpm security:ci
```

Changeset control:

- If CI requires changesets for PRs, include a real `.changeset/*.md` file in each PR that changes shipped behavior or types.

## Stop/Go Criteria

Stop and fix before continuing if any occurs:

- API extractor diff is unexpected.
- Semver check fails.
- Baseline fixture outputs change without approved rationale.
- Parser tolerance contract changes (`null`/empty vs throw).
- Error message/code drift in Digest/OpenAPI without intentional documented change.

## Rollback Strategy

- First revert consumer wiring, keep helper only when already reused by >=2 modules.
- If helper is single-consumer after rollback, remove helper in same recovery PR.
- Keep baseline tests intact; they are the regression alarm.
- Never rollback by combining multiple phase reverts in one commit.

## Final Definition of Done

- All phases completed with passing baseline + module tests.
- Shared helpers adopted in target modules with no unplanned behavior drift.
- Facade/API stability preserved or explicitly versioned and documented.
- All quality gates pass on final branch state.
- Artifacts exist for each slice under `docs/plans/code-sharing/artifacts/`.
