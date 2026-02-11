# Finding 20 Remediation Plan: JSONPath Dot Shorthand Whitespace

## Summary

The lexer currently applies global whitespace skipping in a way that can permit invalid dot-shorthand forms (for example, accepting whitespace where the shorthand grammar requires immediate name/wildcard syntax). This plan tightens tokenization so dot shorthand only matches RFC-valid forms.

## Spec Citation

- RFC 9535 URL: https://www.rfc-editor.org/rfc/rfc9535.html
- Section: 2.5.1.1 (dot shorthand)

## Impact and Risk

- **Compliance risk:** Non-conformant queries may parse successfully, creating observable behavior differences from standards-compliant implementations.
- **Interoperability risk:** Query portability across JSONPath engines decreases when invalid shorthand is tolerated.
- **Behavior-change risk:** Tightening the lexer may reject queries that previously passed in user code relying on permissive parsing.

## Implementation Steps

1. Isolate dot-shorthand token recognition in `src/jsonpath/lexer.ts` so it does not inherit broad whitespace skipping.
2. Enforce adjacency rules from the shorthand grammar (dot followed immediately by a valid shorthand target).
3. Keep whitespace tolerance unchanged for grammar locations that explicitly allow insignificant whitespace.
4. Ensure parse errors are precise and point to the first invalid shorthand position.
5. Add/update parser integration checks to confirm invalid shorthand is rejected early and valid shorthand remains accepted.

## Concrete Tests

- Add RFC-cited cases in `test/jsonpath.test.ts` for valid shorthand forms (name selector and wildcard).
- Add negative tests for whitespace-inserted shorthand variants that must fail.
- Add regression tests to verify bracket notation with whitespace remains valid where RFC grammar permits it.
- Add a focused tokenization test (or equivalent parser-visible assertion) that dot shorthand is not produced from invalid spaced input.

## Rollback and Guardrails

- Gate rollout behind existing JSONPath test suite plus targeted new regression tests before merge.
- If breakage appears in downstream usage, provide temporary migration guidance: replace ambiguous shorthand with explicit bracket notation.
- Keep this remediation scoped to shorthand lexing only; avoid unrelated tokenizer refactors in the same change.
- Document behavior tightening in release notes/changeset as a standards-compliance fix.
