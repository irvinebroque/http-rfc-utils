# Finding 21 Remediation Plan: JSONPath Number Literals in Filters

## Summary

The numeric literal lexer path appears to reject RFC-valid fractional and exponent forms when parsing filter literals. This plan aligns number tokenization with JSON number grammar so filter comparisons accept the full valid literal space.

## Spec Citation

- RFC 9535 URL: https://www.rfc-editor.org/rfc/rfc9535.html
- Section: 2.3.5.1 (filter-selector grammar and literals)
- RFC 8259 URL: https://www.rfc-editor.org/rfc/rfc8259.html
- Section: 6 (number grammar)

## Impact and Risk

- **Compliance risk:** Valid JSON numbers (for example `1.5`, `6.02e23`, `-0.1E-2`) may be incorrectly rejected.
- **Functional risk:** Legitimate filter expressions fail unexpectedly, reducing query expressiveness.
- **Parser regression risk:** Broad lexer changes can accidentally alter integer, sign, or boundary handling.

## Implementation Steps

1. Review numeric scanning logic in `src/jsonpath/lexer.ts` and map each accepted form against RFC 8259 Section 6.
2. Implement a strict number-state flow (sign, integer, optional fraction, optional exponent) matching JSON grammar.
3. Ensure invalid forms remain rejected (leading plus, leading zeros where disallowed, bare decimal point, incomplete exponent).
4. Preserve current parser/evaluator numeric semantics after tokenization (no behavioral widening beyond grammar compliance).
5. Audit numeric error messaging to keep invalid-literal diagnostics actionable.

## Concrete Tests

- Add positive filter tests in `test/jsonpath.test.ts` for integers, decimals, and exponent forms (positive/negative exponent).
- Add negative tests for malformed numbers (`01`, `1.`, `.5`, `1e`, `1e+`, `+1`) to prevent over-permissive parsing.
- Add comparison tests confirming numeric literals are interpreted consistently in evaluator predicates.
- Include a regression test ensuring legacy integer behavior is unchanged.

## Rollback and Guardrails

- Land with focused lexer-only diff and comprehensive number regression tests.
- Run full JSONPath tests to catch token boundary regressions early.
- If downstream incompatibility is reported, treat as standards-compatibility migration and document accepted numeric forms clearly.
- Avoid coupling this fix with unrelated literal/token updates.
