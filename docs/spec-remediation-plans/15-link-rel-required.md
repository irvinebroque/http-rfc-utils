# Finding 15 Remediation Plan: Link formatter requires `rel`

## Summary
- `formatLink` in `src/link.ts` can emit a Link value without a `rel` parameter when `link.rel` is missing or empty.
- RFC 8288 treats `rel` as mandatory for a valid link-value, so formatter behavior should fail fast instead of emitting a non-compliant value.

## Spec Citation
- RFC 8288 Section 3.3: the `rel` parameter MUST be present in a link-value and MUST NOT occur more than once.
- URL: https://www.rfc-editor.org/rfc/rfc8288.html#section-3.3

## Impact
- Prevents generation of invalid `Link` header values.
- May surface new runtime errors for callers that currently pass `rel: ''` or omit `rel` through unchecked data.
- Improves parse/format round-trip reliability and downstream interoperability.

## Implementation Steps
1. Add an explicit semantic check at the start of `formatLink` that `link.rel` is a non-empty string after trim.
2. Throw a precise `Error` when missing/empty (for example, include field name and offending value).
3. Keep `rel` emission first in parameter ordering once validated.
4. Audit any internal formatter entrypoints that construct `LinkDefinition` objects and ensure they never pass empty `rel`.
5. Update docs/API notes to state formatter enforces RFC 8288 `rel` requirement.

## Test Plan
- Add a test proving `formatLink` throws when `rel` is missing/empty/whitespace.
- Add a positive test proving valid `rel` still formats first and round-trips with parser.
- Add regression tests for extension params to confirm stricter `rel` checks do not change unrelated formatting behavior.
- Cite RFC 8288 Section 3.3 in new tests.

## Rollback/Guardrails
- Guardrail: keep change formatter-only; do not loosen parser behavior in the same patch.
- Guardrail: use explicit error messages to ease caller remediation.
- Rollback path: if breakage is higher than expected, gate strictness behind an opt-in temporary compatibility flag and remove it in the next minor release.
