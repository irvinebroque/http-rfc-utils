# RFC 9126 Implementation Plan: OAuth 2.0 Pushed Authorization Requests (PAR)

- Spec: https://www.rfc-editor.org/rfc/rfc9126.html
- Scope type: request/response parse/validate/format helpers + metadata extensions
- Repo fit: OAuth utility coverage alongside RFC 8414 metadata helpers

## 1) Scope and Non-Goals

- In scope:
  - Section 2.1 pushed authorization request payload helpers (form-urlencoded parse/format/validate).
  - Section 2.2 successful response JSON parse/format/validate.
  - Section 2.3 error response JSON parse/format/validate (RFC 6749 Section 5.2 alignment).
  - Section 5 authorization server metadata extensions.
- Non-goals:
  - HTTP status handling or service orchestration.
  - Request object JWT processing, JAR validation, or authentication method enforcement.
  - Storage or replay protection for request URIs.

## 2) Proposed Modules, Types, and Exports

- New module: `src/oauth-par.ts`
- Type additions: `src/types/auth.ts` (PAR request/response types)
- Metadata updates: `src/types/discovery.ts` and `src/oauth-authorization-server-metadata.ts`
- Planned exports from `src/index.ts`:
  - `parsePushedAuthorizationRequest`
  - `validatePushedAuthorizationRequest`
  - `formatPushedAuthorizationRequest`
  - `parsePushedAuthorizationResponse`
  - `parsePushedAuthorizationResponseObject`
  - `validatePushedAuthorizationResponse`
  - `formatPushedAuthorizationResponse`
  - `parsePushedAuthorizationErrorResponse`
  - `parsePushedAuthorizationErrorResponseObject`
  - `validatePushedAuthorizationErrorResponse`
  - `formatPushedAuthorizationErrorResponse`
- Tests: `test/oauth-par.test.ts`

## 3) Data Model and Validation Behavior

- Request parser behavior (tolerant but deterministic):
  - Accepts string, URLSearchParams, or record input.
  - Returns `null` for duplicate parameter names, empty parameter names, or missing/invalid `client_id`.
  - Rejects any payload containing `request_uri` (MUST NOT per RFC 9126 Section 2.1).
  - Exposes optional validation options (e.g., `requireClientId` defaulting to true).
- Request validator/formatter:
  - Throws on invalid parameters or missing `client_id`.
  - Uses strict `request_uri` exclusion and preserves all other parameters as-is.
- Success response validation:
  - `request_uri` required non-empty string.
  - `expires_in` required positive integer number.
- Error response validation:
  - `error` required non-empty string.
  - `error_description` and `error_uri` optional strings.
- Metadata validation:
  - `pushed_authorization_request_endpoint` URL must be absolute HTTPS.
  - `require_pushed_authorization_requests` must be boolean when present.

## 4) Test Matrix (RFC-Mapped)

- Section 2.1: reject `request_uri`, enforce `client_id`, deterministic duplicate handling.
- Section 2.2: parse/format success response with valid and invalid `expires_in`.
- Section 2.3: parse/format OAuth error response shape.
- Section 5/6: metadata additions in type+validator behavior.
- Index re-exports validation.

## 5) Documentation and API Map Updates

- Update `README.md` RFC coverage + imports table.
- Add RFC 9126 entry to `docs/src/lib/rfc-map.ts` and `docs/reference/rfc-map.md`.
- Update `docs/reference/imports-by-task.md` with PAR helpers.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add PAR types and metadata extensions.
2. Implement PAR request/response module.
3. Wire exports in `src/index.ts`.
4. Add tests with RFC section citations.
5. Update docs and changeset.
6. Run gates:
   - `pnpm check:structure`
   - `pnpm typecheck:all`
   - `pnpm typecheck:strict`
   - `pnpm typecheck:lib`
   - `pnpm test`
   - `pnpm build`

## 7) Risks and Mitigations

- OAuth error semantics are extension-heavy:
  - Keep validation minimal and allow extension error codes.
- Request parameter variability:
  - Validate only PAR-specific constraints and `client_id` presence.
- Metadata extension compatibility:
  - Preserve unknown metadata members in existing parser/formatter.
