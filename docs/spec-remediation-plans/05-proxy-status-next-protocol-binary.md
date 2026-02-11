# Remediation Plan: Proxy-Status next-protocol Byte Sequence Support

## Finding summary

- Confirmed issue: `next-protocol` currently supports token form but lacks Byte Sequence support.
- Location: `src/proxy-status.ts:98`.

## Spec citation (section + URL)

- RFC 9209 Section 2.1.3: `next-protocol` value MUST be Token or Byte Sequence representing a TLS ALPN Protocol ID; token form MUST be used when ASCII-token compatible.
- URL: https://www.rfc-editor.org/rfc/rfc9209.html#section-2.1.3

## Impact/risk

- Non-token ALPN identifiers cannot be represented, causing loss of standards-compliant expressiveness.
- Parsing or formatting can reject otherwise valid Proxy-Status values from compliant intermediaries.

## Step-by-step implementation plan

1. Extend `nextProtocol` parse logic to accept both `SfToken` and byte-sequence bare-item values.
2. Define internal representation strategy for byte-sequence ALPN IDs consistent with existing type contracts.
3. Update format logic to emit token form when ASCII token-safe, otherwise emit Byte Sequence.
4. Add validation to avoid producing non-compliant alternate encodings when token form is available.
5. Verify behavior with mixed Proxy-Status parameter sets and extension parameters.

## Test plan (specific existing test files to update/add)

- Update `test/proxy-status.test.ts`:
  - Add parse case for `next-protocol` in Byte Sequence form.
  - Add format case ensuring token-safe ALPN IDs serialize as Token.
  - Add format case ensuring non-token-safe ALPN IDs serialize as Byte Sequence.
  - Add round-trip test covering both representations.

## Rollback/guardrails

- Guardrail: keep existing token-form behavior unchanged and backwards compatible.
- Guardrail: do not alter unrelated parameter parsing/formatting behavior.
- Rollback: revert Byte Sequence branch while retaining tests skipped/pending for staged support.
