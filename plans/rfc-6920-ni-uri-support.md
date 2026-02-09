## Summary
Add RFC 6920 Named Information (`ni`) URI support as a first-class module, including parser/formatter utilities, digest-based comparison semantics, and `.well-known/ni` mapping helpers.

## RFC Scope (sections + anchors)
- In scope: hash-based name equivalence rules ([RFC 6920 §2](https://www.rfc-editor.org/rfc/rfc6920.html#section-2)).
- In scope: `ni` URI syntax, parsing, and formatting ([RFC 6920 §3](https://www.rfc-editor.org/rfc/rfc6920.html#section-3)).
- In scope: `ct=` query attribute parsing ([RFC 6920 §3.1](https://www.rfc-editor.org/rfc/rfc6920.html#section-3.1)).
- In scope: `.well-known/ni` HTTP(S) mapping utilities ([RFC 6920 §4](https://www.rfc-editor.org/rfc/rfc6920.html#section-4)).
- In scope: reusable `alg;val` URL segment helpers ([RFC 6920 §5](https://www.rfc-editor.org/rfc/rfc6920.html#section-5)).
- In scope: initial algorithm support seeded from registry guidance, with `sha-256` mandatory ([RFC 6920 §2](https://www.rfc-editor.org/rfc/rfc6920.html#section-2), [RFC 6920 §9.4](https://www.rfc-editor.org/rfc/rfc6920.html#section-9.4)).
- Out of scope (phase 1): binary format (`Suite ID` encoding) and `nih` human-speakable URIs ([RFC 6920 §6](https://www.rfc-editor.org/rfc/rfc6920.html#section-6), [RFC 6920 §7](https://www.rfc-editor.org/rfc/rfc6920.html#section-7)).

## ABNF + Normative Requirements
- Implement `NI-URI = ni-scheme ":" ni-hier-part [ "?" query ]` and `alg-val = alg ";" val` parsing/formatting ([RFC 6920 §3](https://www.rfc-editor.org/rfc/rfc6920.html#section-3)).
- Enforce base64url digest encoding with no `=` padding in `val` ([RFC 6920 §3](https://www.rfc-editor.org/rfc/rfc6920.html#section-3)).
- Compare names using algorithm + decoded digest length/value only; ignore authority and parameters when testing identity ([RFC 6920 §2](https://www.rfc-editor.org/rfc/rfc6920.html#section-2)).
- Require `sha-256` support and optionally support additional/truncated suites from the NI hash registry ([RFC 6920 §2](https://www.rfc-editor.org/rfc/rfc6920.html#section-2), [RFC 6920 §9.4](https://www.rfc-editor.org/rfc/rfc6920.html#section-9.4)).
- Parse `ct=` query attribute name (value handling is protocol-specific) ([RFC 6920 §3.1](https://www.rfc-editor.org/rfc/rfc6920.html#section-3.1)).
- Treat malformed or non-conforming names as non-matching ([RFC 6920 §10](https://www.rfc-editor.org/rfc/rfc6920.html#section-10)).

## Proposed Module/Exports/Types
- Add `src/ni.ts`:
  - `parseNiUri`
  - `formatNiUri`
  - `compareNiUris`
  - `parseNiUrlSegment`
  - `formatNiUrlSegment`
  - `toWellKnownNiUrl`
  - `fromWellKnownNiUrl`
  - `computeNiDigest`
  - `verifyNiDigest`
- Add NI-related types in `src/types/shared.ts` (for example `NiUri`, `NiHashAlgorithm`, `NiQueryParams`, `NiComparisonResult`).
- Re-export new functions/types in `src/index.ts` and `src/types.ts`.

## Implementation Notes (edge cases, precedence, permissive vs strict)
- Reuse existing digest primitives from `src/digest.ts` for hash computation/verification to avoid duplicate crypto logic.
- Reuse URI percent-encoding/decoding helpers from `src/uri.ts` for query handling and normalization boundaries.
- Keep algorithm token handling aligned with registry names (for example `sha-256`), and document non-goals around legacy example variants.
- Keep `compareNiUris` strict about digest length (full vs truncated hashes are not equivalent).
- Provide explicit options for `.well-known` mapping scheme selection (`http` vs `https`) instead of implicit assumptions.

## Tests (with RFC section citations)
- Add `test/ni.test.ts` with RFC-cited cases:
  - Parse/format RFC examples with and without authority ([RFC 6920 §8.1](https://www.rfc-editor.org/rfc/rfc6920.html#section-8.1)).
  - Name equivalence ignores authority/query and compares algorithm+bytes only ([RFC 6920 §2](https://www.rfc-editor.org/rfc/rfc6920.html#section-2)).
  - Reject padded/invalid base64url digest values ([RFC 6920 §3](https://www.rfc-editor.org/rfc/rfc6920.html#section-3)).
  - Parse `ct=` query parameter names ([RFC 6920 §3.1](https://www.rfc-editor.org/rfc/rfc6920.html#section-3.1)).
  - Validate `.well-known/ni` mapping and reverse mapping behavior ([RFC 6920 §4](https://www.rfc-editor.org/rfc/rfc6920.html#section-4)).
  - Validate non-conforming inputs do not match valid names ([RFC 6920 §10](https://www.rfc-editor.org/rfc/rfc6920.html#section-10)).

## Docs + Audit Updates
- Update `README.md` Supported RFCs to include RFC 6920.
- Update README RFC map and import tables for NI module exports.
- Update `docs/src/lib/rfc-map.ts` for new RFC/module coverage.
- Create/update `AUDIT.md` with RFC 6920 scope, explicit out-of-scope notes, and algorithm support decisions.
- Document that this plan intentionally treats RFC 6920 as in scope.

## Risks/Decisions
- Risk: confusion between RFC 6920 (Named Information) and RFC 6902 (JSON Patch).
- Risk: algorithm registry growth can widen maintenance burden if implemented too broadly in v1.
- Decision: phase 1 covers `ni` URI + `.well-known` mapping + digest comparison; defer binary/`nih` forms.

## Execution Checklist
- [ ] Add `src/ni.ts` with parse/format/compare and mapping helpers.
- [ ] Add NI types and re-exports.
- [ ] Add RFC-cited tests in `test/ni.test.ts`.
- [ ] Update README/docs/audit coverage tables.
- [ ] Run `pnpm test`.
