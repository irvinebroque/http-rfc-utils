# Finding 14: Digest challenge must reject duplicate auth params

## Summary
Digest challenge parsing currently accepts duplicate auth parameters instead of treating the challenge as invalid. Specs require auth-param names to appear at most once per challenge.

## Citation
- RFC 9110, Section 11.2 (challenge/auth-param uniqueness): https://www.rfc-editor.org/rfc/rfc9110.html#section-11.2
- RFC 7616, Section 3.3 (Digest WWW-Authenticate challenge): https://www.rfc-editor.org/rfc/rfc7616.html#section-3.3

## Risk
- Ambiguous challenge semantics for nonce, realm, qop, algorithm, and opaque.
- Can produce inconsistent client responses and weaken authentication robustness.

## Implementation Steps
1. Add case-insensitive duplicate auth-param detection in Digest challenge parser.
2. Fail parsing when any auth-param repeats within the same challenge.
3. Ensure duplicate detection integrates with existing quoted/unquoted parsing paths.
4. Keep behavior aligned with Basic challenge duplicate handling.

## Tests
- Add tests rejecting duplicate `nonce`, `realm`, and `qop` parameters.
- Add tests for case-insensitive duplicates.
- Add tests with mixed quoting forms to ensure duplicates are still caught.
- Add positive test confirming unique parameter set remains valid.

## Rollback / Guardrails
- Centralize auth-param uniqueness helper across auth modules to prevent drift.
- Keep parser failure deterministic and non-throwing if current API expects null invalidation.
- Add cross-module regression tests for duplicate rules in both Basic and Digest challenges.
