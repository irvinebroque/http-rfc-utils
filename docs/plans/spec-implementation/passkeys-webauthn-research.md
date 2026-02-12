# Passkeys/WebAuthn Research for `http-rfc-utils`

## Purpose and framing

This document evaluates passkeys-related standards (starting from passkeys.dev specs references) and identifies what is suitable for this repository as **protocol-driven TypeScript core logic** (parse/format/validate, deterministic, no UI).

Repository fit reminder:

- `http-rfc-utils` is RFC/standards-focused utility code, with parse/format/validate APIs.
- Good fit: deterministic encoders/decoders, strict validators, structured data parsing.
- Poor fit: end-to-end auth orchestration, browser UI flows, device transport stacks, PKI ops infrastructure.

---

## Research starting point and canonical chain followed

Started from:

- passkeys.dev specs reference: <https://passkeys.dev/docs/reference/specs/>

Canonical specs linked there:

- W3C WebAuthn Level 2 (current stable): <https://www.w3.org/TR/webauthn-2/>
- W3C WebAuthn Level 3 (next/currently evolving): <https://www.w3.org/TR/webauthn-3/>
- FIDO CTAP 2.2: <https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html>

Related canonical dependencies surfaced while tracing normative requirements:

- RFC 4648 (base64url): <https://www.rfc-editor.org/rfc/rfc4648.html#section-5>
- RFC 8949 (CBOR): <https://www.rfc-editor.org/rfc/rfc8949.html#section-3>
- RFC 9052 (COSE structures/process): <https://www.rfc-editor.org/rfc/rfc9052.html#section-7>
- RFC 9053 (COSE algorithm identifiers): <https://www.rfc-editor.org/rfc/rfc9053.html#section-2>
- RFC 5280 (X.509 profile/path validation): <https://www.rfc-editor.org/rfc/rfc5280.html#section-6>
- RFC 8615 (`/.well-known/` conventions): <https://www.rfc-editor.org/rfc/rfc8615.html#section-3>

Attestation trust metadata (adjacent but practically important):

- FIDO Metadata Service v3.1: <https://fidoalliance.org/specs/mds/fido-metadata-service-v3.1-ps-20250521.html>
- FIDO Metadata Statement v3.1: <https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.1-ps-20250521.html>

Also reviewed passkeys.dev advanced pages for practical L3 features:

- Related Origin Requests: <https://passkeys.dev/docs/advanced/related-origins/>
- Client Hints: <https://passkeys.dev/docs/advanced/client-hints/>

---

## Spec landscape and dependency map

## 1) Core passkeys stack

1. **WebAuthn (W3C)**
   - Defines browser/RP data model and RP verification ceremonies.
   - RP normative ops: registration and assertion verification.
   - Key sections:
     - RP ops: <https://www.w3.org/TR/webauthn-3/#sctn-rp-operations>
     - Register flow: <https://www.w3.org/TR/webauthn-3/#sctn-registering-a-new-credential>
     - Assertion verification: <https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion>
     - Authenticator data model: <https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data>
     - ClientDataJSON verification: <https://www.w3.org/TR/webauthn-3/#clientdatajson-verification>

2. **CTAP (FIDO)**
   - Authenticator protocol and transport framing (USB/NFC/BLE/hybrid), authenticator command model.
   - Mostly platform/authenticator implementation concern, not RP app concern.
   - Key sections:
     - Protocol overview: <https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#CTAP2ProtocolOverview>
     - Authenticator API: <https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#authenticator-api>
     - Message encoding: <https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#message-encoding>

## 2) Data encoding/crypto substrate used by WebAuthn

- **Base64url** for JSON-safe binary representation (challenge, IDs, etc.).
- **CBOR** for attestation object and credential public key payloads.
- **COSE** key representations + algorithm IDs.
- **X.509** path semantics for attestation certificate chains.

## 3) Emerging passkey features from WebAuthn L3

- `parseCreationOptionsFromJSON` and `parseRequestOptionsFromJSON` APIs:
  - <https://www.w3.org/TR/webauthn-3/#sctn-parseCreationOptionsFromJSON>
  - <https://www.w3.org/TR/webauthn-3/#sctn-parseRequestOptionsFromJSON>
- Client capabilities and hints:
  - Capabilities enum: <https://www.w3.org/TR/webauthn-3/#enum-clientCapability>
  - Hints enum: <https://www.w3.org/TR/webauthn-3/#enum-hints>
- Related origins and well-known endpoint:
  - Related origins model: <https://www.w3.org/TR/webauthn-3/#sctn-related-origins>
  - Validation: <https://www.w3.org/TR/webauthn-3/#sctn-validating-relation-origin>
  - Well-known registration context: <https://www.w3.org/TR/webauthn-3/#well-known-uri-registration>

