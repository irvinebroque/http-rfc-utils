# Finding 23 Remediation Plan: Singular Query Enforcement

## Summary

The parser may accept non-singular queries in expression positions where the grammar requires a `singular-query`. This plan adds strict syntactic/semantic checks so only singular-query forms are accepted in those contexts.

## Spec Citation

- RFC 9535 URL: https://www.rfc-editor.org/rfc/rfc9535.html
- Section: 2.3.5.1 (filter expressions; use of `singular-query`)

## Impact and Risk

- **Compliance risk:** Non-singular paths can pass where scalar/definite semantics are required.
- **Evaluation risk:** Runtime behavior may be ambiguous when multi-node query results are implicitly treated as single values.
- **Breaking-change risk:** Existing permissive expressions may now fail parse/validation.

## Implementation Steps

1. Inspect `src/jsonpath/parser.ts` near singular-query parsing to identify where non-singular productions are currently admitted.
2. Introduce explicit parser constraints (or AST validation pass) that mark and reject non-singular query forms in singular-required positions.
3. Ensure diagnostics indicate both the invalid construct and the singular-query requirement.
4. Preserve existing behavior for contexts where non-singular queries are allowed.
5. Re-check evaluator assumptions so it can rely on parser-enforced singularity instead of ad-hoc runtime handling.

## Concrete Tests

- Add positive tests for valid singular-query usage in filter operands.
- Add negative tests for wildcards, unions, slices, or descendants in singular-required positions.
- Add regression tests ensuring the same non-singular constructs remain valid where grammar permits them.
- Add evaluator-level test(s) confirming no implicit multi-node coercion occurs after parser tightening.

## Rollback and Guardrails

- Implement as a parser-focused change with minimal AST shape churn.
- Pair every new rejection rule with a specific RFC-cited test to prevent accidental over-restriction.
- If downstream impact is high, provide migration guidance toward explicit singular selectors.
- Keep commit granularity narrow so singular-enforcement logic can be reverted independently if needed.
