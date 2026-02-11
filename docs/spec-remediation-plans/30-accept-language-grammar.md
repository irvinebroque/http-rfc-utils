# Finding 30: Accept-Language parser grammar strictness

## Summary
`src/language.ts:40` currently accepts language-range forms outside the grammar required for `Accept-Language`. Parser behavior should reject invalid grammar at syntax level while preserving tolerant API conventions.

## Citation (URL + section)
- RFC 9110, section 12.5.4 (Accept-Language, uses `language-range`): https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.4
- RFC 4647, section 2.1 (Language Ranges grammar): https://www.rfc-editor.org/rfc/rfc4647.html#section-2.1

## Impact / risk
- Invalid ranges can enter negotiation logic and skew locale selection.
- Non-compliant parsing reduces interoperability with strict HTTP implementations.
- Validation gaps may hide malformed client headers in downstream diagnostics.

## Implementation plan
1. Compare existing language-range tokenizer/parser against RFC 4647 section 2.1 ABNF.
2. Tighten token validation to enforce allowed subtag structure and wildcard usage.
3. Preserve existing parser contract for invalid syntax (returning null/empty structures where documented).
4. Ensure quality (`q`) weight parsing remains unaffected by grammar hardening.
5. Review any shared token helpers to avoid broad regressions in unrelated parsers.

## Tests
- Add negative tests for malformed ranges (illegal characters, malformed subtags, misplaced wildcard).
- Add positive tests for valid basic language-ranges and wildcard-only entries.
- Add regression tests for mixed valid list + invalid member behavior according to existing API contract.

## Rollback / guardrails
- Guardrail: confine changes to language-range validation path, not preference ordering.
- Guardrail: pair every rejected example with a spec citation in test descriptions.
- Rollback: revert stricter validation branch if breaking changes are discovered, then reintroduce behind staged compatibility behavior.