---

## Candidate features for this repository

The list below separates **server**, **client**, and **shared** logic. Each candidate is evaluated for repository fit.

### Server-side candidates

1. **WebAuthn response parsing primitives (high fit)**
   - Parse `clientDataJSON` bytes to typed object and validate required members (`type`, `challenge`, `origin`, optional `crossOrigin`, `topOrigin`).
   - Parse `authenticatorData` binary into structured fields (`rpIdHash`, flags, signCount, optional attestedCredentialData/extensions).
   - References:
     - <https://www.w3.org/TR/webauthn-3/#dictionary-client-data>
     - <https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data>
     - <https://www.w3.org/TR/webauthn-3/#sctn-attested-credential-data>
   - Recommended API style:
     - `parseWebauthnClientDataJson(...)`
     - `parseWebauthnAuthenticatorData(...)`
     - `validateWebauthnAuthenticatorData(...)`

2. **Ceremony input/response validators (high fit)**
   - Deterministic validators for RP-provided options and returned structures.
   - Strong checks: challenge shape/length, RP ID syntactic validity, allow/exclude credential descriptor shape, COSE alg whitelist enforcement.
   - References:
     - <https://www.w3.org/TR/webauthn-3/#dictionary-makecredentialoptions>
     - <https://www.w3.org/TR/webauthn-3/#dictionary-assertion-options>
     - <https://www.w3.org/TR/webauthn-3/#sctn-alg-identifier>

3. **Attestation object envelope parser (medium-high fit)**
   - Parse top-level CBOR structure (`fmt`, `attStmt`, `authData`) with strict shape validation.
   - Optionally parse selected attestation formats at structural level only.
   - References:
     - <https://www.w3.org/TR/webauthn-3/#sctn-attestation>
     - <https://www.w3.org/TR/webauthn-3/#sctn-defined-attestation-formats>

4. **Related origins (`/.well-known/webauthn`) parser/validator (high fit, fast win)**
   - Parse and validate ROR document (`{ origins: [...] }`) with strict origin syntax and constraints.
   - Validate origin list against RP ID and label-count constraints as policy helpers.
   - References:
     - <https://www.w3.org/TR/webauthn-3/#sctn-related-origins>
     - <https://www.w3.org/TR/webauthn-3/#sctn-validating-relation-origin>
     - <https://www.rfc-editor.org/rfc/rfc8615.html#section-3>

5. **MDS BLOB parsing/validation helpers (medium fit, later phase)**
   - Parse JWS-ish BLOB envelope and payload shape for relying-party policy use.
   - Structural validation for status reports and metadata entry keys.
   - References:
     - <https://fidoalliance.org/specs/mds/fido-metadata-service-v3.1-ps-20250521.html#sctn-mds-blob>
     - <https://fidoalliance.org/specs/mds/fido-metadata-service-v3.1-ps-20250521.html#sctn-mds-blob-proc-rules>

### Client-side candidates (no UI; TypeScript core only)

1. **JSON option codec helpers for browser APIs (high fit)**
   - Convert server JSON payloads with base64url fields into binary (`Uint8Array`) forms expected by `navigator.credentials.*`.
   - Inverse conversion for payload transport back to server.
   - Align with WebAuthn L3 parse-from-JSON semantics for compatibility.
   - References:
     - <https://www.w3.org/TR/webauthn-3/#sctn-parseCreationOptionsFromJSON>
     - <https://www.w3.org/TR/webauthn-3/#sctn-parseRequestOptionsFromJSON>
     - <https://www.rfc-editor.org/rfc/rfc4648.html#section-5>

2. **Client hints enum/validation helpers (medium fit)**
   - Validate supported hint tokens and normalize hints arrays for option generation.
   - References:
     - <https://www.w3.org/TR/webauthn-3/#enum-hints>
     - <https://passkeys.dev/docs/advanced/client-hints/>

3. **Client capability response parsing (medium fit)**
   - Parse and validate output of `PublicKeyCredential.getClientCapabilities()` for feature gating in app logic.
   - Reference: <https://www.w3.org/TR/webauthn-3/#sctn-getClientCapabilities>

### Shared (server + client) candidates

1. **Base64url strict codec (very high fit)**
   - Strict no-padding and URL-safe alphabet handling, deterministic output.
   - Likely reusable across existing modules in this repo.

