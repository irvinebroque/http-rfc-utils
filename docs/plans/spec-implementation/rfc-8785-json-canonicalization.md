# RFC 8785 Implementation Plan: JSON Canonicalization Scheme (JCS)

- Spec: https://www.rfc-editor.org/rfc/rfc8785.html
- Scope type: canonical JSON serialization and verification helpers
- Repo fit: deterministic signing/hash/cache-key utilities

## 1) Scope and Non-Goals

- In scope:
  - RFC 8785 Sections 3.1, 3.2.1-3.2.4 and related security guidance.
  - Canonical formatter, validator, parser-for-canonical-text check, and UTF-8 bytes helper.
- Non-goals:
  - Signature generation/verification.
  - Alternative canonicalization schemes.
  - Large external conformance harness integration in v1.

## 2) Proposed Module/Files and Public Exports

- New module: `src/json-canonicalization.ts`
- New types: `src/types/json-canonicalization.ts`
- Public exports from `src/index.ts`:
  - `formatCanonicalJson`
  - `formatCanonicalJsonUtf8`
  - `validateCanonicalJson`
  - `parseCanonicalJson`
  - Canonical JSON types/options
- Tests: `test/json-canonicalization.test.ts`

## 3) Canonicalization Rules

- No insignificant whitespace in output.
- String serialization aligned to ECMAScript JSON escaping rules.
- Reject lone surrogate code units.
- Number serialization aligned to ECMAScript behavior; reject non-finite values.
- Object keys sorted recursively by UTF-16 code-unit lexical order.
- Arrays retain original order while nested objects are canonicalized.
- UTF-8 helper returns encoded canonical JSON bytes.

## 4) Test Matrix (RFC-Mapped)

- Section 3.2.1: no extra whitespace.
- Section 3.2.2.x:
  - literal handling
  - string escaping
  - number formatting vectors
- Section 3.2.3: recursive key sorting and multilingual edge ordering.
- Section 3.2.4: UTF-8 output bytes checks.
- Parser contract tests:
  - syntax-invalid -> `null`
  - valid but non-canonical text -> `null`
  - canonical round-trip success

## 5) Documentation and API Map Updates

- Update `README.md` imports and RFC 8785 coverage mention.
- Add module entry in `docs/src/lib/rfc-map.ts` with implemented sections/exports.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add types in `src/types/json-canonicalization.ts` and re-export.
2. Implement canonicalization module.
3. Export from `src/index.ts`.
4. Add tests with section citations.
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

- Number edge semantics and negative-zero policy:
  - Make behavior explicit and test thoroughly.
- Invalid Unicode handling differences:
  - Use explicit lone-surrogate checks.
- Cycles and non-JSON runtime values:
  - Fail fast via strict validation.
