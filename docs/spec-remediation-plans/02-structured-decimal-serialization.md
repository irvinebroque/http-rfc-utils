# Remediation Plan: Structured Decimal Serialization Must Emit Decimal Form

## Finding summary

- Confirmed issue: decimal serialization can emit integer-like form (`1`) instead of mandatory decimal form (`1.0`).
- Location: `src/structured-fields.ts:89`.

## Spec citation (section + URL)

- RFC 8941 Section 4.1.5 (Serializing a Decimal): serializer MUST append a decimal point and MUST append `0` when fractional component is zero.
- URL: https://www.rfc-editor.org/rfc/rfc8941.html#section-4.1.5

## Impact/risk

- Violates RFC wire-format requirements for decimal values.
- Can change field meaning for strict consumers that distinguish Integer and Decimal item types.

## Step-by-step implementation plan

1. Review decimal serialization routine to identify where normalized values can lose fractional notation.
2. Enforce output construction path that always includes `.` for decimals.
3. Ensure zero fractional component always serializes as `.0`.
4. Preserve existing rounding and range validation behavior for up to 3 fractional digits and 12 integer digits.
5. Add regression coverage for integer-like decimal inputs and rounded decimal outputs.

## Test plan (specific existing test files to update/add)

- Update `test/structured-fields.test.ts`:
  - Add serialization assertions for decimal values that are mathematically integral (`1.0`, `-0.0`, `10.000` canonicalized per current rounding behavior).
  - Add parse-serialize canonicalization checks to verify decimal items remain decimal items.

## Rollback/guardrails

- Guardrail: do not alter integer serializer behavior (`serializeSfInteger` path remains unchanged).
- Guardrail: keep decimal range checks and banker rounding semantics intact.
- Rollback: revert decimal output formatting changes while preserving newly added tests for future rework.