2. **COSE alg/key registry mappers (high fit)**
   - Typed enum/value maps and validation for supported COSE alg IDs and key types used by WebAuthn.
   - References:
     - <https://www.w3.org/TR/webauthn-3/#sctn-alg-identifier>
     - <https://www.rfc-editor.org/rfc/rfc9052.html#section-7>
     - <https://www.rfc-editor.org/rfc/rfc9053.html#section-2>

3. **WebAuthn extension input/output shape validators (medium fit)**
   - Parse/validate common extension dictionaries (e.g., `credProps`, `prf`, `largeBlob`) at data-contract level.
   - References:
     - <https://www.w3.org/TR/webauthn-3/#sctn-extensions-inputs-outputs>
     - <https://www.w3.org/TR/webauthn-3/#sctn-authenticator-credential-properties-extension>
     - <https://www.w3.org/TR/webauthn-3/#prf-extension>

---

## Repo fit: feasible scope vs out-of-scope

### Feasible for `http-rfc-utils`

- Deterministic data codecs and shape validators.
- Binary structure parsers (authenticator data, attestation envelope).
- Policy helper validators (RP ID/origin relation checks, related-origins well-known document).
- Spec-linked typed constants and enum validation.

### Not a fit (or only via very narrow wrappers)

- Full WebAuthn ceremony orchestration and session state management.
- Browser API invocation wrappers that imply flow control/UI prompts.
- CTAP transports or authenticator command execution (`USB/NFC/BLE`, PIN/UV protocol state).
- Full PKIX path building/revocation and attestation trust-store lifecycle management.
- FIDO conformance test harnesses and device certification workflows.

---

## Security and compliance implications

1. **Challenge and origin validation is non-negotiable**
   - Incorrect challenge binding and origin/rpId verification undermines phishing resistance.
   - References:
     - <https://www.w3.org/TR/webauthn-3/#sctn-cryptographic-challenges>
     - <https://www.w3.org/TR/webauthn-3/#sctn-validating-origin>

2. **Attestation handling has privacy + trust policy tradeoffs**
   - Accepting attestation data can increase device-identifiability/privacy exposure.
   - Reference: <https://www.w3.org/TR/webauthn-3/#sctn-attestation-limitations>

3. **Algorithm agility and whitelisting are required**
   - Accepting unknown/weak COSE algs introduces downgrade and verification inconsistencies.

4. **Counter semantics must be implemented defensively**
   - Signature counter behavior differs across authenticators and backup scenarios.
   - Reference: <https://www.w3.org/TR/webauthn-3/#sctn-sign-counter>

5. **MDS consumption requires supply-chain trust and update policy**
   - Need robust signature verification, cache freshness policy, and failure behavior for unavailable metadata.

6. **Related origins increases deployment complexity**
   - Incorrect ROR docs can cause authentication failures or broaden trust unintentionally.

---

## Complexity and risk ranking

| Candidate | Complexity | Security risk if wrong | Standards churn risk | Overall recommendation |
|---|---:|---:|---:|---|
| Base64url strict codec | Low | Medium | Low | MVP |
| WebAuthn JSON option codec (to/from binary) | Low-Med | Medium | Medium (L3) | MVP |
| Related-origins well-known parser/validator | Low-Med | Medium | Medium (L3 rollout) | MVP |
| ClientDataJSON parser + verifier helpers | Medium | High | Low-Med | MVP |
| Authenticator data binary parser | Medium | High | Low | MVP |
| COSE alg/key typed registry helpers | Medium | High | Low | MVP |
| Attestation object envelope parser | Medium | High | Low | Phase 2 |
| Extension-specific validators (`credProps`/`prf`/`largeBlob`) | Medium | Medium | Medium-High | Phase 2 |
| MDS BLOB parser + status processing | High | High | Medium | Phase 3 |
| Full attestation cert path + revocation validation | Very High | Very High | Medium | Out-of-scope for this repo core |
| CTAP transport/protocol implementation | Very High | High | Medium | Out-of-scope |

---

## Recommended phased scope

## Phase 0 (MVP: best fit for this repo)

Focus on pure parse/format/validate building blocks with deterministic behavior and no network/device/UI coupling.

1. Shared base64url strict codec utilities.
2. WebAuthn options JSON<->binary codec helpers.
3. ClientDataJSON parser + limited verifier checks.
4. Authenticator data parser (flags/signCount/attested data envelope).
5. Related-origins well-known parser/validator.
6. COSE algorithm and key-type validation constants.

Expected value: immediate interoperability support for apps using existing crypto libraries, with low operational burden.

## Phase 1 (incremental protocol depth)

1. Attestation envelope parser with structural checks for common formats.
2. Extension payload validators (`credProps`, `prf`, selected others).
3. More explicit RP policy helpers (UV/UP expectations, allow/exclude descriptor quality checks).

