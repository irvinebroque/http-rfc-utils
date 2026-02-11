# Finding 34 Remediation Plan: OpenAPI openIdConnectUrl Required

## Finding summary
- `src/types/openapi.ts:164` defines `openIdConnectUrl?` as optional on `OpenApiOpenIdConnectSecurityScheme`.
- For OpenAPI `type: openIdConnect`, `openIdConnectUrl` is a required fixed field.
- Result: non-conformant OpenID Connect security scheme objects type-check as valid.

## Spec citation
- OpenAPI Specification 3.1.1, Security Scheme Object (`type: openIdConnect`): `openIdConnectUrl` is required.
- Reference: https://spec.openapis.org/oas/v3.1.1.html#security-scheme-object

## Impact/risk
- **Compliance risk:** OpenID Connect schemes can be authored without discovery metadata URL.
- **Runtime behavior risk:** validators/resolvers may proceed with incomplete configuration and produce weak diagnostics.
- **Interoperability risk:** exported documents may fail external schema validation.

## Implementation steps
- Make `openIdConnectUrl` required in `OpenApiOpenIdConnectSecurityScheme`.
- Consider tightening URL representation (string at type level, semantic URL validation at runtime where relevant).
- Review security validation code paths for optional access patterns and update to required-field assumptions.
- Update docs/examples to always include `openIdConnectUrl` for OpenID Connect schemes.

## Tests/typechecks
- Add compile-time checks showing:
  - `type: 'openIdConnect'` without `openIdConnectUrl` fails.
  - valid objects with `openIdConnectUrl` pass.
- Add/adjust runtime validator tests to emit clear diagnostics for missing URL in untyped inputs.
- Run: `pnpm check:structure`, `pnpm typecheck`, `pnpm typecheck:all`, `pnpm typecheck:strict`, `pnpm typecheck:lib`, `pnpm test`.

## Rollback/guardrails
- Call out strictness increase in release notes/changeset.
- Add migration note for users relying on previously-optional field behavior.
- Keep a regression test specifically covering required `openIdConnectUrl` on the discriminated union branch.
