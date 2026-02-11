# RFC 6902 Implementation Plan: JSON Patch

- Spec: https://www.rfc-editor.org/rfc/rfc6902.html
- Scope type: full JSON Patch document and operation helpers
- Repo fit: API PATCH handling for workers/services

## 1) Scope and Non-Goals

- In scope:
  - RFC 6902 Sections 3, 4, 4.1-4.6, 5, 6.
  - All operations: `add`, `remove`, `replace`, `move`, `copy`, `test`.
  - Sequential apply with first-error termination semantics.
  - Media type constant support.
- Non-goals:
  - HTTP endpoint behavior/status mapping (outside utility scope).
  - Patch diff generation.
  - JSON Merge Patch (RFC 7396) in same module.
  - Raw duplicate-key JSON text handling beyond host parser behavior.

## 2) Proposed Module/Files and Public Exports

- New module: `src/json-patch.ts`
- New types: `src/types/json-patch.ts`
- Type wiring: `src/types/shared.ts`
- Public exports from `src/index.ts`:
  - `JSON_PATCH_MEDIA_TYPE`
  - `parseJsonPatch`
  - `tryParseJsonPatch`
  - `formatJsonPatch`
  - `validateJsonPatch`
  - `applyJsonPatch`
  - Operation/document types
- Tests: `test/json-patch.test.ts`

## 3) Data Model and Validation Rules

- Data model:
  - `JsonPatchDocument = JsonPatchOperation[]`
  - Discriminated union by `op` with required members:
    - `path` required on all ops
    - `from` required on `move` and `copy`
    - `value` required on `add`, `replace`, `test`
- Parser behavior (tolerant):
  - Returns `null` for syntax-level invalid patch structures.
  - Validates pointer syntax via existing RFC 6901 helpers.
- Validator/formatter/apply behavior (strict):
  - Throws `Error` on semantic-invalid operations.
  - Enforce `move` constraint: `from` must not be proper prefix of `path`.
- Apply behavior:
  - Sequential, fail-fast.
  - Return new value (no mutation of caller input).
  - Proper array semantics including `-` append for `add`.
  - Deep equality logic for `test` per RFC expectations.

## 4) Test Matrix (RFC-Mapped)

- Section 3: valid/invalid patch document root shape.
- Section 4: operation object member validity and unknown-member tolerance.
- Sections 4.1-4.6:
  - Per-op nominal and boundary cases.
  - Array index bounds, parent existence checks, move prefix prohibition.
- Section 5: first error stops processing.
- Appendix A vectors: include normative examples and edge cases.

## 5) Documentation and API Map Updates

- Update `README.md` with JSON Patch imports and RFC coverage.
- Add `src/json-patch.ts` entry in `docs/src/lib/rfc-map.ts` with sections and exports.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add types in `src/types/json-patch.ts` and re-export.
2. Implement `src/json-patch.ts`.
3. Export from `src/index.ts`.
4. Add `test/json-patch.test.ts` with RFC citations.
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

- Pointer/path edge behavior:
  - Centralize resolver and assert with targeted tests.
- Prototype pollution keys in object writes:
  - Use guarded own-key handling.
- Non-JSON runtime values:
  - Validate strictly before apply/format.
