# RFC 7636 Implementation Plan: OAuth 2.0 PKCE

- Spec: https://www.rfc-editor.org/rfc/rfc7636.html
- Scope type: userspace PKCE verifier/challenge generation and validation helpers
- Repo fit: OAuth-oriented auth utilities for APIs/workers

## 1) Scope and Non-Goals

- In scope:
  - Sections 4.1-4.3, 4.5, 4.6, 7.1, 7.2, Appendices A/B.
  - `code_verifier` validation/generation.
  - `code_challenge` derivation (`plain` and `S256`).
  - Verification helper (`verifier + method` vs challenge).
  - Parse/format helpers for auth and token request PKCE params.
- Non-goals:
  - Full OAuth flow orchestration or token transport.
  - Authorization code storage/binding persistence model.
  - Extension methods beyond `plain` and `S256` in v1.

## 2) Proposed Module/Files and Public Exports

- New module: `src/auth/pkce.ts`
- Type additions in `src/types/auth.ts`
- Exports via:
  - `src/auth/index.ts`
  - `src/auth.ts`
  - `src/index.ts`
- Planned exports:
  - `generatePkceCodeVerifier`
  - `derivePkceCodeChallenge`
  - `verifyPkceCodeVerifier`
  - `validatePkceCodeVerifier`
  - `validatePkceCodeChallenge`
  - `parsePkceAuthorizationRequestParams`
  - `formatPkceAuthorizationRequestParams`
  - `parsePkceTokenRequestParams`
  - `formatPkceTokenRequestParams`
  - PKCE method/params/options types
- Tests: `test/pkce.test.ts`

## 3) Data Model and Algorithm Behavior

- Method type: `'plain' | 'S256'`.
- ABNF guard for verifier/challenge:
  - charset `A-Z a-z 0-9 - . _ ~`
  - length `43..128`.
- Generation:
  - Default 32-octet CSPRNG seed (`section 7.1`) encoded base64url without padding.
- Derivation:
  - `plain`: challenge equals verifier.
  - `S256`: `BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))`.
- Parser contract:
  - Tolerant parse returns `null` on invalid syntax/duplicates/unknown method.
  - Missing challenge method defaults to `plain`.
- Strict helpers:
  - Validators/formatters throw on semantic-invalid values.

## 4) Test Matrix (RFC-Mapped)

- Section 4.1/4.2 ABNF boundary tests (length and charset).
- Section 7.1 generation tests (shape/entropy sanity).
- Appendix B known S256 vector test.
- Section 4.3 parameter parse/format tests (default method behavior).
- Section 4.5 token request verifier parse/format tests.
- Section 4.6 verification tests (match vs mismatch).
- Section 7.2 downgrade-related behavior test (no implicit fallback from S256).

## 5) Documentation and API Map Updates

- Update `README.md` auth coverage and imports-by-task rows.
- Add module entry to `docs/src/lib/rfc-map.ts` for RFC 7636.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add PKCE types in `src/types/auth.ts`.
2. Implement `src/auth/pkce.ts`.
3. Wire exports in auth barrels and `src/index.ts`.
4. Add `test/pkce.test.ts` with RFC citations.
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

- Base64url/no-padding mistakes:
  - Centralize encoding helper and enforce regex guards.
- Method token compatibility confusion:
  - Keep exact-case behavior explicit and tested.
- Over-permissive `plain` usage:
  - Promote `S256` defaults and document caveats.
