# Remediation Plan: Cache-Status detail Parameter Must Accept Token Form

## Finding summary

- Confirmed issue: Cache-Status `detail` parser currently accepts only string values and rejects token-form details.
- Location: `src/cache-status.ts:91`.

## Spec citation (section + URL)

- RFC 9211 Section 2.8: `detail` value is either a String or a Token.
- URL: https://www.rfc-editor.org/rfc/rfc9211.html#section-2.8

## Impact/risk

- Valid Cache-Status headers using token-form detail are dropped or degraded.
- Interop risk with caches that intentionally use token values (for compact machine-readable detail states).

## Step-by-step implementation plan

1. Update `detail` parameter schema parse function to accept both `string` and `SfToken` inputs.
2. Normalize parsed token-form detail to the exported typed representation used by this module.
3. Confirm formatter behavior remains compatible with existing API shape and preserves valid detail output.
4. Ensure unknown extension parameters still flow through untouched.
5. Add explicit parse and round-trip tests for token-form detail values.

## Test plan (specific existing test files to update/add)

- Update `test/cache-status.test.ts`:
  - Add parse case for `detail=MEMORY` style token value.
  - Add round-trip coverage for entries containing token-form detail.
  - Keep existing string-form detail assertions to confirm no regression.

## Rollback/guardrails

- Guardrail: avoid changing behavior of other known parameters (`fwd`, `ttl`, `fwd-status`, etc.).
- Guardrail: preserve current public type contracts for `CacheStatusParams` unless explicitly coordinated.
- Rollback: revert `detail` parse acceptance change if downstream typing assumptions require phased migration.
