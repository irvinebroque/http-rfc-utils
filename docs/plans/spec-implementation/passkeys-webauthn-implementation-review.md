# WebAuthn v1 Security and Spec-Compliance Review

Date: 2026-02-11

## Scope and method

- Reviewed implementation and tests for:
  - `src/auth/webauthn-base64url.ts`
  - `src/auth/webauthn-cose.ts`
  - `src/auth/webauthn-options.ts`
  - `src/auth/webauthn-client-data.ts`
  - `src/auth/webauthn-authenticator-data.ts`
  - related exports/types/docs/tests in `src/auth/webauthn.ts`, `src/auth/index.ts`, `src/auth.ts`, `src/index.ts`, `src/types/auth.ts`, `README.md`, `docs/src/lib/rfc-map.ts`, `docs/reference/imports-by-task.md`, and `test/webauthn-*.test.ts`.
- Checked behavior against pinned normative sections in `docs/plans/spec-implementation/passkeys-webauthn-implementation-plan.md`.
- Ran focused tests and targeted runtime probes for security-sensitive paths.

## Commands run

- `pnpm exec tsx --test test/webauthn-*.test.ts` -> 19/19 passing.
- Targeted probes executed with `pnpm exec tsx -e ...` to confirm edge-case behavior called out below.

## Compliance overview against pinned sections

### RFC 4648 Section 5 + WebAuthn parse-from-JSON sections

- `src/auth/webauthn-base64url.ts` correctly enforces URL-safe alphabet, no padding, no whitespace, and canonical re-encoding checks.
- `src/auth/webauthn-options.ts` decodes required base64url members (`challenge`, `user.id`, descriptor IDs) and keeps parser-vs-validator contract consistent.

### WebAuthn clientDataJSON verification and origin validation sections

- `src/auth/webauthn-client-data.ts` validates required members and supports expected type/challenge/origin checks.
- HTTPS-by-default origin policy exists, with explicit loopback opt-in.
- Gap: formatter path intentionally bypasses HTTPS requirement (see Finding L-01).

### WebAuthn authenticatorData, attestedCredentialData, sign counter sections

- `src/auth/webauthn-authenticator-data.ts` correctly enforces minimum length, parses core fields, and applies strict-if-known counter policy.
- Multiple structural-validation gaps exist in AT/ED CBOR handling and in flags consistency checks (see Findings H-01, H-02, M-01).

### RFC 9053 Section 2 COSE algorithm handling

- Default allowlist behavior is conservative and validator supports explicit override lists.
- Gap: exported default allowlist is runtime-mutable (see Finding M-02).

## Findings

### H-01: Validator trusts `flags` object without enforcing consistency with `flagsByte`

- Severity: **high**
- Why it matters:
  - Security policy checks (UP/UV/AT/ED) are evaluated from `value.flags`, not from `value.flagsByte`.
  - A caller validating untrusted/deserialized objects (instead of parser output) can supply contradictory values and bypass intended checks.
- Evidence:
  - `src/auth/webauthn-authenticator-data.ts:39` parses `flagsByte`, but `validateWebauthnAuthenticatorData` only type-checks `flagsByte` at `src/auth/webauthn-authenticator-data.ts:139` and then trusts `value.flags` at `src/auth/webauthn-authenticator-data.ts:157`, `src/auth/webauthn-authenticator-data.ts:163`, `src/auth/webauthn-authenticator-data.ts:173`, `src/auth/webauthn-authenticator-data.ts:182`.
  - Probe: object with `flagsByte: 0x00` and `flags.userPresent: true` passes validation (`PASS`).
- Remediation:
  - Recompute flags from `flagsByte` inside validator and require exact match with provided `flags` (or ignore provided `flags` entirely and derive effective flags from `flagsByte`).
  - Add explicit mismatch error (e.g., `flagsByte/flags inconsistent`).
  - Add tests for contradictory `flagsByte` vs `flags` combinations.

### H-02: `authenticatorData` parser accepts structurally wrong CBOR for `credentialPublicKey` and extensions

- Severity: **high**
- Why it matters:
  - WebAuthn attested credential data expects `credentialPublicKey` to be a CBOR map (COSE_Key), not arbitrary CBOR items.
  - Extension data field is also expected to be a CBOR map of extension outputs.
  - Accepting arbitrary CBOR types increases confusion and weakens spec-aligned validation guarantees.
- Evidence:
  - `src/auth/webauthn-authenticator-data.ts:69` and `src/auth/webauthn-authenticator-data.ts:89` use `readCborItemEnd(...)` without constraining major type.
  - Probe: AT payload with `credentialPublicKey` as CBOR integer `0x01` parses (`PARSED 1`).
  - Probe: ED payload with extension bytes `0x01` parses (`PARSED 1`).
