# Finding 10: Content-Disposition type must be a token

## Summary
The parser currently accepts disposition types that are not valid HTTP tokens. RFC 6266 grammar requires `disposition-type` to be `token`, so accepting non-token values is non-compliant.

## Citation
- RFC 6266, Section 4.1 (Grammar): https://www.rfc-editor.org/rfc/rfc6266.html#section-4.1
- RFC 9110, Section 5.6.2 (`token`): https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.2

## Risk
- Parses malformed headers as valid, which can mask sender-side defects.
- Increases mismatch risk with strict clients/servers that reject invalid types.

## Implementation Steps
1. Enforce token validation for the leading disposition type before parameter parsing.
2. Reject/return null for non-token type values according to existing parser error model.
3. Reuse existing shared token validator (or add one shared helper) to avoid duplicate logic.
4. Ensure formatter path cannot emit non-token disposition type values.

## Tests
- Add tests rejecting quoted/non-token disposition types.
- Add tests for valid token types (`inline`, `attachment`, extension-token).
- Add tests showing invalid type causes whole parse failure under current contract.

## Rollback / Guardrails
- Keep behavior aligned with current tolerant/strict split (parser return-null vs formatter throw) to avoid API surprise.
- Include focused tests for token edge cases from RFC 9110 `tchar`.
- Avoid broad normalization that mutates invalid input into valid output.
