# Phase 0 Baseline Characterization

Date: 2026-02-11
Plan: `docs/plans/code-sharing/deep-code-sharing-implementation-plan-2026-02-11.md`

## Scope Locked in Phase 0

- Digest (RFC 7616) parse/format behavior and selected error message text.
- OpenAPI v3.1.1 runtime-expression/link-callback issue arrays and messages.
- Percent-decoding strict-vs-lenient outcomes across URI/OpenAPI/RFC 8187 call paths.

## Added Test and Fixtures

- Test harness: `test/code-sharing-baselines.test.ts`
- Fixtures:
  - `test/fixtures/code-sharing/digest-baseline.json`
  - `test/fixtures/code-sharing/openapi-runtime-baseline.json`
  - `test/fixtures/code-sharing/percent-decoding-baseline.json`

## Baseline Notes

- Digest challenge parsing rejects duplicate auth-param names, while formatting preserves current parameter emission order.
- Digest authorization parsing preserves current `username*` RFC 8187 decode behavior and qop coupling rules.
- Digest error text baselines lock current `computeA1`, `computeA2`, and `computeDigestResponse` thrown message wording.
- OpenAPI link materialization currently sorts parameter keys before issue collection; strict mode throws the first resulting issue message.
- OpenAPI callback resolution keeps existing code/path/message/expression issue payloads for malformed and unresolved expressions.
- Percent decoding remains intentionally mixed-policy by call site:
  - `decodePercentComponent` is strict (`null` on malformed escapes / invalid UTF-8).
  - `percentDecode` is lenient (keeps malformed escapes while decoding valid ones).
  - `decodeExtValue` is strict (`null` on malformed escapes).
  - `extractOpenApiPathParams` switches behavior via `decodePathSegments`.

## Phase 0 Exit Status

- Baseline characterization artifacts and fixture-driven tests have been added.
- Refactor phases should treat these fixtures as behavior lock files.

## Verification Snapshot

- Passed:
  - `pnpm exec tsx --test test/code-sharing-baselines.test.ts test/openapi-runtime-expression.test.ts test/openapi-link-callback.test.ts test/uri.test.ts test/ext-value.test.ts test/openapi-path-server-resolver.test.ts`
- Additional context run:
  - `pnpm exec tsx --test test/code-sharing-baselines.test.ts test/auth.test.ts test/openapi-runtime-expression.test.ts test/openapi-link-callback.test.ts test/uri.test.ts test/ext-value.test.ts test/openapi-path-server-resolver.test.ts`
  - This wider run shows pre-existing assertion drift in `test/auth.test.ts` regex expectations against current Digest/Bearer error text.
