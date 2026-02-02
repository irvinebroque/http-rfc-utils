# RFC Audit Skill

This skill defines the exact steps and output structure for auditing RFC support in `http-rfc-utils`.

## Input contract

- Accept a single RFC URL or a bare RFC number.
- Normalize to `https://www.rfc-editor.org/rfc/rfcNNNN.html` and cite section anchors.

## Step-by-step process

1. Normalize + verify the RFC
   - Extract RFC number from input.
   - Fetch the RFC Editor page and capture the official title.
   - Record the canonical URL and relevant section anchors.

2. Define audit scope
   - List the RFC sections to audit.
   - Include ABNF snippets for parsing/serialization.
   - Note any explicit out-of-scope behavior.

3. Map to repository evidence
   - Identify existing modules in `src/*.ts` and public exports in `src/index.ts`.
   - Locate related tests in `test/*.test.ts` and check RFC-cited coverage.
   - Review `README.md`, `AUDIT.md`, and `docs/src/content/docs/reference/rfcs.mdx` for claims.

4. Audit findings
   - Compare RFC requirements to code behavior and tests.
   - Call out strict vs permissive parsing decisions and any conflicts with RFC MUST/SHOULD rules.
   - Highlight precedence/edge-case handling where behavior is unclear or missing.

5. Recommendations (no code changes)
   - Suggest fixes and tests with RFC citations.
   - Prefer RFC examples where available; cite ABNF limits and MUST/SHOULD requirements.

## Output template

```
## Summary
## RFC Scope (sections + anchors)
## ABNF + Normative Requirements
## Code Findings (module-by-module)
## Test Coverage Findings (with RFC citations)
## Doc Claims vs Code (README/docs/AUDIT.md)
## Gaps / Noncompliance / Out-of-scope
## Suggested Fixes + Tests (not implemented)
## Evidence Links
```

## Checklist (use in audit)

- [ ] Scope lists RFC number, sections, ABNF snippets, out-of-scope items.
- [ ] Findings cite RFC sections with RFC Editor anchors.
- [ ] Code findings are module-by-module and align with exports.
- [ ] Test coverage cites RFC sections in names or comments.
- [ ] Docs claims are compared against code/tests.
- [ ] Recommendations are audit-only, no implementation.
