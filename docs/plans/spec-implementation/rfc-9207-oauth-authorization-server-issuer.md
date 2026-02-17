# RFC 9207 Implementation Plan: OAuth 2.0 Authorization Server Issuer Identification

- Spec: https://www.rfc-editor.org/rfc/rfc9207.html
- Scope type: issuer parameter parsing/formatting/validation helpers + metadata flag wiring
- Repo fit: OAuth metadata + auth helper set (RFC 8414 adjacency)

## 1) Scope and Non-Goals

- In scope:
  - RFC 9207 Sections 2, 2.3, 2.4, and 3.
  - `iss` response parameter parse/format helpers (x-www-form-urlencoded).
  - Issuer validation helper enforcing https scheme + no query/fragment.
  - Optional exact string comparison against expected issuer.
  - Metadata boolean `authorization_response_iss_parameter_supported` wiring + strict boolean validation.
- Non-goals:
  - OAuth flow orchestration or state storage.
  - Response transport (redirect handling, HTTP routing).
  - JARM or ID Token validation.

## 2) Proposed Module/Files and Public Exports

- New module: `src/oauth-authorization-server-issuer.ts`.
- Type additions in `src/types/auth.ts`.
- Metadata update in `src/oauth-authorization-server-metadata.ts` + `src/types/discovery.ts`.
- Exports via `src/index.ts` (and facades where appropriate).
- Planned exports:
  - `parseAuthorizationResponseIssuerParam`
  - `formatAuthorizationResponseIssuerParam`
  - `validateAuthorizationResponseIssuer`
  - Options types (`AuthorizationResponseIssuerParseOptions`, etc.)
- Tests: `test/oauth-authorization-server-issuer.test.ts` plus RFC 9207 coverage in metadata tests.

## 3) Data Model and Behavior

- `iss` parameter is decoded via `URLSearchParams` (RFC 6749 Appendix B).
- Issuer validation:
  - MUST be an absolute URL with `https` scheme.
  - MUST NOT include query or fragment components.
  - Optional exact string comparison against expected issuer (RFC 3986 §6.2.1).
- Parser behavior:
  - Tolerant parse returns `null` on duplicate/invalid values.
  - Optional `requireIssuer` flag rejects missing `iss`.
  - Missing `iss` yields an empty object when not required, so presence checks are explicit.
- Formatter:
  - Validates issuer then encodes as x-www-form-urlencoded.

## 4) Test Matrix (RFC-Mapped)

- Section 2: issuer parameter present in success/error response (decode/encode coverage).
- Section 2.4: exact string comparison against expected issuer.
- Section 2: reject non-https issuers or values with query/fragment.
- Section 3: metadata boolean acceptance and default behavior when omitted.
  - Duplicate `iss` parameters should be rejected.

## 5) Documentation and API Map Updates

- Add RFC 9207 entry to `docs/src/lib/rfc-map.ts` and `docs/reference/rfc-map.md`.
- Update README task table + RFC coverage snapshot.
- Update `docs/reference/imports-by-task.md` with new helpers.
- Add `.changeset/*.md` (minor version).

## 6) Execution Sequence and Quality Gates

1. Add types in `src/types/auth.ts` and metadata flag in `src/types/discovery.ts`.
2. Implement `src/oauth-authorization-server-issuer.ts`.
3. Update metadata validation/formatting for the new boolean field.
4. Wire exports in `src/index.ts`.
5. Add RFC 9207 tests (new module + metadata).
6. Update docs + changeset.
7. Run quality gates (per AGENTS.md) as needed.
