# RFC 8414 Implementation Plan: OAuth 2.0 Authorization Server Metadata

- Spec: https://www.rfc-editor.org/rfc/rfc8414.html
- Scope type: metadata parse/validate/format and URL derivation helpers
- Repo fit: OAuth discovery/bootstrap utilities for API clients/services

## 1) Scope and Non-Goals

- In scope:
  - Section 2 metadata model and validation.
  - Section 2.1 signed metadata precedence helper (no cryptographic verification).
  - Section 3 and 3.1 URL derivation (`/.well-known/oauth-authorization-server`).
  - Section 3.2 response shape constraints and serialization notes.
  - Section 3.3 issuer consistency checks.
  - Section 4 string comparison expectations.
- Non-goals:
  - Network retrieval/TLS transport behavior.
  - JOSE signature verification of `signed_metadata`.
  - Dynamic registry operations and full extension workflow.

## 2) Proposed Module/Files and Public Exports

- New module: `src/oauth-authorization-server-metadata.ts`
- Type additions: `src/types/discovery.ts`
- Planned exports from `src/index.ts`:
  - `parseAuthorizationServerMetadata`
  - `parseAuthorizationServerMetadataObject`
  - `formatAuthorizationServerMetadata`
  - `validateAuthorizationServerMetadata`
  - `buildAuthorizationServerMetadataUrl`
  - `mergeSignedAuthorizationServerMetadata`
  - `OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX`
  - Metadata types/options
- Tests: `test/oauth-authorization-server-metadata.test.ts`

## 3) Data Model and Validation Behavior

- Parser behavior (tolerant):
  - Returns `null` for invalid JSON or structurally-invalid object/member types.
  - Keeps extension members for forward compatibility.
- Strict validators/formatter:
  - Throw for semantic-invalid metadata.
- Key checks:
  - `issuer` required and must be valid HTTPS issuer-form URL.
  - Endpoint URI fields validated as absolute URLs.
  - Conditional required fields enforced per section 2 semantics.
  - `expectedIssuer` option compares issuer exactly (no normalization) per section 4.
- Signed metadata:
  - Structural support and deterministic precedence merge helper.
  - No crypto verification.

## 4) Test Matrix (RFC-Mapped)

- Section 2 required/conditional metadata checks.
- Section 2.1 signed metadata precedence behavior.
- Section 3.1 well-known URL derivation for issuer with/without path.
- Section 3.2 response formatting constraints.
- Section 3.3 and 4 issuer exact-string matching tests.
- Tolerant parse tests for malformed JSON/objects.

## 5) Documentation and API Map Updates

- Update `README.md` coverage and imports rows.
- Add RFC 8414 entry to `docs/src/lib/rfc-map.ts`.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add metadata types in `src/types/discovery.ts`.
2. Implement module in `src/oauth-authorization-server-metadata.ts`.
3. Export from `src/index.ts`.
4. Add tests with RFC section citations.
5. Update docs and changeset.
6. Run gates:
   - `pnpm check:structure`
   - `pnpm typecheck:all`
   - `pnpm typecheck:strict`
   - `pnpm typecheck:lib`
   - `pnpm test`
   - `pnpm test:coverage:check`
   - `pnpm api:extract`
   - `pnpm semver:check`
   - `pnpm build`

## 7) Risks and Mitigations

- Errata ambiguity on some conditional requirements:
  - Document strict mode defaults and compatibility notes.
- Signed metadata confusion without verification:
  - Name APIs clearly and document non-goal.
- Well-known path insertion edge cases:
  - Cover with dedicated derivation tests.
