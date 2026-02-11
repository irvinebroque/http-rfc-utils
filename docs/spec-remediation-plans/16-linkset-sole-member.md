# Finding 16 Remediation Plan: Linkset JSON sole top-level member

## Summary
- `src/linkset.ts` currently accepts top-level members beyond `linkset` for linkset JSON validation/parsing.
- RFC 9264 requires `linkset` to be the sole top-level member for `application/linkset+json` documents.
- API catalog handling (RFC 9727 profile usage) should remain a separate path, not a relaxation of base linkset validation.

## Spec Citation
- RFC 9264 Section 4.2.1: `linkset` is the only top-level member for linkset JSON.
- RFC 9727 Section 4.2: API catalog documents may include profile semantics.
- URLs:
  - https://www.rfc-editor.org/rfc/rfc9264.html#section-4.2.1
  - https://www.rfc-editor.org/rfc/rfc9727.html#section-4.2

## Impact
- Tightens conformance for generic linkset JSON parsing/validation.
- Potentially rejects inputs that previously passed when extra top-level metadata existed.
- Clarifies separation between base linkset and API catalog parsing contracts.

## Implementation Steps
1. Update `isValidLinkset` to enforce exactly one top-level key: `linkset`.
2. Ensure `parseLinksetJson` relies on that strict validation without API-catalog exceptions.
3. Move API-catalog-specific acceptance (`profile`) into `parseApiCatalog` only, with dedicated validation there.
4. Add clear inline RFC references around both code paths to prevent future cross-contamination.
5. Document behavior differences between `parseLinksetJson` and `parseApiCatalog`.

## Test Plan
- Add negative tests for `parseLinksetJson`/`isValidLinkset` with extra top-level keys (`profile`, `foo`, etc.).
- Add positive tests where only `linkset` is present and valid.
- Add API catalog tests showing `parseApiCatalog` still accepts/returns expected `profile` semantics.
- Include RFC 9264 Section 4.2.1 and RFC 9727 Section 4.2 citations in test descriptions.

## Rollback/Guardrails
- Guardrail: isolate strictness to base linkset parser; avoid regressing API catalog support.
- Guardrail: keep tolerant behavior for malformed JSON unchanged (`null` return).
- Rollback path: if strictness causes ecosystem issues, temporarily add a clearly named legacy parse helper rather than weakening the compliant default.
