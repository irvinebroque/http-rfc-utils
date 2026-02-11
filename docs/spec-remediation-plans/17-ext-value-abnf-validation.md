# Finding 17 Remediation Plan: strict RFC 8187 `ext-value` ABNF validation

## Summary
- `decodeExtValue` in `src/ext-value.ts` is currently permissive and may accept inputs that do not match RFC 8187 `ext-value` grammar.
- The decoder should validate structure and allowed characters before decoding percent-encoded bytes.

## Spec Citation
- RFC 8187 Section 3.2.1 (`ext-value` ABNF): `charset'language'value-chars`.
- RFC 8187 Section 3.2.1 (`value-chars`): zero or more `pct-encoded` or `attr-char`.
- URL: https://www.rfc-editor.org/rfc/rfc8187.html#section-3.2.1

## Impact
- Reduces false-positive decodes and aligns behavior with protocol grammar.
- Invalid inputs that previously decoded may now return `null`.
- Improves safety for downstream header parsing that depends on strict syntax filtering.

## Implementation Steps
1. Add a dedicated validator for full `ext-value` token shape (exactly two single quotes, non-empty charset).
2. Validate `charset` token syntax per RFC expectations before decode.
3. Validate optional `language` syntax (or reject malformed language subtags).
4. Validate `value-chars` so each segment is either a valid `%HH` triplet or an `attr-char`; reject raw disallowed bytes/chars.
5. Decode only after syntax validation, then return normalized `charset` and decoded value.
6. Keep return contract unchanged (`null` on malformed input) for parser tolerance.

## Test Plan
- Positive tests for canonical valid cases:
  - `UTF-8''hello`
  - `UTF-8'en'%C2%A3%20rates`
  - attr-char-only values.
- Negative tests for malformed cases:
  - missing/extra quote delimiters,
  - empty charset,
  - invalid percent triplets,
  - disallowed unescaped characters in `value-chars`,
  - malformed language tokens.
- Add round-trip tests with `encodeExtValue` to ensure valid outputs always decode.
- Cite RFC 8187 Section 3.2.1 in test names/comments.

## Rollback/Guardrails
- Guardrail: preserve non-throwing behavior (`null`) to avoid introducing parser exceptions.
- Guardrail: avoid broad regexes that accidentally allow non-ABNF characters.
- Rollback path: if strict language validation is too disruptive, keep strict charset/value-chars validation and temporarily relax language parsing with a tracked follow-up item.
