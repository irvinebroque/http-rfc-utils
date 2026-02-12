# Plan: Shared Structured Fields Validators and Item Guards

## Scope and non-goals

- Scope:
  - Centralize repeated SF token/key validation regexes and list-member guard patterns used by SF-based header modules.
  - Reduce repeated `if ('items' in member)` and parameter checks by introducing tiny helper functions.
  - Keep parser return contracts unchanged (`null` for invalid syntax-level input).
- Non-goals:
  - Rewriting `parseSfList` or `parseSfDict` parser internals.
  - Changing each header module's RFC-specific semantic checks.
  - Publicly exporting new helper APIs.

## Affected files/modules

- Update shared helper module:
  - `src/structured-field-helpers.ts`
- Update SF parser core constants (for reuse source-of-truth):
  - `src/structured-fields.ts`
- Migrate callers:
  - `src/cache-status.ts`
  - `src/proxy-status.ts`
  - `src/compression-dictionary.ts`
  - `src/client-hints.ts`
  - `src/cache-groups.ts`
  - `src/link-template.ts`
- Tests:
  - `test/cache-status.test.ts`
  - `test/proxy-status.test.ts`
  - `test/client-hints.test.ts`
  - `test/cache-groups.test.ts`
  - `test/link-template.test.ts`
  - `test/compression-dictionary.test.ts`

## Design proposal (helper APIs + migration)

- Add to `src/structured-field-helpers.ts`:
  - `isSfTokenText(value: string): boolean`
  - `isSfKeyText(value: string): boolean`
  - `expectSfItem(member: SfList[number]): SfItem | null`
  - `hasNoSfParams(item: SfItem): boolean`
- Optional list utilities if duplication remains:
  - `parseSfTokenListStrict(header: string): SfToken[] | null`
  - `parseSfStringListStrict(header: string): string[] | null`
- Migration strategy:
  - Replace local `SF_TOKEN` regex constants with `isSfTokenText` calls.
  - Replace local key regex constants with `isSfKeyText` where key validation is required.
  - Replace inline inner-list guard branches with `expectSfItem` in target modules.

## Step-by-step implementation phases

1. Add validators/guards to `src/structured-field-helpers.ts` with strict typings.
2. Make `src/structured-fields.ts` token/key regex constants available to helper module (move constants or duplicate once and remove local copies elsewhere).
3. Migrate modules with the most repetition first (`cache-status`, `proxy-status`, `client-hints`).
4. Migrate `cache-groups`, `link-template`, and `compression-dictionary` guards.
5. Remove duplicate regex constants after all callers switch.

## Test plan

- Extend existing tests:
  - `test/cache-status.test.ts`
  - `test/proxy-status.test.ts`
  - `test/client-hints.test.ts`
  - `test/cache-groups.test.ts`
  - `test/link-template.test.ts`
  - `test/compression-dictionary.test.ts`
- Add new test cases (names):
  - `it('rejects inner-list members via shared expectSfItem guard')`
  - `it('validates Cache-Status fwd tokens through shared SF token validator')`
  - `it('validates Proxy-Status next-hop token formatting through shared SF token validator')`
  - `it('rejects uppercase Accept-CH token keys through shared SF key validator path')`
  - `it('parses Link-Template members only when shared no-params guard passes')`

## Risk/rollback plan

- Risks:
  - Subtle regex drift if shared validator does not match previous per-module pattern exactly.
  - Guard helper misuse could accidentally accept inner lists.
- Mitigations:
  - Snapshot existing behavior in module tests before migration.
  - Introduce helper tests in `test/structured-field-helpers.test.ts` for validator/guard behavior.
- Rollback:
  - Revert module migrations independently while leaving helper functions in place.
  - Keep legacy regex constants temporarily until each module's migration is validated.

## Definition of done

- Repeated SF token/key regex declarations are removed from the listed modules.
- Inner-list and no-parameter guard checks use shared helper functions.
- Existing SF module tests pass plus new guard/validator regression tests pass.
- Parser contracts remain unchanged (`null` for invalid field values, no new throws in tolerant parse paths).
