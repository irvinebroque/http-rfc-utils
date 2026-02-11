# Finding 13: Basic challenge must reject duplicate auth params

## Summary
Basic challenge parsing currently does not invalidate duplicate auth parameters within a single challenge. Authentication parameter names are required to be unique per challenge.

## Citation
- RFC 9110, Section 11.2 (challenge/auth-param uniqueness): https://www.rfc-editor.org/rfc/rfc9110.html#section-11.2
- RFC 7617, Section 2 (Basic auth challenge usage): https://www.rfc-editor.org/rfc/rfc7617.html#section-2

## Risk
- Ambiguous parsing of security-critical challenge parameters.
- Potentially divergent client behavior when duplicates are interpreted differently.

## Implementation Steps
1. During Basic challenge parse, maintain case-insensitive set of seen auth-param names.
2. Invalidate challenge on duplicate parameter name.
3. Keep handling scoped per challenge instance (not across comma-separated challenges).
4. Ensure error/null path matches existing parser contract.

## Tests
- Add tests rejecting duplicate `realm` in one Basic challenge.
- Add tests rejecting case-variant duplicates.
- Add tests confirming duplicate detection does not cross challenge boundaries.
- Add valid control tests for unique params.

## Rollback / Guardrails
- Reuse shared auth-param duplicate detection logic where possible to keep behavior uniform.
- Add regression tests across Basic and Digest to prevent divergent fixes.
- Avoid silent winner-takes-all behavior for duplicate parameters.
