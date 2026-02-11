# Plan: Percent-Encoding Consolidation

## Scope and non-goals

- Scope:
  - Consolidate RFC 3986 percent-encoding policy logic now split across URI, URI Template, OpenAPI, and JSON Pointer code paths.
  - Keep existing public APIs unchanged (`percentEncode`, `percentDecode`, `formatQueryParameter`, `toUriFragment`, runtime-expression evaluators).
  - Standardize non-throwing decode behavior for "invalid escape" and invalid UTF-8 cases.
- Non-goals:
  - Changing current component-specific semantics (for example, URI `path` vs `query` allowlists).
  - Reworking RFC 6570 expansion algorithm beyond encoding helper extraction.
  - Introducing any new public export for internal encoding helpers.

## Affected files/modules

- Add:
  - `src/internal-uri-encoding.ts` (new shared policy-level helper module).
- Update (primary migration targets):
  - `src/uri.ts`
  - `src/uri-template.ts`
  - `src/openapi/parameter-serialization.ts`
  - `src/openapi/runtime-expression.ts`
  - `src/json-pointer.ts`
- Keep and reuse low-level byte helpers:
  - `src/internal-percent-encoding.ts`
- Tests:
  - `test/uri.test.ts`
  - `test/uri-template.test.ts`
  - `test/openapi-parameter-serialization.test.ts`
  - `test/openapi-runtime-expression.test.ts`
  - `test/json-pointer.test.ts`

## Design proposal (helper APIs + migration)

- New internal API (proposed signatures):
  - `createAsciiAllowTable(chars: string): ReadonlyArray<boolean>`
  - `encodeRfc3986(value: string, options: { allowTable: ReadonlyArray<boolean>; preservePctTriplets: boolean; normalizePctHexUppercase: boolean }): string`
  - `decodePercentComponent(value: string): string | null`
- Migration details:
  - Move duplicated ASCII table creation from `src/uri.ts` and `src/uri-template.ts` to `createAsciiAllowTable`.
  - Replace `encodeStrict` and `encodeQueryComponent` internals in `src/openapi/parameter-serialization.ts` with `encodeRfc3986` options.
  - Replace local `decodeComponent` and `decodeURIComponentSafe` clones with `decodePercentComponent` where behavior is equivalent.
  - Keep JSON Pointer fragment allowlist in `src/json-pointer.ts`, but call shared byte-level encode routine for escape generation.
- Compatibility guardrails:
  - Preserve uppercase hex output in all modules.
  - Preserve existing "skip invalid q/escape input instead of throwing" behavior in parser paths.

## Step-by-step implementation phases

1. Create `src/internal-uri-encoding.ts` and wire it to `src/internal-percent-encoding.ts`.
2. Migrate `src/uri.ts` and `src/uri-template.ts` first (lowest semantic drift risk).
3. Migrate OpenAPI helpers in `src/openapi/parameter-serialization.ts` and `src/openapi/runtime-expression.ts`.
4. Migrate JSON Pointer fragment encode/decode helpers in `src/json-pointer.ts`.
5. Run targeted tests, then full quality gate.

## Test plan

- Extend existing tests:
  - `test/uri.test.ts`
  - `test/uri-template.test.ts`
  - `test/openapi-parameter-serialization.test.ts`
  - `test/openapi-runtime-expression.test.ts`
  - `test/json-pointer.test.ts`
- Add new test cases (names):
  - `it('preserves uppercase percent-triplets after helper migration')`
  - `it('does not double-encode valid percent triplets across uri and uri-template')`
  - `it('returns null for malformed percent escapes in shared decode helper call paths')`
  - `it('preserves allowReserved behavior for query parameter values after shared encoding extraction')`
  - `it('keeps JSON Pointer fragment encoding stable for non-ASCII and reserved bytes')`

## Risk/rollback plan

- Risks:
  - Cross-module behavioral drift from option misconfiguration.
  - Silent changes in malformed percent handling for OpenAPI parse paths.
- Mitigations:
  - Migrate one module group at a time with golden assertions in existing tests.
  - Add before/after fixture cases for invalid percent sequences.
- Rollback:
  - Revert per-module migration commits in reverse order while keeping new helper file if unused.
  - Keep fallback wrappers in each module until all tests pass, then remove wrappers in a final cleanup step.

## Definition of done

- All listed modules consume shared percent-encoding helpers.
- No public API signature changes in `src/index.ts` exports.
- Existing percent-encoding tests pass unchanged, plus new migration tests pass.
- `pnpm check:structure`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
