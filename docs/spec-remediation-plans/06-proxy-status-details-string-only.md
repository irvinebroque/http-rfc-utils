# Remediation Plan: Proxy-Status details Formatter Enforce String Type

## Finding summary

- Confirmed issue: formatter path allows non-string values for `details`.
- Location: `src/proxy-status.ts:158`.

## Spec citation (section + URL)

- RFC 9209 Section 2.1.5: `details` parameter value is a String.
- URL: https://www.rfc-editor.org/rfc/rfc9209.html#section-2.1.5

## Impact/risk

- Formatter can emit non-compliant Proxy-Status fields.
- Type confusion in output can break strict parsers and compliance checks.

## Step-by-step implementation plan

1. Tighten `details` schema formatter to accept only string input.
2. Throw a precise `Error` for non-string `details` values, following repo formatter/validator conventions.
3. Keep parser behavior for incoming values strict to String-only.
4. Confirm extension-parameter path remains available for non-standard data.
5. Add regression tests for valid string formatting and invalid non-string rejection.

## Test plan (specific existing test files to update/add)

- Update `test/proxy-status.test.ts`:
  - Add positive format assertion for string `details`.
  - Add negative assertions that non-string `details` values throw.
  - Add parse assertion confirming non-string `details` input is ignored/rejected per current parser contract.

## Rollback/guardrails

- Guardrail: scope validation change to `details` only; leave other parameter format rules untouched.
- Guardrail: keep thrown error text specific and stable for testability.
- Rollback: restore prior formatter behavior if ecosystem compatibility issues appear, while documenting temporary spec deviation.
