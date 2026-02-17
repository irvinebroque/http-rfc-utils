# RFC 9068 JWT Access Token Profile

## Goal
- Add deterministic parse/format/validate helpers for RFC 9068 JWT access tokens.
- Provide strict claim-shape validation with explicit issuer/audience/time checks.
- Wire public exports, tests, docs, and changeset updates.

## Scope
- RFC 9068 Sections 2 and 4 (header + claim requirements; validation rules).
- Pure utilities (no JOSE signing/verification, no network/discovery).
- Tolerant parsing helpers returning null for malformed input.
- Strict validators and formatters that throw on semantic violations.

## Non-Goals
- JWS/JWE signature verification or encryption/decryption.
- OAuth flow orchestration or AS/RS discovery logic.
- Persisted token storage, introspection, or runtime policy decisions.

## Proposed Public API
- Types: `JwtAccessToken`, `JwtAccessTokenHeader`, `JwtAccessTokenClaims`.
- Options: `JwtAccessTokenValidationOptions`, `JwtAccessTokenParseOptions`.
- Helpers:
  - `parseJwtAccessToken` (JWT compact JWS -> structured token or null).
  - `validateJwtAccessToken`, `validateJwtAccessTokenHeader`, `validateJwtAccessTokenClaims`.
  - `formatJwtAccessTokenHeader`, `formatJwtAccessTokenClaims` (deterministic JSON).

## Implementation Plan
1. Add new module `src/auth/jwt-access-token.ts` with RFC header comment and helper functions.
2. Define RFC 9068 types in `src/types/auth.ts` and export via `src/index.ts`.
3. Re-export helpers in `src/auth/index.ts` and `src/index.ts`.
4. Add tests in `test/jwt-access-token-profile.test.ts` for parsing, validation, and format order.
5. Update docs:
   - `README.md` (task mapping + RFC coverage).
   - `docs/reference/imports-by-task.md`.
   - `docs/src/lib/rfc-map.ts` with RFC 9068 entry.
6. Add changeset under `.changeset/` (patch bump).

## Validation Rules (Expected)
- Header `typ` must be `at+jwt` or `application/at+jwt` (configurable).
- Header `alg` must be present and not `none`.
- Claims `iss`, `sub`, `aud`, `exp`, `iat`, `jti`, `client_id` required.
- Numeric date claims must be finite numbers.
- `aud` supports string or array; expected audience must match one entry.
- Optional claims validated for shape (`scope`, `auth_time`, `acr`, `amr`, `groups`, `roles`, `entitlements`).
- Expiry enforced using `now` and `clockSkewSeconds` options.
- Extension claims must be JSON-serializable for deterministic formatting.

## Test Coverage
- Happy-path parse/validate using RFC 9068 example claims.
- Missing/invalid required claims.
- Invalid header typ/alg values.
- Audience matching logic for string and array cases.
- Expiration and clock-skew behavior.
- Deterministic formatting preserves known fields and sorts extension keys.

## Notes
- Encrypted JWT access tokens (JWE) will be rejected by the parser.
- Signature verification remains out of scope; caller must verify separately.
