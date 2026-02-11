# Finding 12: Digest qop requires cnonce and nc coupling

## Summary
Digest parser currently accepts credentials/challenges where `qop` is present without required coupling to `cnonce` and `nc` (where applicable). RFC 7616 requires these fields to be coordinated when `qop` is used.

## Citation
- RFC 7616, Section 3.4 (Authorization Header/parameter requirements): https://www.rfc-editor.org/rfc/rfc7616.html#section-3.4
- RFC 7616, Section 3.5 (response computation inputs): https://www.rfc-editor.org/rfc/rfc7616.html#section-3.5

## Risk
- Accepts semantically invalid Digest messages.
- Weakens interoperability and can enable incorrect authentication state handling.

## Implementation Steps
1. Add semantic validation step after syntactic parse for Digest parameter coupling rules.
2. Enforce that when `qop` is present in credentials, `cnonce` and `nc` are also required.
3. Validate `nc` format (`8HEXDIG`) and `cnonce` non-empty quoted-string semantics.
4. Return parse failure for coupling violations, consistent with existing invalid-input behavior.

## Tests
- Add tests rejecting `qop` without `cnonce`.
- Add tests rejecting `qop` without `nc`.
- Add tests rejecting malformed `nc` even when `qop` exists.
- Add positive tests for fully coupled valid Digest values.

## Rollback / Guardrails
- Keep coupling checks separate from lexical parser to avoid accidental regressions.
- Preserve current behavior for messages with no `qop` where spec allows legacy compatibility.
- Add RFC-cited tests for both `auth` and `auth-int` cases.
