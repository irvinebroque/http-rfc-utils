# Finding 31: Accept-Encoding token validation

## Summary
`src/encoding.ts:24` accepts invalid `content-coding` token forms in `Accept-Encoding`. Parsing should enforce RFC token grammar for codings and preserve explicit `identity` and `*` semantics.

## Citation (URL + section)
- RFC 9110, section 12.5.3 (Accept-Encoding): https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.3
- RFC 9110, section 8.4.1 (Content Codings): https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4.1
- RFC 9110, section 5.6.2 (Token syntax): https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.2

## Impact / risk
- Invalid codings can pollute negotiation results and produce wrong encoding selection.
- Non-compliant parsing weakens interoperability with strict clients/servers.
- Invalid token acceptance can hide malformed header inputs during debugging and policy checks.

## Implementation plan
1. Review parser entry point to identify where coding token validation is currently permissive.
2. Enforce RFC token grammar for `content-coding` values while preserving support for `identity` and `*`.
3. Keep existing quality-weight parsing behavior and ordering logic unchanged.
4. Align invalid syntax handling with repo conventions (non-throwing parser behavior for malformed header input).
5. Audit any shared token regex/helper usage to prevent accidental broad behavior shifts.

## Tests
- Add negative tests for codings with separators/whitespace/invalid characters that violate token ABNF.
- Add positive tests for valid token codings, `identity`, and wildcard `*`.
- Add regression tests for mixed header lists with malformed members according to parser contract.
- Add tests ensuring q-value handling remains unchanged after token validation tightening.

## Rollback / guardrails
- Guardrail: isolate validation to coding-token parse stage; do not modify negotiation ranking logic.
- Guardrail: maintain explicit tests for legacy accepted-but-invalid inputs so compatibility decisions are visible.
- Rollback: revert token-validation strictness and retain tests as expected failures if temporary compatibility is required.
