# Plan: Shared UTF-8 and Surrogate Utilities

## Scope and non-goals

- Scope:
  - Extract repeated lone-surrogate checks into one internal utility.
  - Consolidate repeated `TextEncoder` setup and basic byte-view coercion helpers where behavior is duplicated.
  - Keep all public APIs and return contracts unchanged.
- Non-goals:
  - Rewriting digest/hash algorithms.
  - Changing Unicode validation strictness in existing modules.
  - Broad Buffer/TypedArray abstraction redesign.

## Affected files/modules

- Add:
  - `src/internal-unicode.ts` (shared surrogate and UTF-8 helper functions).
- Update:
  - `src/json-canonicalization.ts`
  - `src/structured-fields.ts`
  - `src/uri.ts`
  - `src/uri-template.ts`
  - `src/digest.ts`
  - `src/etag.ts`
- Tests:
  - `test/json-canonicalization.test.ts`
  - `test/structured-fields.test.ts`
  - `test/uri.test.ts`
  - `test/uri-template.test.ts`
  - `test/etag.test.ts`

## Design proposal (helper APIs + migration)

- New internal helper API:
  - `hasLoneSurrogate(value: string): boolean`
  - `encodeUtf8(value: string): Uint8Array` (shared singleton encoder internally)
  - `toUint8ArrayView(value: ArrayBuffer | ArrayBufferView): Uint8Array`
- Migration details:
  - Replace local `hasLoneSurrogate` implementations in `json-canonicalization.ts` and `structured-fields.ts`.
  - Replace local `UTF8_ENCODER` constants in high-duplication modules with `encodeUtf8` helper calls.
  - In `etag.ts`, align `asByteView`/`toBufferSource` flow with shared `toUint8ArrayView` helper where applicable.
  - Keep module-local behavior-specific checks (for example, SF display-string escaping rules) unchanged.

## Step-by-step implementation phases

1. Add `src/internal-unicode.ts` with surrogate detection and UTF-8 encode helpers.
2. Migrate surrogate checks in `src/json-canonicalization.ts` and `src/structured-fields.ts`.
3. Migrate repeated UTF-8 encoder initialization in `src/uri.ts`, `src/uri-template.ts`, and `src/digest.ts`.
4. Migrate byte-view coercion helpers in `src/etag.ts` if compatible.
5. Remove duplicate local helpers and re-run tests.

## Test plan

- Extend existing tests:
  - `test/json-canonicalization.test.ts`
  - `test/structured-fields.test.ts`
  - `test/uri.test.ts`
  - `test/uri-template.test.ts`
  - `test/etag.test.ts`
- Add new test cases (names):
  - `it('rejects lone surrogate property names through shared surrogate helper')`
  - `it('rejects structured display strings containing lone surrogates through shared helper')`
  - `it('keeps UTF-8 percent-encoding output stable after shared utf8 helper migration')`
  - `it('keeps URI Template non-ASCII expansion output stable after shared utf8 helper migration')`
  - `it('coerces ArrayBuffer and TypedArray inputs consistently through shared byte-view helper')`

## Risk/rollback plan

- Risks:
  - Hidden behavior changes from shared encoder/byte-view conversion semantics.
  - Runtime overhead if helper allocation patterns are worse than current constants.
- Mitigations:
  - Keep helper implementations allocation-minimal and benchmark with existing hot-path tests if needed.
  - Add parity assertions for byte-level outputs in URI and ETag test suites.
- Rollback:
  - Revert per-module migrations while leaving helper module unused.
  - Keep duplicate functions until migration parity is confirmed, then delete in cleanup commit.

## Definition of done

- Lone-surrogate detection logic exists in one internal utility and is reused by both canonical JSON and Structured Fields.
- UTF-8 encode setup duplication is removed from the listed modules where feasible.
- Byte-view coercion logic is shared where semantics match existing behavior.
- Existing tests pass plus new surrogate/UTF-8 parity tests pass.
