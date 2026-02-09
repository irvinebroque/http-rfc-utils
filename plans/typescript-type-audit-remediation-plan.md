# TypeScript Type Audit Remediation Plan

## Goal

Close the TypeScript best-practice gaps found in the audit while keeping the public API stable and changes incremental.

## Gaps to Address

1. Tests are not currently typechecked.
2. Strictness can be increased (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
3. JSONPath parser/lexer typing relies on repeated type assertions.
4. `hasOwnKey` helper does not provide type narrowing.
5. Tooling consistency issues (`skipLibCheck` posture and TypeScript/API Extractor version drift).

## Workstream 1: Typecheck Tests (High)

### Why

Current `typecheck` only validates `src/**/*.ts`, so unsafe test-only assertions can accumulate unnoticed.

### Changes

1. Add `tsconfig.test.json` extending `tsconfig.json` with:
   - `compilerOptions.noEmit = true`
   - `rootDir = "."`
   - `include = ["src/**/*.ts", "test/**/*.ts"]`
2. Add scripts:
   - `typecheck:test` -> `tsc --project tsconfig.test.json --noEmit`
   - `typecheck:all` -> run `typecheck` and `typecheck:test`
3. Update CI to run `pnpm typecheck:all`.
4. Remove unnecessary test casts (`as any`, `as unknown as`) by introducing typed fixtures/helpers where needed.

### Acceptance Criteria

- `pnpm typecheck:test` passes.
- No `as any` remains in `test/**/*.ts` unless explicitly justified by a comment.
- CI fails if tests regress at type level.

## Workstream 2: Adopt a Stricter Type Profile (High)

### Why

Current strict mode is good, but indexed and optional-property safety can be tightened further.

### Changes

1. Add `tsconfig.strict.json` extending `tsconfig.json` with:
   - `noUncheckedIndexedAccess: true`
   - `exactOptionalPropertyTypes: true`
2. Add script:
   - `typecheck:strict` -> `tsc --project tsconfig.strict.json --noEmit`
3. Roll out in two phases:
   - Phase A: non-blocking CI signal (report-only)
   - Phase B: blocking CI once baseline is clean
4. Remediate high-volume hotspots first (non-null assertions and index access patterns in parser/collection-heavy modules).

### Acceptance Criteria

- `pnpm typecheck:strict` passes.
- Non-null assertions are reduced, especially where index access can be narrowed structurally.
- Strict check is promoted to blocking CI.

## Workstream 3: Strengthen JSONPath Token and Parser Typing (Medium/High)

### Why

Broad token value typing forces repeated `as string` / `as number` assertions, which weakens static guarantees.

### Changes

1. Refactor `src/jsonpath/tokens.ts` token model to a discriminated union keyed by `type`.
2. Add lexer helpers with stronger return types (for example, token-specific `advance`/`expect` patterns).
3. Update `src/jsonpath/parser.ts` to remove assertion-heavy reads of `token.value`.
4. Add exhaustive checks for token handling paths.

### Acceptance Criteria

- Parser compiles without repeated primitive assertions for token values.
- JSONPath tests stay green.
- Type safety of parser control flow improves without changing runtime behavior.

## Workstream 4: Upgrade `hasOwnKey` to a True Type Guard (Medium)

### Why

The current helper returns `boolean` only, so callers do not benefit from key narrowing.

### Changes

1. Update `src/object-map.ts`:
   - change `hasOwnKey(record: object, key: string): boolean`
   - to a generic predicate form that narrows keys against object shape.
2. Update call sites to rely on narrowing instead of follow-up assertions.
3. Add focused tests validating runtime behavior and compile-time ergonomics (where practical in existing test setup).

### Acceptance Criteria

- Existing behavior is unchanged at runtime.
- Call sites gain stronger narrowing with fewer casts.

## Workstream 5: Tooling Consistency and Policy (Medium)

### Why

TypeScript/API Extractor version drift and `skipLibCheck` policy ambiguity can cause inconsistent local vs CI outcomes.

### Changes

1. Resolve TS/API Extractor mismatch policy:
   - either pin TypeScript to API Extractor's supported range, or
   - regularly upgrade API Extractor to reduce drift.
2. Define `skipLibCheck` policy explicitly:
   - keep `skipLibCheck: true` for fast inner-loop checks, and
   - add one stricter CI pass with `skipLibCheck: false` in a dedicated config (or switch fully if performance is acceptable).
3. Keep `pnpm api:extract` in pre-PR quality gates and monitor warnings.

### Acceptance Criteria

- No persistent TS version mismatch warning in the standard API extraction workflow.
- `skipLibCheck` behavior is documented and enforced via explicit script/config.

## Rollout Plan

### Phase 1 (Quick Wins)

1. Workstream 1 (test typecheck)
2. Workstream 4 (`hasOwnKey` type guard)
3. Workstream 5 policy decisions and scripts

### Phase 2 (Strictness Adoption)

1. Workstream 2 with non-blocking strict CI
2. Initial remediation pass for strictness errors
3. Promote strict check to blocking

### Phase 3 (Parser Typing Refactor)

1. Workstream 3 token/parser typing redesign
2. Final cleanup of assertion-heavy code paths

## Validation Commands

Run these before PR creation:

```bash
pnpm check:structure
pnpm typecheck
pnpm typecheck:test
pnpm typecheck:strict
pnpm test
pnpm build
pnpm api:extract
pnpm semver:check
```

## Done Definition

- All five audited gaps are resolved or explicitly deferred with rationale.
- Type checks cover both source and tests.
- Strict profile is active in CI.
- Parser and utility helper typing improvements are merged without runtime regressions.
- Toolchain version/policy decisions are documented and reproducible.
