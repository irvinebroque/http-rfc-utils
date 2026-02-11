# Finding 32 Remediation Plan: OpenAPI apiKey Required Fields

## Finding summary
- `src/types/openapi.ts:142/144/145` defines `OpenApiApiKeySecurityScheme` with optional `in` and `name`.
- Current `in` typing reuses `OpenApiParameterLocation`, which includes `path`; OpenAPI `apiKey` allows only `query`, `header`, or `cookie`.
- Result: type-level model permits invalid `apiKey` security scheme declarations and under-constrains required members.

## Spec citation
- OpenAPI Specification 3.1.1, Security Scheme Object (`type: apiKey`): `name` and `in` are required fixed fields.
- OpenAPI Specification 3.1.1, Security Scheme Object (`in` for `apiKey`): allowed values are `query`, `header`, `cookie`.
- Reference: https://spec.openapis.org/oas/v3.1.1.html#security-scheme-object

## Impact/risk
- **Compliance risk:** consumers can construct non-conformant security metadata without compile-time errors.
- **Runtime policy drift:** downstream validation logic may assume required fields exist and silently degrade.
- **Interoperability risk:** generated clients/docs can diverge from compliant OpenAPI documents.

## Implementation steps
- Introduce a dedicated `OpenApiApiKeyLocation = 'query' | 'header' | 'cookie'` type.
- Update `OpenApiApiKeySecurityScheme` so `in` and `name` are required.
- Ensure `OpenApiSecuritySchemeMetadata` union preserves discriminated narrowing with stricter `apiKey` branch.
- Audit dependent call sites in security validation/helpers for assumptions about optional `name`/`in` and align signatures.
- Update public docs/type examples that currently imply optional `apiKey` fields.

## Tests/typechecks
- Add compile-time type tests (or equivalent fixture assertions) showing:
  - missing `name` fails for `type: 'apiKey'`.
  - missing `in` fails for `type: 'apiKey'`.
  - `in: 'path'` fails for `type: 'apiKey'`.
  - valid `in` values (`query`, `header`, `cookie`) pass.
- Run quality gates: `pnpm check:structure`, `pnpm typecheck`, `pnpm typecheck:all`, `pnpm typecheck:strict`, `pnpm typecheck:lib`, `pnpm test`.

## Rollback/guardrails
- Ship with a changeset noting stricter OpenAPI typing as a potentially breaking type-level change.
- If ecosystem breakage is high, provide temporary compatibility aliases in docs only (not relaxed core types), with migration guidance.
- Add regression coverage in type tests to prevent reintroduction of optional/invalid `apiKey` fields.
