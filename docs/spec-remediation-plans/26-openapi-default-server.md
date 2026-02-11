# Finding 26: OpenAPI root server default fallback

## Summary
`src/openapi/path-server-resolver.ts:204` does not consistently apply the OpenAPI default when the root-level `servers` array is missing or effectively empty. Remediation should ensure the resolver falls back to `/` per OpenAPI semantics.

## Citation (URL + section)
- OpenAPI Specification 3.1.1, OpenAPI Object (`servers` default behavior): https://spec.openapis.org/oas/v3.1.1.html#openapi-object
- OpenAPI Specification 3.1.1, Server Object (`url`): https://spec.openapis.org/oas/v3.1.1.html#server-object

## Impact / risk
- Incorrect effective server resolution can produce invalid absolute URL construction.
- Downstream tooling may target the wrong origin/path when `servers` is omitted.
- Spec drift in this area can break interoperability with OpenAPI-compatible generators/parsers.

## Implementation plan
1. Confirm current resolver precedence for operation-level, path-level, and root-level `servers`.
2. Define "empty root servers" behavior (missing array, empty array, entries with missing/blank `url`) and align to default `/`.
3. Update resolver logic to apply `/` only when no valid root server URL remains after normalization.
4. Preserve existing precedence/inheritance rules so this change is narrowly scoped to default fallback.
5. Add explicit normalization checks to avoid treating whitespace-only URLs as valid.

## Tests
- Add tests for missing root `servers` -> effective default `/`.
- Add tests for `servers: []` -> effective default `/`.
- Add tests for root servers with blank/whitespace URLs -> default `/`.
- Add regression tests proving valid non-empty root/path/operation servers still override as expected.

## Rollback / guardrails
- Guardrail: keep the change isolated to root fallback path; do not alter operation/path override rules.
- Guardrail: add regression coverage for existing valid server resolution permutations.
- Rollback: revert resolver fallback branch and associated tests if integration consumers rely on previous non-spec behavior (temporary compatibility only).
