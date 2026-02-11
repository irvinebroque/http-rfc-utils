# Passkeys/WebAuthn v1 Implementation Plan for `http-rfc-utils`

- Research input: `docs/plans/spec-implementation/passkeys-webauthn-research.md`
- Primary normative baseline: W3C WebAuthn Level 3 (`https://www.w3.org/TR/webauthn-3/`) plus RFC 4648 and RFC 9053.
- Scope type: deterministic parse/format/validate utilities only (no browser/UI/network orchestration).
- Repository fit: auth-domain data-contract helpers with strict parser/validator behavior.

## 1) Reviewed v1 scope (single-pass feasible) and explicit non-goals

### v1 in-scope (implement now)

1. Strict WebAuthn base64url helpers for binary JSON members.
2. Creation/request options JSON codecs and strict validators (shape + policy checks only).
3. `clientDataJSON` parse/format/validate helpers.
4. `authenticatorData` parse/validate helpers with structural AT/ED handling and no CBOR decoding.
5. COSE algorithm constants + allowlist validator used by WebAuthn option validation.

### Deferred from v1 (explicitly out of scope)

- Related origins (`/.well-known/webauthn`) parsing/validation (defer to phase 2; high churn and not required for baseline RP verification).
- CTAP transport/authenticator command implementation.
- Full ceremony orchestration (`verifyRegistration`, `verifyAssertion`) and challenge/session persistence.
- Attestation statement cryptographic verification and PKIX path/revocation logic.
- Full CBOR decode of attestation formats (`packed`, `tpm`, `android-key`, etc.).
- FIDO MDS BLOB ingestion/signature verification.
- Browser wrappers around `navigator.credentials.*`.

## 2) Normative section map (pinned to implemented behaviors)

### Feature A: base64url codec

- RFC 4648 Section 5: `https://www.rfc-editor.org/rfc/rfc4648.html#section-5`
- WebAuthn parse-from-JSON algorithms using base64url fields:
  - `https://www.w3.org/TR/webauthn-3/#sctn-parseCreationOptionsFromJSON`
  - `https://www.w3.org/TR/webauthn-3/#sctn-parseRequestOptionsFromJSON`

### Feature B: options JSON codecs and validators

- `https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialcreationoptionsjson`
- `https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrequestoptionsjson`
- `https://www.w3.org/TR/webauthn-3/#sctn-parseCreationOptionsFromJSON`
- `https://www.w3.org/TR/webauthn-3/#sctn-parseRequestOptionsFromJSON`
- `https://www.w3.org/TR/webauthn-3/#sctn-alg-identifier`
- RFC 9053 Section 2: `https://www.rfc-editor.org/rfc/rfc9053.html#section-2`

### Feature C: `clientDataJSON`

- `https://www.w3.org/TR/webauthn-3/#dictionary-client-data`
- `https://www.w3.org/TR/webauthn-3/#clientdatajson-verification`
- `https://www.w3.org/TR/webauthn-3/#sctn-validating-origin`
- `https://www.w3.org/TR/webauthn-3/#sctn-cryptographic-challenges`

### Feature D: `authenticatorData`

- `https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data`
- `https://www.w3.org/TR/webauthn-3/#sctn-attested-credential-data`
- `https://www.w3.org/TR/webauthn-3/#sctn-sign-counter`

## 3) Repo-specific module layout and export wiring

### New source modules (auth domain)

- `src/auth/webauthn-base64url.ts`
- `src/auth/webauthn-cose.ts`
- `src/auth/webauthn-options.ts`
- `src/auth/webauthn-client-data.ts`
- `src/auth/webauthn-authenticator-data.ts`
- `src/auth/webauthn.ts` (auth-domain facade)

### Type placement (avoid extra facade churn)

- Extend `src/types/auth.ts` with WebAuthn types.
- Do not introduce `src/types/webauthn.ts` in v1.
- `src/types/shared.ts` and `src/types.ts` remain compatible through existing `types/auth.ts` re-export.

### Existing files to update

- `src/auth/index.ts` (export WebAuthn helpers)
- `src/auth.ts` (header comment update only if needed for RFC list)
- `src/index.ts` (public package exports)
- `README.md` (coverage and examples)
- `docs/reference/imports-by-task.md` (new WebAuthn task row)
- `docs/src/lib/rfc-map.ts` (module/sections/exports/notes)
- `.changeset/<slug>.md` (real release note)

### Proposed public exports (v1)

- `parseWebauthnBase64url`
- `formatWebauthnBase64url`
- `validateWebauthnBase64url`
- `parseWebauthnCreationOptionsFromJson`
- `formatWebauthnCreationOptionsToJson`
- `validateWebauthnCreationOptions`
- `parseWebauthnRequestOptionsFromJson`
- `formatWebauthnRequestOptionsToJson`
- `validateWebauthnRequestOptions`
- `parseWebauthnClientDataJson`
- `formatWebauthnClientDataJson`
- `validateWebauthnClientData`
- `parseWebauthnAuthenticatorData`
- `validateWebauthnAuthenticatorData`
- `validateWebauthnCoseAlgorithm`
- `WEBAUTHN_COSE_ALGORITHM_IDS`

