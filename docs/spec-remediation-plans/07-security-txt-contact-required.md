# Finding 07: security.txt formatter must require Contact

## Summary
`formatSecurityTxt` can currently emit output that omits the required `Contact` field. Per spec, a valid `security.txt` document MUST include at least one `Contact` field, so formatter output without it is non-compliant.

## Citation
- RFC 9116, Section 2.5.3 (`Contact`): https://www.rfc-editor.org/rfc/rfc9116.html#section-2.5.3

## Risk
- Produces formally invalid `security.txt` documents that may be ignored by scanners or relying parties.
- Creates false confidence for downstream callers that formatter output is standards-compliant.

## Implementation Steps
1. Add a formatter precondition that requires at least one non-empty `Contact` value before rendering.
2. Throw a precise `Error` when `Contact` is absent (include field name in message).
3. Ensure normalization path cannot drop `Contact` silently during formatting.
4. Update public docs/examples to show `Contact` as mandatory.

## Tests
- Add unit test that formatting without `Contact` throws.
- Add unit test that one valid `Contact` formats successfully.
- Add unit test that multiple `Contact` fields preserve expected ordering/serialization.

## Rollback / Guardrails
- Keep parser behavior tolerant as-is for untrusted input if required by current API contract; enforce strictness in formatter/constructor path only.
- Gate change with targeted tests to avoid regressions in optional field handling.
- If ecosystem breakage appears, add a temporary opt-in strictness flag only as a short-lived compatibility bridge.
