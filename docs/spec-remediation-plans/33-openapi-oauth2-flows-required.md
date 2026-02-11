# Finding 33 Remediation Plan: OpenAPI oauth2 Flows Required

## Finding summary
- `src/types/openapi.ts:156` defines `OpenApiOAuth2SecurityScheme` without a required `flows` member.
- Current type only models `availableScopes?`, which is not the OpenAPI contract for `oauth2` security schemes.
- Result: invalid `oauth2` security scheme objects are accepted at compile time.

## Spec citation
- OpenAPI Specification 3.1.1, Security Scheme Object (`type: oauth2`): `flows` is required.
- OpenAPI Specification 3.1.1, OAuth Flows Object: flow objects define grant-specific URLs and `scopes` maps.
- Reference: https://spec.openapis.org/oas/v3.1.1.html#security-scheme-object
- Reference: https://spec.openapis.org/oas/v3.1.1.html#oauth-flows-object

## Impact/risk
- **Compliance risk:** oauth2 metadata can be declared without grant flow definitions.
- **Security interpretation risk:** consumers may infer scopes/flows incorrectly and mis-evaluate required scopes.
- **Ecosystem mismatch:** typed documents can pass local checks but fail external OpenAPI tooling.

## Implementation steps
- Add explicit OpenAPI OAuth2 types:
  - `OpenApiOAuthFlowObject` with required `scopes` and flow-appropriate URLs.
  - `OpenApiOAuthFlowsObject` grouping `implicit`, `password`, `clientCredentials`, and `authorizationCode`.
- Update `OpenApiOAuth2SecurityScheme` to require `flows: OpenApiOAuthFlowsObject`.
- Re-evaluate the role of existing `availableScopes?`:
  - remove if redundant, or
  - keep as derived/internal metadata but separate from raw OpenAPI shape.
- Align validation paths to use `flows` as source of truth for declared scopes.

## Tests/typechecks
- Add compile-time/type fixtures proving:
  - `type: 'oauth2'` without `flows` fails.
  - `flows` with at least one valid flow object passes.
  - invalid flow payloads (missing required `scopes`) fail.
- Add runtime/unit tests (if validators consume this shape) for scope resolution from `flows`.
- Run: `pnpm check:structure`, `pnpm typecheck`, `pnpm typecheck:all`, `pnpm typecheck:strict`, `pnpm typecheck:lib`, `pnpm test`.

## Rollback/guardrails
- Document this as a type-tightening change in changeset/release notes.
- Provide migration examples for converting legacy `availableScopes` usage to `flows`.
- Keep regression tests around `flows` requiredness and grant-object constraints.
