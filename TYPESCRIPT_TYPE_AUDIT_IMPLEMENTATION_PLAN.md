# TypeScript Type Audit Implementation Plan

Date: 2026-02-10
Source: `TYPESCRIPT_TYPE_AUDIT_FINDINGS.md`

## Objectives

- Eliminate high-impact type-soundness gaps identified in the audit (H1-H7).
- Keep runtime behavior stable for valid inputs and preserve existing public API entrypoints.
- Maintain RFC and spec compliance while tightening trust-boundary typing.
- Ensure `pnpm typecheck` remains green after each workstream and at completion.

## Guardrails (Non-Negotiable)

- No intentional behavior changes for valid, specification-compliant inputs.
- No breaking public API removals or renames.
- Any stricter validation must align with RFC/OpenAPI requirements and remain tolerant where existing parser contracts require tolerance.
- Prefer additive/internal type refinements over externally breaking type contractions unless already invalid by spec.

## Execution Scope

This implementation pass targets all high-impact findings:

1. H1 `structured-field-schema` key/value type coupling.
2. H2 JSONPath singular query segment soundness.
3. H3 Linkset guard completeness for typed return.
4. H4 `parseApiCatalog` assertion-free profile narrowing.
5. H5 OpenAPI runtime expression discriminated typing.
6. H6 OpenAPI apiKey security scheme location narrowing.
7. H7 Pagination cursor trust-boundary parse narrowing.

Medium/low findings remain backlog unless directly touched as part of these changes.

## Workstreams

### WS1 - Structured Field Schema Typing (H1)

- Files: `src/structured-field-schema.ts`, call sites in status modules.
- Actions:
  - Make schema entry callbacks property-aware:
    - `parse: (value) => T[K] | undefined`
    - `format: (value: T[K]) => SfBareItem`
  - Replace `{} as T` construction with `Partial<T>` plus typed assignment helper.
  - Preserve extension passthrough behavior and `knownKeyProtection` semantics.
- Validation:
  - `pnpm typecheck`
  - Targeted status/parser tests if affected.

### WS2 - JSONPath Singular Query Soundness (H2)

- Files: `src/types/jsonpath.ts`, `src/jsonpath/parser.ts`.
- Actions:
  - Introduce singular segment subset types (`JsonPathSingularSegment`, singular selector subset as needed).
  - Narrow `JsonPathSingularQuery.segments` to singular-only segments.
  - Add parser helper guard to verify segments are singular before constructing singular-query nodes.
  - Keep tolerant parse contract (`null` on invalid) unchanged.
- Validation:
  - `pnpm typecheck`
  - JSONPath parser/evaluator tests.

### WS3 - Linkset/API Catalog Trust Boundary Soundness (H3, H4)

- Files: `src/linkset.ts` (and `src/types/link.ts` only if strictly needed without API break).
- Actions:
  - Replace assertion-based `isValidLinkset` internals with guard helpers that validate `LinksetTarget` member domains before claiming `Linkset`.
  - Ensure `parseLinksetJson` returns validated shape (not unchecked cast passthrough).
  - In `parseApiCatalog`, narrow `profile` via runtime string check and remove `as ApiCatalog` cast-only return.
- Validation:
  - `pnpm typecheck`
  - Linkset/API catalog tests.

### WS4 - OpenAPI Runtime Expression Model Precision (H5, H6)

- Files: `src/types/openapi.ts`, `src/openapi/runtime-expression.ts`, dependent OpenAPI modules.
- Actions:
  - Split `OpenApiRuntimeExpression` into discriminated union variants keyed by `type` with required fields only where valid (`name` for header/query/path forms, `pointer` optional only for body forms).
  - Remove fallback usage patterns like `parsed.name ?? ''` by relying on discriminated narrowing.
  - Narrow `OpenApiApiKeySecurityScheme.in` to `query | header | cookie` (spec-compliant).
  - Keep parser/evaluator tolerant behavior and extension expression support intact.
- Validation:
  - `pnpm typecheck`
  - OpenAPI runtime expression/security/path tests as needed.

### WS5 - Pagination Cursor Parse Hardening (H7)

- Files: `src/pagination.ts`.
- Actions:
  - Treat `JSON.parse` output as `unknown`.
  - Add shape guard for `{ offset: number }` before access.
  - Preserve current invalid-cursor outcomes (`null`) and integer/negative checks.
- Validation:
  - `pnpm typecheck`
  - Pagination tests.

## Stepwise Execution Order

1. Implement WS1 and re-run `pnpm typecheck`.
2. Implement WS2 and re-run `pnpm typecheck`.
3. Implement WS3 and re-run `pnpm typecheck`.
4. Implement WS4 and re-run `pnpm typecheck`.
5. Implement WS5 and run final `pnpm typecheck`.

If any step introduces regressions, fix immediately before moving to next step.

## Completion Criteria

- All H1-H7 changes implemented.
- `pnpm typecheck` passes at the end.
- No public API entrypoint removals.
- Runtime behavior for valid inputs remains consistent, with stricter typing/validation only where required by spec correctness.