- Remediation:
  - Add dedicated helpers that require a CBOR map item at those offsets.
  - Keep out-of-scope CBOR semantic decoding, but enforce top-level item class (`major type 5`) for `credentialPublicKey` and `extensions`.
  - Add tests rejecting non-map CBOR for AT credential key and ED extensions.

### M-01: CBOR boundary parser accepts invalid additional-info encoding (`0x1f`) for major types where indefinite form is forbidden

- Severity: **medium**
- Why it matters:
  - Invalid CBOR can be accepted as structurally valid, reducing parser strictness and complicating downstream assumptions.
- Evidence:
  - `readCborLengthArgument` allows `additionalInfo === 31` generically at `src/auth/webauthn-authenticator-data.ts:375`.
  - `readCborItemEnd` then accepts major types 0/1 with this header path at `src/auth/webauthn-authenticator-data.ts:255`.
  - Probe: AT credential key byte `0x1f` accepted (`PARSED`).
- Remediation:
  - Reject indefinite-length marker (`31`) for major types 0, 1, and 6, and for simple/floating forms where not valid.
  - Add invalid-CBOR test vectors covering forbidden `additionalInfo` combinations.

### M-02: Default COSE allowlist export is mutable at runtime

- Severity: **medium**
- Why it matters:
  - `WEBAUTHN_COSE_ALGORITHM_IDS` is typed `readonly` in TS but not immutable at runtime.
  - JS/unsafe TS callers can mutate process-global defaults and silently weaken policy.
- Evidence:
  - Export assignment at `src/auth/webauthn-cose.ts:10` points to mutable array.
  - Probe: `(WEBAUTHN_COSE_ALGORITHM_IDS as number[]).push(-999); validateWebauthnCoseAlgorithm(-999)` succeeds (`PASS`).
- Remediation:
  - Freeze the exported array (`Object.freeze([...])`) and/or return a cloned default each call.
  - Add test asserting mutation attempt does not change accepted defaults.

### M-03: RP ID validation allows IPv4-style host literals

- Severity: **medium**
- Why it matters:
  - WebAuthn RP ID semantics are domain-oriented and origin-bound; broad host-label regex acceptance can admit values not intended for production RP IDs.
  - This is an over-permissive default for a security-sensitive validator.
- Evidence:
  - `validateRpId` in `src/auth/webauthn-options.ts:634` and `src/auth/webauthn-authenticator-data.ts:476` only enforces lowercase host-label syntax.
  - Probe: `validateWebauthnRequestOptions({ challenge: Uint8Array(16), rpId: '127.0.0.1' })` succeeds (`PASS`).
- Remediation:
  - Tighten RP ID policy: reject IP literals by default; allow explicit opt-in if needed for local testing.
  - Consider centralizing RP ID validation logic to avoid drift between modules.

### L-01: `formatWebauthnClientDataJson` disables HTTPS validation by default

- Severity: **low**
- Why it matters:
  - Function naming implies safe formatting of semantically valid clientData, but formatter currently permits insecure origins by calling validator with `requireHttpsOrigin: false`.
  - This can mislead callers expecting formatter strictness to match validator defaults.
- Evidence:
  - `formatWebauthnClientDataJson` sets `requireHttpsOrigin: false` at `src/auth/webauthn-client-data.ts:76`.
  - Probe formats `{ origin: 'http://evil.example' }` without error.
- Remediation:
  - Align formatter defaults with validator defaults, or rename/add explicit relaxed formatter option.
  - Document the behavior prominently if retained.

### L-02: Test suite misses key adversarial/mismatch cases in security-critical modules

- Severity: **low**
- Why it matters:
  - Current tests pass but do not cover identified bypass/permissiveness gaps.
- Evidence:
  - `test/webauthn-authenticator-data.test.ts` has no flagsByte-vs-flags mismatch tests and no non-map/invalid-CBOR rejection cases.
  - `test/webauthn-cose` behavior is covered indirectly through options tests, but no mutation-hardening test exists.
- Remediation:
  - Add explicit negative tests for each remediation above.
  - Include section-cited comments for strict CBOR structure and flags consistency invariants.

## Recommended remediation order

1. **H-01** (`flagsByte`/`flags` consistency) - closes a direct policy-bypass path.
2. **H-02** (CBOR type constraints for credential key/extensions) - restores core authenticatorData structural guarantees.
3. **M-01** (invalid CBOR acceptance) - tightens parser correctness and hardens boundary checks.
4. **M-02** (mutable COSE defaults) - prevents silent policy drift at runtime.
5. **M-03** (RP ID over-permissiveness) - align default RP ID policy with stricter security posture.
6. **L-01/L-02** (API semantics + tests) - reduce misuse risk and lock in fixes.

## Notes

- Parser/formatter/validator split is mostly consistent with repo conventions and the v1 plan.
- No code changes were made in this review step.
