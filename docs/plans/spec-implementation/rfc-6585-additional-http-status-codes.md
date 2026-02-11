# RFC 6585 Implementation Plan: Additional HTTP Status Codes

- Spec: https://www.rfc-editor.org/rfc/rfc6585.html
- Scope type: status/header helpers for 428/429/431/511
- Repo fit: practical API and edge runtime response utilities

## 1) Scope and Non-Goals

- In scope (sections 3-6):
  - `428 Precondition Required`
  - `429 Too Many Requests`
  - `431 Request Header Fields Too Large`
  - `511 Network Authentication Required`
  - Cache requirement support (`MUST NOT be stored`) through deterministic helper output.
  - Optional `Retry-After` support for 429 using existing repo `Retry-After` helpers.
- Non-goals:
  - Runtime rate-limiting policy, authentication portal workflow, or gateway internals.
  - Generic status framework beyond RFC 6585’s four codes.

## 2) Proposed Module/Files and Public Exports

- New module: `src/additional-status.ts`
- Type additions: `src/types/status.ts`
- Public exports from `src/index.ts`:
  - `Rfc6585StatusCode` (`428 | 429 | 431 | 511`)
  - `parseRfc6585StatusCode`
  - `formatRfc6585StatusCode`
  - `validateRfc6585StatusCode`
  - `getRfc6585StatusInfo`
  - `formatRfc6585Headers`
- Type facade wiring in `src/types/shared.ts`
- Tests: `test/additional-status.test.ts`

## 3) Data Model and Helper Behavior

- Parser contract (tolerant):
  - Accept `number|string` inputs.
  - Return typed code for known values or `null` for unknown/invalid syntax.
- Formatter/validator contract (strict):
  - Throw on semantic-invalid status values.
- Header helper contract:
  - Always emit `Cache-Control: no-store` for all four status codes.
  - For `429`, optional `retryAfter` emits `Retry-After` using shared formatter.
  - Reject `retryAfter` for non-429 statuses.
- Diagnostics model:
  - Optional structured metadata support, but no mandatory body/header policy beyond RFC requirements.

## 4) Test Matrix (RFC-Mapped)

- Section 3 (`428`): parse/format/validate and no-store headers.
- Section 4 (`429`): parse/format/validate, no-store, `Retry-After` seconds/date variants.
- Section 5 (`431`): parse/format/validate and no-store headers.
- Section 6 (`511`): parse/format/validate and no-store headers.
- Negative cases:
  - Unknown codes return `null` in parser.
  - Strict helpers throw on invalid codes/options.
- Round-trip tests for known codes.

## 5) Documentation and API Map Updates

- Update `README.md` coverage and imports-by-task rows.
- Add module entry in `docs/src/lib/rfc-map.ts` with RFC 6585 sections and exports.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add status types in `src/types/status.ts` and re-export.
2. Implement `src/additional-status.ts`.
3. Export from `src/index.ts`.
4. Add tests with RFC citations.
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

- Semantic overlap with existing retry/problem helpers:
  - Reuse shared functions instead of duplicating behavior.
- Misinterpreting no-store requirement:
  - Enforce deterministic no-store header in helper and tests.
- Over-modeling representation-level SHOULD text:
  - Keep optional diagnostics minimal and explicitly non-normative.
