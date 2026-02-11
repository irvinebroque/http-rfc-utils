# Finding 11: duplicate Content-Disposition parameters must be invalid

## Summary
The parser currently allows duplicate parameter names in a single `Content-Disposition` field value. RFC 6266 declares multiple instances of the same parameter name invalid.

## Citation
- RFC 6266, Section 4.1 (invalid duplicate parameters): https://www.rfc-editor.org/rfc/rfc6266.html#section-4.1

## Risk
- Ambiguous interpretation of filename/metadata parameters.
- Potential downstream security and UX issues when conflicting values are accepted.

## Implementation Steps
1. Track seen parameter names case-insensitively during parse.
2. Mark parse invalid on first duplicate occurrence of the same parameter key.
3. Apply rule uniformly to both regular and extended parameter forms where names collide semantically.
4. Document duplicate-handling policy in API docs.

## Tests
- Add tests that duplicate `filename` invalidates parse.
- Add tests that duplicate extension parameters also invalidate parse.
- Add tests for case-insensitive duplicates (`Filename` + `filename`).
- Add control tests confirming distinct parameter names remain valid.

## Rollback / Guardrails
- Preserve deterministic first-failure behavior to keep debugging simple.
- Keep duplicate detection local to a single field value (not across headers).
- Add regression tests for mixed quoted/extended parameter syntax.
