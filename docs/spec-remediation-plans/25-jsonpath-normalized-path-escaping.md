# Finding 25 Remediation Plan: Normalized Path Escaping for Control Characters

## Summary

Normalized path generation appears to escape an incomplete set of control characters, which can yield non-canonical or ambiguous normalized path strings. This plan brings escaping behavior into full alignment with normalized path requirements.

## Spec Citation

- RFC 9535 URL: https://www.rfc-editor.org/rfc/rfc9535.html
- Section: 2.7 (normalized paths)

## Impact and Risk

- **Compliance risk:** Output may violate normalized path canonicalization rules.
- **Interoperability risk:** Round-trip behavior with other JSONPath tools can diverge when escaping sets differ.
- **Observability risk:** Control characters in normalized output can degrade logs and debugging reliability.

## Implementation Steps

1. Audit normalized path escaping logic in `src/jsonpath/evaluator.ts` for all control characters and required escape forms.
2. Implement a complete escaping table/rule set covering the entire required control-char range.
3. Ensure escaping is deterministic and stable so repeated normalization is idempotent.
4. Validate interaction with quote escaping and backslash escaping to avoid double-escape or under-escape behavior.
5. Confirm normalized path output remains backward compatible for already-correct inputs.

## Concrete Tests

- Add tests in `test/jsonpath.test.ts` for normalized output containing each representative control class (`\u0000`, `\n`, `\r`, `\t`, boundary controls).
- Add tests for mixed strings containing quotes, backslashes, and controls in the same segment.
- Add idempotence test: normalizing already normalized output should not change it.
- Add regression tests proving ordinary ASCII member names are unchanged.

## Rollback and Guardrails

- Keep this remediation isolated to normalized-path formatting; avoid changing selection semantics.
- Add a compact fixture matrix for escaping edge cases to prevent future regressions.
- If rollback is required, revert only escaping changes and keep failing compliance tests in place for visibility.
- Document canonicalization impact for consumers that compare normalized path strings byte-for-byte.
