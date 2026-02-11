# Finding 22 Remediation Plan: JSONPath String Control Characters

## Summary

The string lexer currently allows raw control characters in string literals that should be rejected by grammar constraints. This plan enforces escaped representation for control characters and rejects unescaped control bytes during lexing.

## Spec Citation

- RFC 9535 URL: https://www.rfc-editor.org/rfc/rfc9535.html
- Section: 2.3.1.1 (string literal grammar used by selectors/expressions)

## Impact and Risk

- **Compliance risk:** Accepting disallowed raw controls violates grammar and may diverge from interoperable engines.
- **Security/robustness risk:** Hidden control characters can create ambiguous logs, tooling mismatches, or unexpected downstream handling.
- **Compatibility risk:** Inputs that relied on permissive control-char acceptance will start failing.

## Implementation Steps

1. Update string-scanning branch in `src/jsonpath/lexer.ts` to reject raw U+0000..U+001F characters unless represented via valid escape sequences.
2. Preserve existing valid escape handling (`\\`, `\"`, `\uXXXX`, etc.) and ensure escape decoding rules remain stable.
3. Keep error locations pinned to the offending character index for easier debugging.
4. Verify interactions with both single-quoted and double-quoted JSONPath string contexts (as implemented by current grammar support).
5. Confirm parser/evaluator paths receive normalized string token payloads only from valid lexical forms.

## Concrete Tests

- Add negative tests in `test/jsonpath.test.ts` for raw newline, tab, carriage return, and other control characters inside string literals.
- Add positive tests for escaped control forms (`\n`, `\t`, `\r`, `\u0000`, `\u001F`).
- Add regression tests for ordinary printable strings and existing escape scenarios.
- Add at least one test validating error position/message quality for a control-character failure.

## Rollback and Guardrails

- Keep change isolated to string lexing rules; do not alter evaluator string comparison logic in the same patch.
- Require targeted lexer tests plus full suite pass before merge.
- Document stricter input validation as a standards-conformance change.
- If rollback is necessary, revert only the string-control validation commit and retain new tests for future hardening work.
