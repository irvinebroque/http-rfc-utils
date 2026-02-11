# Finding 35 Remediation Plan: OpenAPI Server Variable default Required

## Finding summary
- `src/types/openapi.ts:290` defines `OpenApiServerVariableObject.default?` as optional.
- OpenAPI requires `default` for each Server Variable Object.
- Result: server variable maps can be declared without required fallback substitution values.

## Spec citation
- OpenAPI Specification 3.1.1, Server Variable Object: `default` is required and used when alternate values are not supplied.
- Reference: https://spec.openapis.org/oas/v3.1.1.html#server-variable-object

## Impact/risk
- **Compliance risk:** typed server objects may violate OpenAPI schema.
- **Resolution risk:** server URL expansion can become ambiguous when a variable lacks default.
- **Tooling mismatch:** generated or exported specs can fail third-party validators.

## Implementation steps
- Change `OpenApiServerVariableObject.default` from optional to required.
- Review server resolution helpers to remove optional checks that assume missing defaults are acceptable.
- Ensure diagnostics for untyped inputs still produce actionable errors when `default` is absent.
- Update docs/examples for server variables to include mandatory defaults.

## Tests/typechecks
- Add compile-time checks verifying:
  - server variable object without `default` fails.
  - server variable object with `default` (and optional `enum`/`description`) passes.
- Add runtime test coverage for resolver behavior with complete variable definitions.
- Run: `pnpm check:structure`, `pnpm typecheck`, `pnpm typecheck:all`, `pnpm typecheck:strict`, `pnpm typecheck:lib`, `pnpm test`.

## Rollback/guardrails
- Mark as a type-contract tightening in changeset/release notes.
- Provide migration examples for existing specs missing `default` values.
- Keep a targeted regression test that prevents `default` from becoming optional again.
