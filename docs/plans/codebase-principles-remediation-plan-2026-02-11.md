# AGENTS Principles Remediation Plan (2026-02-11)

## Scope

Implement the highest-impact remediation items identified in `docs/codebase-principles-audit-2026-02-11.md` while preserving compatibility facades and parser tolerance defaults.

In scope:

- Explicit OpenAPI exports in canonical entrypoint.
- Formatter semantic strictness for selected auth/header/security modules.
- RFC map reference reconciliation for missing API surface entries.
- Direct regression tests for previously uncovered public helpers.

Out of scope for this session:

- Large abstraction rewrites (`internal-parameterized-members` stack).
- JSONPath parser architecture refactor.
- Barrel ownership taxonomy redesign.

## Constraints from AGENTS.md

- Keep RFC semantics visible at call sites where practical.
- Preserve parser tolerance (`null`/empty on syntax-invalid input) unless explicitly changing parser contract.
- Formatters/validators must throw for semantic-invalid input.
- Keep changes liftable and explicit over generic abstraction.
- Maintain deterministic `node:test` coverage with spec citations.

## Phase Plan

### Phase 1 - API Contract Hardening

Files:

- `src/index.ts`

Tasks:

- Replace `export * from './openapi.js';` with explicit named exports matching `src/openapi/index.ts`.

Acceptance criteria:

- No wildcard OpenAPI export remains in `src/index.ts`.
- Typecheck remains clean for OpenAPI symbol exports.

### Phase 2 - Formatter Semantic Enforcement

Files:

- `src/auth/basic.ts`
- `src/auth/bearer.ts`
- `src/auth/digest.ts`
- `src/headers.ts`
- `src/security-txt.ts`

Tasks:

- `formatBasicAuthorization`: throw contextual `Error` for invalid username/password semantics.
- `formatBearerAuthorization`: throw contextual `Error` for invalid bearer token syntax.
- `formatDigestChallenge` and `formatDigestAuthorization`: validate required fields and qop coupling at format time; throw contextual `Error` on semantic-invalid input.
- `formatRetryAfter`: reject non-finite/non-integer/negative numeric input.
- `formatSecurityTxt`: pre-validate `Expires` date and throw contextual field error.

Acceptance criteria:

- Changed formatters throw on semantic-invalid input.
- Parser behavior remains tolerant and unchanged.

### Phase 3 - Tests and Public Surface Coverage

Files:

- `test/auth.test.ts`
- `test/headers.test.ts`
- `test/security-txt.test.ts`
- `test/datetime.test.ts`

Tasks:

- Add throw-path tests for Basic/Bearer formatter invalid input.
- Add direct `formatWWWAuthenticate` coverage.
- Add digest formatter required-field throw tests.
- Add invalid numeric `formatRetryAfter` tests.
- Add invalid `Expires` formatting error-context test.
- Add deterministic direct tests for `isExpired` and `secondsUntil` with mocked `Date.now`.

Acceptance criteria:

- New tests fail if formatter contract regresses to silent normalization/omission.
- Date helper tests are deterministic and isolated.

### Phase 4 - RFC Map Reference Integrity

Files:

- `docs/reference/rfc-map.md`

Tasks:

- Add source-of-truth note referencing `docs/src/lib/rfc-map.ts` and `src/index.ts`.
- Expand `src/auth.ts` row to include WebAuthn export coverage.
- Add missing `src/json-patch.ts`, `src/json-merge-patch.ts`, and `src/sorting.ts` rows.

Acceptance criteria:

- Reference map reflects current exported surface for the targeted gaps.
- Readers can identify canonical sources for map verification.

## Verification

Targeted tests:

```bash
pnpm exec tsx --test test/auth.test.ts
pnpm exec tsx --test test/headers.test.ts
pnpm exec tsx --test test/security-txt.test.ts
pnpm exec tsx --test test/datetime.test.ts
```

Repository gates before final handoff:

```bash
pnpm check:structure
pnpm typecheck
pnpm test
pnpm build
```

## Risk Notes and Rollback Units

Primary risk:

- Formatter contract changes (`null`/coercion to throw) can affect consumers.

Rollback units:

- Unit A: `src/index.ts` explicit export block.
- Unit B: auth formatter contract changes + auth tests.
- Unit C: digest formatter validation + digest tests.
- Unit D: retry-after and security-txt formatter changes + tests.
- Unit E: RFC map reference edits.

## Revision Loop (Subagent Critique Passes)

Pass 1 - Contract review:

- Verify formatter throw behavior is consistent and parser tolerance is intact.

Pass 2 - AGENTS traceability review:

- Verify each changed behavior is explicit in module-local code and error messages are field-specific.

Pass 3 - Test adequacy review:

- Verify coverage includes all changed branches and export-level guardrails.

Pass 4 - Final hygiene review:

- Run targeted tests and full repo gates; fix regressions before commit.
