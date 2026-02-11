# TypeScript Strict Review Findings

Date: 2026-02-11
Repository: `http-rfc-utils`

## Scope And Commands

Reviewed current TypeScript health with all repo typecheck variants:

- `pnpm typecheck` -> pass
- `pnpm typecheck:test` -> pass
- `pnpm typecheck:lib` -> pass
- `pnpm exec tsc --project tsconfig.strict.json --noEmit --pretty false` -> fail

`tsconfig.strict.json` enables:

- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`

## Summary

- Strict diagnostics total: **74**
- Affected files: **11**
- Dominant error codes:
  - `TS2345` (28)
  - `TS18048` (22)
  - `TS2375` (10)

Most failures are strict-mode typing precision gaps (indexed access and exact optional property semantics), not RFC semantic violations.

## Error Distribution By File

- `src/json-patch.ts` - 19
- `src/openapi/path-server-resolver.ts` - 13
- `src/openapi/parameter-serialization.ts` - 10
- `src/auth/webauthn-options.ts` - 7
- `src/reporting.ts` - 7
- `src/openapi/lint.ts` - 6
- `src/jsonpath/evaluator.ts` - 4
- `src/openapi/security-requirements.ts` - 4
- `src/digest.ts` - 2
- `src/auth/webauthn-client-data.ts` - 1
- `src/json-canonicalization.ts` - 1

## Findings

### F1) Exact-optional object literal construction violations

- Files:
  - `src/auth/webauthn-client-data.ts:55`
  - `src/auth/webauthn-options.ts:93`, `src/auth/webauthn-options.ts:117`, `src/auth/webauthn-options.ts:229`, `src/auth/webauthn-options.ts:248`, `src/auth/webauthn-options.ts:313`, `src/auth/webauthn-options.ts:393`, `src/auth/webauthn-options.ts:485`
  - `src/openapi/path-server-resolver.ts:127`, `src/openapi/path-server-resolver.ts:448` (+ candidate builder at `src/openapi/path-server-resolver.ts:241` as `TS2379`)
- Diagnostic pattern: object literals set optional members to `undefined` explicitly (`TS2375`/`TS2379`).
- Risk: compile-time only; runtime behavior should stay identical if fixed by omitting undefined keys.
- Recommended fix:
  - Build objects with conditional spreads for optional members (`...(x !== undefined ? { x } : {})`).
  - Avoid `prop: maybeUndefined` when `prop` is optional under `exactOptionalPropertyTypes`.

### F2) JSON Patch has dense indexed-access assumptions under `noUncheckedIndexedAccess`

- File: `src/json-patch.ts` (19 diagnostics)
- Representative refs:
  - `src/json-patch.ts:95`, `src/json-patch.ts:122` (`document[index]` possibly undefined)
  - `src/json-patch.ts:245`, `src/json-patch.ts:268`, `src/json-patch.ts:295`, `src/json-patch.ts:348`, `src/json-patch.ts:376`, `src/json-patch.ts:437` (path token possibly undefined)
  - `src/json-patch.ts:394`, `src/json-patch.ts:419`, `src/json-patch.ts:449`, `src/json-patch.ts:670`, `src/json-patch.ts:700` (value possibly undefined)
- Issue: array/object index expressions assume dense arrays and present members.
- Recommended fix:
  - Guard indexed reads (`const token = ...; if (token === undefined) throw ...`).
  - Prefer `for...of` iteration where possible.
  - Keep existing RFC 6902 error behavior (fail-fast) while making guards explicit.

### F3) OpenAPI path matcher candidate iteration does not narrow segment discriminants safely

- File: `src/openapi/path-server-resolver.ts`
- Representative refs: `src/openapi/path-server-resolver.ts:164`, `src/openapi/path-server-resolver.ts:165`, `src/openapi/path-server-resolver.ts:176`, `src/openapi/path-server-resolver.ts:432`, `src/openapi/path-server-resolver.ts:433`, `src/openapi/path-server-resolver.ts:444`
- Diagnostics: `TS18048` + `TS2339` for `templateSegment` possibly undefined and union member property access (`value`/`name`).
- Recommended fix:
  - Read segment into local + explicit undefined guard.
  - Keep discriminant check (`kind`) and branch-local variables before property access.

### F4) OpenAPI parameter serialization indexes object values without undefined guards

- File: `src/openapi/parameter-serialization.ts` (10 diagnostics)
- Representative refs: `src/openapi/parameter-serialization.ts:114`, `src/openapi/parameter-serialization.ts:214`, `src/openapi/parameter-serialization.ts:321`, `src/openapi/parameter-serialization.ts:331`, `src/openapi/parameter-serialization.ts:638`, `src/openapi/parameter-serialization.ts:648`, `src/openapi/parameter-serialization.ts:721`, `src/openapi/parameter-serialization.ts:732`, `src/openapi/parameter-serialization.ts:819`, `src/openapi/parameter-serialization.ts:828`
- Issue: `objectValue[key]` is typed as possibly undefined in strict mode.
- Recommended fix:
  - Resolve key values with explicit checks before `primitiveToString(...)`.
  - If undefined is impossible by contract, encode that via helper that narrows/throws with context.

### F5) Indexed loop access in lint/reporting/security modules lacks strict guards

- Files:
  - `src/openapi/lint.ts` (`src/openapi/lint.ts:374`, `src/openapi/lint.ts:378`, `src/openapi/lint.ts:379`)
  - `src/openapi/security-requirements.ts` (`src/openapi/security-requirements.ts:159`, `src/openapi/security-requirements.ts:178`, `src/openapi/security-requirements.ts:229`, `src/openapi/security-requirements.ts:231`)
  - `src/reporting.ts` (`src/reporting.ts:208`, `src/reporting.ts:210`, `src/reporting.ts:213`, `src/reporting.ts:214`, `src/reporting.ts:215`, `src/reporting.ts:216`, `src/reporting.ts:219`)
- Issue: `arr[index]` and `Object.keys(obj)`/indexed dereference patterns are not narrowed under strict options.
- Recommended fix:
  - Add per-iteration undefined guards.
  - Prefer `for (const item of arr)` when index value is not required.

### F6) Low-level utility strictness gaps

- Files:
  - `src/digest.ts:375` (`Uint8Array` indexed reads)
  - `src/jsonpath/evaluator.ts:918`, `src/jsonpath/evaluator.ts:939` (string indexed char checks)
  - `src/json-canonicalization.ts:87` (object indexed value potentially undefined)
- Issue: strict mode treats indexed access as potentially undefined even with adjacent bounds logic.
- Recommended fix:
  - Use nullish-coalescing for byte/char reads where fallback is valid.
  - Or guard to a local variable before use.

## Suggested Remediation Order

1. `src/json-patch.ts` (largest single error cluster, high leverage).
2. `src/openapi/path-server-resolver.ts` + `src/openapi/parameter-serialization.ts` (OpenAPI strict readiness).
3. WebAuthn object construction (`src/auth/webauthn-client-data.ts`, `src/auth/webauthn-options.ts`) for exact-optional compatibility.
4. `src/reporting.ts`, `src/openapi/lint.ts`, `src/openapi/security-requirements.ts`.
5. Utility cleanups (`src/digest.ts`, `src/jsonpath/evaluator.ts`, `src/json-canonicalization.ts`).

## Compatibility Notes

- All findings are type-system soundness issues under strict compiler settings.
- Fixes can be implemented without changing RFC semantics or public API shape by:
  - preserving existing parser/formatter runtime branches,
  - adding explicit guards/narrowing,
  - omitting optional keys rather than assigning `undefined`.
