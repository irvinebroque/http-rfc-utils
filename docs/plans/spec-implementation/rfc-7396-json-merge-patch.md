# RFC 7396 Implementation Plan: JSON Merge Patch

- Spec: https://www.rfc-editor.org/rfc/rfc7396.html
- Scope type: full MergePatch algorithm helpers
- Repo fit: API partial update semantics for CRUD/workers

## 1) Scope and Non-Goals

- In scope:
  - RFC 7396 Section 2 algorithm semantics.
  - Section 3 example behavior.
  - Section 4 media type constant.
  - Appendix A vectors.
- Non-goals:
  - HTTP transport semantics and status mapping.
  - Diff generation.
  - Text-preserving JSON transforms (whitespace/order fidelity).

## 2) Proposed Module/Files and Public Exports

- New module: `src/json-merge-patch.ts`
- New types: `src/types/json-merge-patch.ts`
- Public exports from `src/index.ts`:
  - `MERGE_PATCH_CONTENT_TYPE`
  - `parseJsonMergePatch`
  - `applyJsonMergePatch`
  - `validateJsonMergePatch`
  - `formatJsonMergePatch`
  - Merge patch types
- Tests: `test/json-merge-patch.test.ts`

## 3) Data Model and Merge Semantics

- Patch can be any JSON value.
- Merge behavior:
  - If patch is object:
    - Non-object target treated as `{}`.
    - Member value `null` means delete key.
    - Non-null member applies recursively.
  - If patch is non-object, whole target is replaced by patch.
- Array behavior:
  - Arrays are replaced as complete values, not merged element-wise.
- Contracts:
  - Parser tolerant (`null` on syntax invalid JSON text).
  - Validator/formatter/apply strict (throw on semantic-invalid runtime values).
  - Apply returns new value without mutating caller input.

## 4) Test Matrix (RFC-Mapped)

- Section 2:
  - Object merge, nested recursion, null-delete, non-object replacement.
  - Array replacement behavior.
- Section 3:
  - Reproduce document example behavior exactly.
- Appendix A:
  - Parameterized tests for all official vectors.
- Robustness:
  - Parse invalid JSON -> `null`.
  - Format invalid runtime values -> throw.
  - Immutability of input target.

## 5) Documentation and API Map Updates

- Update `README.md` imports and RFC coverage snapshot.
- Add module entry to `docs/src/lib/rfc-map.ts`.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add types in `src/types/json-merge-patch.ts` and re-export.
2. Implement `src/json-merge-patch.ts`.
3. Export from `src/index.ts`.
4. Add `test/json-merge-patch.test.ts` with RFC citations.
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

- Confusion around object-member `null` semantics:
  - Document and test explicitly.
- Prototype pollution key risks:
  - Use safe own-property mutation logic.
- Deep nesting and recursion limits:
  - Add depth/cycle guard strategy if needed.
