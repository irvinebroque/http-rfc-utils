# Finding 24 Remediation Plan: Function Expression Type Validation

## Summary

The parser currently appears to build function expression nodes without enforcing required well-typedness constraints from the function extension model. This plan adds type validation for function expressions so invalid argument/return combinations are rejected per spec.

## Spec Citation

- RFC 9535 URL: https://www.rfc-editor.org/rfc/rfc9535.html
- Section: 2.4 (function extensions and well-typedness constraints)

## Impact and Risk

- **Compliance risk:** Ill-typed function expressions may parse/evaluate despite being invalid by RFC rules.
- **Correctness risk:** Runtime evaluation can produce inconsistent results if argument categories are unchecked.
- **Compatibility risk:** Queries depending on permissive typing may stop working after strict validation.

## Implementation Steps

1. Review function-expression parse path in `src/jsonpath/parser.ts` and identify missing type checks at parse/validation time.
2. Define or reuse internal expression category metadata (for example: value, logical, node-list) needed to validate signatures.
3. Enforce argument and return-type compatibility for each supported function during parser validation.
4. Emit specific errors describing function name, argument index, expected category, and actual category.
5. Confirm evaluator assumes only validated function expressions and remove redundant runtime type branching where safe.

## Concrete Tests

- Add positive tests in `test/jsonpath.test.ts` for valid function calls with correctly typed arguments.
- Add negative tests for each supported function with representative argument type mismatches.
- Add nested-expression tests where type mismatch occurs through composed function/query expressions.
- Add regression tests to confirm existing valid function behavior and outputs remain unchanged.

## Rollback and Guardrails

- Stage parser/type-validation changes independently from evaluator optimizations.
- Require strict RFC-cited tests for each function signature rule before merge.
- If regressions surface, temporarily retain strict parse-time validation and defer evaluator refactors.
- Document newly enforced typing behavior in release notes as standards alignment.
