# Remediation Plan: Structured Dictionary Boolean Serialization with Parameters

## Finding summary

- Confirmed issue: `serializeSfDict` emits `key=?1;...` when a dictionary member is boolean true with parameters, but it should emit `key;...`.
- Location: `src/structured-fields.ts:751`.

## Spec citation (section + URL)

- RFC 8941 Section 4.1.2 (Serializing a Dictionary): when member value is Boolean true, serialize the key and parameters without `=` and without `?1`.
- URL: https://www.rfc-editor.org/rfc/rfc8941.html#section-4.1.2

## Impact/risk

- Produces non-canonical Structured Field output and can break interop with strict parsers or compliance tooling.
- Round-trip behavior for dictionary booleans with parameters becomes inconsistent with RFC examples.

## Step-by-step implementation plan

1. Update dictionary serialization branch logic to treat boolean true as special even when parameters exist.
2. Ensure the boolean-true branch appends `key` plus serialized parameters only (no `=` path).
3. Keep non-boolean and inner-list serialization branches unchanged.
4. Confirm output still preserves member ordering and parameter ordering.
5. Add a focused regression test for `true + params` and retain existing `true without params` behavior.

## Test plan (specific existing test files to update/add)

- Update `test/structured-fields.test.ts`:
  - Add case asserting dictionary member `{ value: true, params: { foo: 'bar' } }` serializes as `key;foo="bar"`.
  - Add mixed-member case to ensure commas, spacing, and unaffected members remain canonical.

## Rollback/guardrails

- Guardrail: preserve existing parser contracts (no change to parse behavior, only serializer branch).
- Guardrail: keep changes scoped to dictionary serialization internals.
- Rollback: revert dictionary boolean-true serialization branch and new tests if downstream consumers report unexpected behavior.
