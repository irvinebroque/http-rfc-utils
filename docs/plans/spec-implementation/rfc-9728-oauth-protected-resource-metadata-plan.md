# RFC 9728 OAuth Protected Resource Metadata Implementation Plan

- Research input: https://www.rfc-editor.org/rfc/rfc9728.html
- Primary normative baseline: RFC 9728 Sections 2-6 (plus RFC 8615, RFC 8414, RFC 6750, RFC 9449, RFC 9396, RFC 7515/7519 for terminology only).
- Scope type: parse/format/validate helpers and well-known URL builder, no HTTP client, no JOSE verification.
- Repository fit: discovery/metadata helpers with tolerant parsing and strict validation.

## 1) Scope and explicit non-goals (re-checked)

### In scope

1. Protected resource metadata types and helper functions for parse/validate/format/build/merge.
2. Well-known URL builder for resource identifiers (default suffix + custom suffix validation, query-safe).
3. Signed metadata merge helper with signed-claim precedence and structural validation only.
4. Tests for RFC 9728 Sections 2, 2.1, 2.2, 3.1-3.3, 4, 5.1-5.2 behavior boundaries.
5. Documentation updates: README table, RFC map, coverage snapshot.

### Out of scope

- HTTP fetching/caching logic for metadata retrieval.
- JOSE signature verification and JWKS handling.
- Authorization server metadata URL fetching or token flow orchestration.
- Full `WWW-Authenticate` challenge parsing changes (already covered by auth helpers; only document usage).

## 2) Normative section map (implementation anchors)

- RFC 9728 Section 2: metadata member list and field semantics.
- RFC 9728 Section 2.1: language-tagged human-readable fields.
- RFC 9728 Section 2.2: signed metadata JWT precedence rules.
- RFC 9728 Section 3.1: well-known URL insertion algorithm for resource identifiers.
- RFC 9728 Section 3.2: JSON response shape and omission of empty arrays, with explicit bearer-methods exception.
- RFC 9728 Section 3.3: resource identifier equality validation rules.
- RFC 9728 Section 4: authorization server metadata `protected_resources` parameter.
- RFC 9728 Section 5.1-5.2: `resource_metadata` parameter behavior (surface in tests/docs).

## 3) Module layout and exports

- New module: `src/oauth-protected-resource-metadata.ts`.
- Types: extend `src/types/discovery.ts` with `ProtectedResourceMetadata` and options interfaces.
- Public exports: update `src/index.ts` and `docs/src/lib/rfc-map.ts`.
- Update `src/oauth-authorization-server-metadata.ts` and types to include `protected_resources`.

## 4) Validation rules (refined)

- `resource` required, HTTPS URL, no fragment; optional exact match via `expectedResource` option.
- `authorization_servers` entries validated as HTTPS issuer identifiers per RFC 8414 rules.
- URL fields must be absolute; `jwks_uri` must be HTTPS.
- Array fields must contain non-empty strings; empty arrays are rejected except `bearer_methods_supported`, which may be empty per Section 2.
- `resource_signing_alg_values_supported` MUST NOT include `none`.
- Boolean fields must be boolean if present.
- Language-tagged `resource_name`, `resource_documentation`, `resource_policy_uri`, `resource_tos_uri` require string values, with URL validation for the URI variants.
- Signed metadata merge ignores JWT registered claims and `signed_metadata` claim.

## 5) Tests (targeted)

- URL builder examples with path, trailing slash, and query.
- Parsing tolerates extensions and rejects invalid shapes.
- Validation errors for wrong scheme, fragment, bad arrays, bad JWT claims.
- Signed metadata merge precedence and rejection of invalid merged values.
- RFC 9728 `protected_resources` support in authorization server metadata.

## 6) Implementation checklist

1. Add new types and module skeleton.
2. Implement parse/validate/format/build/merge functions.
3. Extend auth server metadata type and validation for `protected_resources`.
4. Add tests for RFC 9728 and update existing RFC 8414 tests if needed.
5. Update README + RFC map.
