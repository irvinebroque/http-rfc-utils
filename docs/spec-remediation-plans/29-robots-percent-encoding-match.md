# Finding 29: robots path matching percent-encoding normalization

## Summary
`src/robots.ts:236` does not fully apply RFC-required percent-encoding normalization before comparing request paths to robots directives. Matching must use normalized octets/characters per RFC 9309 references.

## Citation (URL + section)
- RFC 9309, section 2.2.2 (path matching and percent-encoding handling): https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.2
- RFC 3986, section 2.1 (Percent-Encoding): https://www.rfc-editor.org/rfc/rfc3986.html#section-2.1
- RFC 3986, section 2.2 (Reserved Characters) and section 2.3 (Unreserved Characters): https://www.rfc-editor.org/rfc/rfc3986.html#section-2.2

## Impact / risk
- Equivalent URI paths may mismatch, causing false allows/disallows.
- Attackers can exploit encoding variants to bypass intended crawl restrictions.
- Results differ from RFC-compliant crawlers, reducing interoperability and predictability.

## Implementation plan
1. Audit current robots path matching pipeline and identify normalization currently performed (if any).
2. Implement RFC-aligned normalization step for both candidate URI path and robots rule path before match comparison.
3. Decode percent-encoded octets where allowed by RFC 9309/3986 semantics and preserve reserved-character distinctions.
4. Ensure normalization is deterministic and does not double-decode inputs.
5. Keep wildcard/longest-match logic unchanged after introducing normalized comparison inputs.

## Tests
- Add tests for equivalent encoded vs unencoded unreserved characters (for example `%7E` vs `~`) matching the same rule.
- Add tests where reserved-character encoding differences remain semantically distinct when required.
- Add regression tests for mixed-case hex encodings (`%2f` vs `%2F`) according to normalization expectations.
- Add adversarial tests preventing double-decoding behavior.

## Rollback / guardrails
- Guardrail: introduce normalization as a dedicated helper to simplify validation and rollback.
- Guardrail: include fixtures covering unreserved, reserved, and malformed encodings.
- Rollback: disable normalization helper and fall back to raw comparison only as a short-term compatibility escape hatch.
