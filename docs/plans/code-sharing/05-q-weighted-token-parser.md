# Plan: Generic q-Weighted Token List Parser

## Scope and non-goals

- Scope:
  - Introduce one reusable parser for token-based weighted headers that use `q` parameters.
  - Migrate `Accept-Encoding` and `Accept-Language` parsing loops to shared logic.
  - Keep module-specific negotiation logic (`negotiateEncoding`, `negotiateLanguage`) unchanged.
- Non-goals:
  - Rewriting full `Accept` media-range parsing in `src/negotiate.ts` in this phase.
  - Changing current invalid-q policy (invalid entries are skipped, not fatal).
  - Adding normalization rules not already used by existing modules.

## Affected files/modules

- Add helper location:
  - `src/header-utils.ts` (new weighted parser helper near `parseQSegments`), or `src/internal-weighted-token.ts` if helper grows.
- Update parser consumers:
  - `src/encoding.ts`
  - `src/language.ts`
- Optional follow-up consumer (not in initial migration):
  - `src/negotiate.ts`
- Tests:
  - `test/encoding.test.ts`
  - `test/language.test.ts`
  - `test/header-utils.test.ts`

## Design proposal (helper APIs + migration)

- New helper API:
  - `parseWeightedTokenList(header: string, options: { tokenNormalizer?: (token: string) => string; startSegmentIndex?: number; sort?: 'q-only' | 'q-then-specificity' | 'none'; specificity?: (token: string) => number; }): Array<{ token: string; q: number }>`
- Behavior defaults:
  - Split on list members with existing `splitListValue`.
  - Parse `q` with `parseQSegments`.
  - Skip entries with missing/empty token or invalid q.
  - Stable sort by q descending when `sort` is not `none`.
- Migration details:
  - `src/encoding.ts`: map helper output to `EncodingRange` (`token -> encoding`).
  - `src/language.ts`: use helper with `specificity` callback for current q-then-specificity ordering.

## Step-by-step implementation phases

1. Add `parseWeightedTokenList` and focused unit tests in `test/header-utils.test.ts`.
2. Migrate `parseAcceptEncoding` in `src/encoding.ts`.
3. Migrate `parseAcceptLanguage` in `src/language.ts` with specificity callback.
4. Verify sorting parity against existing tests and add regression cases.
5. Evaluate follow-up migration for `src/negotiate.ts` separately.

## Test plan

- Extend existing tests:
  - `test/encoding.test.ts`
  - `test/language.test.ts`
  - `test/header-utils.test.ts`
- Add new test cases (names):
  - `it('parses weighted token list and skips invalid q segments')`
  - `it('preserves default q=1 when q parameter is absent')`
  - `it('sorts Accept-Encoding entries by q descending using shared helper')`
  - `it('sorts Accept-Language by q then specificity using shared helper callback')`
  - `it('keeps duplicate token ordering stable when q values match')`

## Risk/rollback plan

- Risks:
  - Sort order drift if stable ordering is not preserved.
  - Subtle differences in whitespace trimming could change parse output.
- Mitigations:
  - Keep existing split and trim utilities (`splitListValue`, `parseQSegments`) inside the helper implementation.
  - Add parity tests using current examples from `encoding.test.ts` and `language.test.ts`.
- Rollback:
  - Revert consumer migrations while leaving helper in place.
  - Keep feature branch commit split by module for fast selective rollback.

## Definition of done

- `parseAcceptEncoding` and `parseAcceptLanguage` use the shared weighted token helper.
- Existing encoding/language behavior remains unchanged under current tests.
- New helper tests cover invalid q handling, default q, sorting, and duplicate stability.
- Full test and typecheck gates pass.