## 4) API contracts and strict/permissive decisions

- Parser contract: `parseX` returns `null` on syntax-invalid input (never throws for ordinary malformed payloads).
- Formatter/validator contract: `formatX` and `validateX` throw `Error` with field-specific context on semantic-invalid input.
- JSON text handling: parse helpers accept object/bytes; no `tryParseX` in v1 unless untrusted JSON text parsing becomes mandatory.
- Unknown object members: ignored on parse (WebIDL dictionary-like behavior), not preserved for re-serialization in v1.
- `authenticatorData` AT/ED blocks: parsed as validated byte slices only; CBOR or attestation-format semantics are out of scope.

## 5) Security defaults (explicit and conservative)

- Challenge requirements: decoded challenge length must be `>= 16` bytes by default; recommended policy option defaults to `32` for generated server challenges.
- Base64url strictness: reject padding, whitespace, and non-canonical alphabet; no silent normalization.
- Origin checks in `validateWebauthnClientData`: require HTTPS origin by default; loopback HTTP exceptions only via explicit opt-in.
- RP ID checks: reject scheme/path/port-bearing values; enforce lower-case DNS label syntax; no implicit host fallback.
- COSE algorithms: default allowlist is explicit (`-7`, `-257`, `-8`); unknown algorithms rejected unless caller passes override list.
- User presence/verification: validator defaults require UP=true for assertion contexts; UV requirement remains opt-in but explicit.
- Signature counter policy: default to "strict-if-known" (if both previous and current counters are non-zero, require monotonic increase; zero remains "indeterminate", not silently "valid").

## 6) Node-runtime test plan (deterministic, offline)

- `test/webauthn-base64url.test.ts`
  - RFC 4648 Section 5 canonical encode/decode and malformed-input rejection.
- `test/webauthn-options.test.ts`
  - WebAuthn parse-from-JSON aligned field decoding and policy validation failures.
- `test/webauthn-client-data.test.ts`
  - UTF-8/JSON parse handling, required members, and challenge/origin/type mismatch cases.
- `test/webauthn-authenticator-data.test.ts`
  - Minimum length, flag extraction, AT/ED truncation failures, RP ID hash comparison helper behavior, signCount policy behavior.

Test constraints:

- No browser globals (`navigator.credentials`, `PublicKeyCredential`) in tests.
- Use fixed binary fixtures (`Uint8Array` literals/hex) and deterministic expected outputs.
- Add section-cited comments for each normative case.

## 7) Execution order (repo-aware)

1. Add WebAuthn types to `src/types/auth.ts`.
2. Implement `src/auth/webauthn-base64url.ts` and `src/auth/webauthn-cose.ts`.
3. Implement `src/auth/webauthn-options.ts`.
4. Implement `src/auth/webauthn-client-data.ts`.
5. Implement `src/auth/webauthn-authenticator-data.ts`.
6. Add `src/auth/webauthn.ts` facade and wire exports in `src/auth/index.ts` and `src/index.ts`.
7. Add WebAuthn test files.
8. Update `README.md`, `docs/reference/imports-by-task.md`, `docs/src/lib/rfc-map.ts`, and `.changeset/*.md`.
9. Run all quality gates and fix failures.

## 8) Required quality-gate commands

Run exactly:

```bash
pnpm check:structure
pnpm typecheck:all
pnpm typecheck:strict
pnpm typecheck:lib
pnpm test
pnpm test:coverage:check
pnpm api:extract
pnpm semver:check
pnpm build
```

## 9) Risks, mitigations, and acceptance criteria

### Top risks and mitigations

1. L3 churn in parse-from-JSON behavior.
   - Mitigation: pin exact anchors above and gate behavior through tests with section citations.
2. `authenticatorData` parsing mistakes around AT/ED boundaries.
   - Mitigation: strict minimum-length and truncation checks; no CBOR semantics in v1.
3. Security drift from permissive defaults.
   - Mitigation: conservative defaults for challenge/origin/UP/alg and explicit options for relaxations.
4. API sprawl and semver instability.
   - Mitigation: keep WebAuthn exports under `src/auth/*`, run `pnpm api:extract` + `pnpm semver:check`, and document non-goals.

### Acceptance criteria

- New WebAuthn utilities are implemented under `src/auth/*` and exported via `src/auth/index.ts` and `src/index.ts`.
- Parser/formatter/validator contracts follow repo conventions exactly.
- Tests are deterministic/offline and include normative section references.
- `README.md`, `docs/reference/imports-by-task.md`, `docs/src/lib/rfc-map.ts`, and `.changeset/*.md` are updated.
- All quality-gate commands pass with no skipped steps.

## Plan Review Delta

- Re-scoped v1 to a realistic single-pass implementation by deferring related-origins and full attestation/CBOR features.
- Aligned module/type placement with this repo's auth facades (`src/auth/*`, `src/types/auth.ts`) to reduce structure and semver risk.
- Added missing repo-specific doc/update steps (`docs/reference/imports-by-task.md`) and explicit export wiring.
- Made security defaults concrete and conservative (challenge length, HTTPS origin default, COSE allowlist, UP/signCount policy).
- Tightened Node testability guidance to avoid browser-only globals and keep fixtures deterministic.