Expected value: stronger correctness surface without becoming a full auth stack.

## Phase 2 (optional advanced policy tooling)

1. MDS BLOB parsing + status interpretation utilities.
2. Optional adapters/hooks for external crypto and trust-store engines.

Expected value: enterprise policy use-cases, but keep trust/PKI heavy lifting outside this repo.

---

## Explicit non-goals

- Any UI, UX flow, prompts, browser presentation, or native passkey UI behavior.
- Wrapping `navigator.credentials.create/get` with interactive orchestration.
- Implementing CTAP command execution, BLE/NFC/USB framing, or authenticator state machines.
- Shipping a full attestation trust service (root distribution, revocation fetching, policy DB operations).
- Owning account/session/business-auth logic (challenge issuance, replay windows, account linking).
- Federation protocol orchestration (OIDC, SAML) beyond data-level helpers.

---

## Implementation-shape guidance for this repo (if pursued)

- Keep module naming consistent with repository conventions: `parseX` / `formatX` / `validateX`.
- Parser behavior: return `null` on syntax-invalid input.
- Validator/formatter behavior: throw `Error` for semantic-invalid input.
- Favor small composable primitives over one monolithic `verifyWebauthnResponse` function.
- Keep cryptographic operations pluggable (accept verifier callback or key object abstraction), not hardwired to one runtime.

---

## Evidence links and references

Primary passkeys specs:

- passkeys.dev specs index: <https://passkeys.dev/docs/reference/specs/>
- WebAuthn L2: <https://www.w3.org/TR/webauthn-2/>
- WebAuthn L3: <https://www.w3.org/TR/webauthn-3/>
- CTAP 2.2: <https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html>

WebAuthn sections used heavily in scope decisions:

- RP operations: <https://www.w3.org/TR/webauthn-3/#sctn-rp-operations>
- Registering credential: <https://www.w3.org/TR/webauthn-3/#sctn-registering-a-new-credential>
- Verifying assertion: <https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion>
- Authenticator data: <https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data>
- Attested credential data: <https://www.w3.org/TR/webauthn-3/#sctn-attested-credential-data>
- CollectedClientData + limited verification: <https://www.w3.org/TR/webauthn-3/#dictionary-client-data>, <https://www.w3.org/TR/webauthn-3/#clientdatajson-verification>
- Parse from JSON methods: <https://www.w3.org/TR/webauthn-3/#sctn-parseCreationOptionsFromJSON>, <https://www.w3.org/TR/webauthn-3/#sctn-parseRequestOptionsFromJSON>
- Client capabilities/hints: <https://www.w3.org/TR/webauthn-3/#enum-clientCapability>, <https://www.w3.org/TR/webauthn-3/#enum-hints>
- Related origins and validation: <https://www.w3.org/TR/webauthn-3/#sctn-related-origins>, <https://www.w3.org/TR/webauthn-3/#sctn-validating-relation-origin>
- Well-known URI registration in WebAuthn: <https://www.w3.org/TR/webauthn-3/#well-known-uri-registration>
- Security considerations (RP): <https://www.w3.org/TR/webauthn-3/#sctn-security-considerations-rp>

CTAP sections used in out-of-scope boundaries:

- Authenticator API: <https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#authenticator-api>
- Message encoding: <https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#message-encoding>
- Transport bindings: <https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#transport-specific-bindings>

Encoding/crypto dependencies:

- RFC 4648 base64url: <https://www.rfc-editor.org/rfc/rfc4648.html#section-5>
- RFC 8949 CBOR encoding: <https://www.rfc-editor.org/rfc/rfc8949.html#section-3>
- RFC 9052 COSE key structure: <https://www.rfc-editor.org/rfc/rfc9052.html#section-7>
- RFC 9053 COSE alg IDs: <https://www.rfc-editor.org/rfc/rfc9053.html#section-2>
- RFC 5280 cert path validation: <https://www.rfc-editor.org/rfc/rfc5280.html#section-6>
- RFC 8615 `/.well-known/`: <https://www.rfc-editor.org/rfc/rfc8615.html#section-3>

Attestation metadata ecosystem:

- FIDO Metadata Service v3.1: <https://fidoalliance.org/specs/mds/fido-metadata-service-v3.1-ps-20250521.html>
- FIDO Metadata Statement v3.1: <https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.1-ps-20250521.html>

passkeys.dev advanced implementation notes reviewed:

- Client Hints: <https://passkeys.dev/docs/advanced/client-hints/>
- Related Origin Requests: <https://passkeys.dev/docs/advanced/related-origins/>
