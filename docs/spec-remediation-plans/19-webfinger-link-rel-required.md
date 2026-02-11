# Finding 19 Remediation Plan: WebFinger link `rel` must be present and non-empty

## Summary
- `parseJrdLink` in `src/webfinger.ts` currently coerces missing `rel` to an empty string.
- RFC 7033 requires each link object to contain `rel`; parser should reject links that omit or empty this member.

## Spec Citation
- RFC 7033 Section 4.4.4.1: JRD link objects MUST include a `rel` member.
- URL: https://www.rfc-editor.org/rfc/rfc7033.html#section-4.4.4.1

## Impact
- Prevents silently accepting invalid WebFinger link objects.
- May change parse outcomes for payloads that currently pass with empty `rel` values.
- Improves consistency between parser behavior and `validateJrd` MUST-level checks.

## Implementation Steps
1. Update `parseJrdLink` to require `obj.rel` be a non-empty string (after trim policy is decided and documented).
2. On invalid `rel`, fail parsing in a deterministic way:
   - either throw from strict parser path, and
   - ensure `tryParseJrd` returns `null` for such payloads.
3. Keep optional fields (`type`, `href`, `titles`, `properties`) behavior unchanged.
4. Align `validateJrd` message wording with parser enforcement so both indicate MUST semantics.
5. Add RFC section comments near link parsing for long-term maintainability.

## Test Plan
- Add negative tests for links with missing `rel`, empty `rel`, and non-string `rel`.
- Add positive tests for valid `rel` values with and without other optional members.
- Add end-to-end JRD parse tests where one invalid link causes expected parse failure behavior.
- Cite RFC 7033 Section 4.4.4.1 in new tests.

## Rollback/Guardrails
- Guardrail: keep this strictness scoped to `links[].rel`; do not over-restrict optional members.
- Guardrail: preserve `tryParseJrd` non-throwing contract when strict parse fails.
- Rollback path: if strict rejection of any invalid link is too disruptive, temporarily switch to dropping invalid links with a documented warning while planning a future strict-mode default.
