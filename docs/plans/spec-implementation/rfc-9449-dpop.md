# RFC 9449 DPoP implementation plan

## Research highlights
- DPoP header uses `token68` syntax (RFC 9449 Section 4.1; RFC 9110 Section 11.2).
- DPoP proof JWT header MUST include `typ=dpop+jwt`, `alg` asymmetric (not `none` or MAC), and public `jwk` without private key material (Section 4.2).
- DPoP proof claims MUST include `jti`, `htm`, `htu` (no query/fragment), `iat`; `ath` required for protected resource access; `nonce` required when server provides `DPoP-Nonce` (Sections 4.2, 7, 8-9).
- Validation checks include method/URI match, nonce match, time window, `ath` hash, and key binding checks (Section 4.3, 7.1).
- DPoP authentication scheme uses `Authorization: DPoP <token68>` (Section 7.1).
- `WWW-Authenticate: DPoP` supports `realm`, `scope`, `error`, `error_description`, `error_uri`, and `algs` params; errors include `invalid_dpop_proof` and `use_dpop_nonce` (Section 7.1, 8-9).
- `DPoP-Nonce` header uses `nonce = 1*NQCHAR` and can be issued on 400/401 or successful responses for nonce rotation (Sections 8-9).

## Scope
- Deterministic parse/format/validate helpers for DPoP proofs and DPoP auth/header helpers.
- Access-token hash helper (`ath`) and nonce parsing.
- Public exports wired through `src/auth.ts` and `src/index.ts` plus new types in `src/types/auth.ts`.
- RFC-cited tests, docs updates, and a changeset.

## Proposed API surface
- `parseDpopHeader`, `formatDpopHeader`
- `parseDpopAuthorization`, `formatDpopAuthorization`
- `parseDpopChallenge`, `formatDpopChallenge`
- `parseDpopProofJwt`, `formatDpopProofJwt`, `validateDpopProofJwt`
- `computeDpopAth`, `parseDpopNonce`, `formatDpopNonce`

## Types
- `DpopProofJwtHeader`, `DpopProofJwtPayload`, `DpopProofJwt`
- `DpopProofJwtValidationOptions`
- `DpopChallenge`, `DpopError`

## Validation behavior
- Strict checks for required header/claims and `token68` / base64url syntax.
- `htu` comparison using normalization (lowercase scheme/host, strip query/fragment, default ports).
- Optional enforcement for `iat` time window (future skew/max age), `nonce`, and `ath` via validation options.
- Explicit note that JOSE signature verification is out of scope.

## Tests
- Token68 parsing for DPoP header and auth scheme.
- JWT parsing for base64url segments and required claims.
- `ath` hash vector based on RFC example.
- Nonce validation and `use_dpop_nonce` challenge parsing/formatting.
- `htm`/`htu` validation with normalization rules.

## Documentation updates
- `README.md` task list + RFC coverage snapshot.
- `docs/src/lib/rfc-map.ts` entry for RFC 9449 and module exports.
- `docs/reference/rfc-map.md` and `docs/reference/imports-by-task.md` updates.

## Changeset
- Add a minor changeset describing new DPoP helpers and out-of-scope JOSE verification.

## Implementation steps
1. Add `src/auth/dpop.ts` with parse/format/validate helpers and hashing utilities.
2. Add new DPoP types in `src/types/auth.ts` and export via `src/auth/index.ts` and `src/index.ts`.
3. Add tests in `test/dpop.test.ts`.
4. Update docs and RFC map.
5. Add changeset and run targeted tests.
