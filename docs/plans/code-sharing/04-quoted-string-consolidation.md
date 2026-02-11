# Plan: Quoted-String Escaping and Unescaping Consolidation

## Scope and non-goals

- Scope:
  - Replace duplicated quoted-string escaping expressions with `escapeQuotedString`/`quoteString` from `src/header-utils.ts` where RFC 9110 quoted-string rules apply.
  - Consolidate permissive quoted unescaping logic used by cookies and other header parsers.
  - Keep Structured Fields string escaping separate because SF has different character constraints.
- Non-goals:
  - Changing Structured Fields serialization rules in `src/structured-fields.ts`.
  - Tightening cookie parsing semantics beyond current tolerant behavior.
  - Broad parser strictness changes in modules unrelated to quoted-string handling.

## Affected files/modules

- Update helpers:
  - `src/header-utils.ts`
- Migrate escaping call sites:
  - `src/http-signatures.ts`
  - `src/alt-svc.ts`
- Migrate unquote clone:
  - `src/cookie.ts`
- Leave SF-specific escaping untouched:
  - `src/structured-fields.ts`
- Tests:
  - `test/http-signatures.test.ts`
  - `test/alt-svc.test.ts`
  - `test/cookie.test.ts`
  - `test/header-utils.test.ts`

## Design proposal (helper APIs + migration)

- Add/confirm helper coverage in `src/header-utils.ts`:
  - Reuse existing `escapeQuotedString(value)` and `quoteString(value)` for emit paths.
  - Add `unquoteLenient(value: string): string` if `unquote` naming needs semantic clarity for tolerant parsing.
- Migration details:
  - In `src/http-signatures.ts`, replace inline `.replace(/\\/g, '\\\\').replace(/"/g, '\\"')` sequences with `escapeQuotedString`.
  - In `src/alt-svc.ts`, replace escaped authority formatting with `escapeQuotedString`.
  - In `src/cookie.ts`, replace `unquoteCookieValue` implementation with shared tolerant unquote helper.
  - Keep `parseQuotedStringStrict` for strict parse sites and do not replace with tolerant unquote.

## Step-by-step implementation phases

1. Add any missing unquote helper alias/utility to `src/header-utils.ts` and keep existing behavior.
2. Migrate `src/http-signatures.ts` escaping call sites.
3. Migrate `src/alt-svc.ts` authority escaping.
4. Migrate `src/cookie.ts` unquote helper usage.
5. Remove duplicated escape/unescape local helpers and rerun targeted tests.

## Test plan

- Extend existing tests:
  - `test/http-signatures.test.ts`
  - `test/alt-svc.test.ts`
  - `test/cookie.test.ts`
  - `test/header-utils.test.ts`
- Add new test cases (names):
  - `it('formats Signature-Input component key with shared quoted-string escaping')`
  - `it('formats signature params nonce/keyid/tag using shared quoted-string escaping')`
  - `it('formats Alt-Svc authority with embedded quote and backslash via shared helper')`
  - `it('parses quoted cookie value with escaped backslash using shared unquote helper')`
  - `it('keeps strict quoted-string parser rejecting dangling escape sequences')`

## Risk/rollback plan

- Risks:
  - Accidental behavior changes between strict and lenient unquoting paths.
  - Error message text changes if helper-level assertions are reused directly.
- Mitigations:
  - Use strict helper only in strict parser call sites; use tolerant helper only where current behavior is tolerant.
  - Keep existing error strings by wrapping helper errors when needed.
- Rollback:
  - Restore module-local escape/unquote helper logic per file if regressions appear.
  - Keep shared helper additions since they are backward-compatible utility additions.

## Definition of done

- `http-signatures.ts`, `alt-svc.ts`, and `cookie.ts` no longer duplicate quoted-string escape/unescape code.
- `structured-fields.ts` continues using SF-specific escaping path.
- Existing related tests pass plus new quoted-string regression tests pass.
- No public API change except optional additive helper export in `header-utils` (if required).
