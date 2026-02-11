# W3C CSP3 Subset Implementation Plan

- Spec: https://www.w3.org/TR/CSP3/
- Scope type: server-side header parse/format/validate subset only
- Repo fit: high-value API/edge security header utilities

## 1) Scope and Explicit Non-Goals

- In scope:
  - Parsing serialized policies from header values.
  - Formatting and validating supported directives/source lists.
  - Handling enforce vs report-only policy header variants.
- v1 directive subset:
  - `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `object-src`
  - `base-uri`, `form-action`, `frame-ancestors`
  - `report-uri`, `report-to`
- Non-goals:
  - Browser enforcement algorithms.
  - Violation reporting runtime pipeline.
  - Meta-element delivery behavior.
  - Full directive universe in CSP3.

## 2) Proposed Module/Files and Public Exports

- New module: `src/csp.ts`
- Type additions in `src/types/security.ts`
- Public exports from `src/index.ts` and `src/security/index.ts`:
  - `parseContentSecurityPolicy`
  - `formatContentSecurityPolicy`
  - `parseContentSecurityPolicyReportOnly`
  - `formatContentSecurityPolicyReportOnly`
  - `parseContentSecurityPolicies`
  - `validateContentSecurityPolicy`
  - `parseCspSourceList`
  - `formatCspSourceList`
  - `validateCspSourceList`
  - CSP types
- Tests: `test/csp.test.ts`

## 3) Data Model and Validation Behavior

- Parser behavior:
  - Tolerant; ignores unknown directives.
  - Returns empty or null for syntax-invalid policy input (per selected parser contract).
- Formatter/validator behavior:
  - Strict; throw `Error` on semantic-invalid structures.
- Source expression support:
  - Keyword sources, nonce/hash sources, scheme/host sources in subset.
  - `frame-ancestors` restricted to allowed expression classes.
- Directive normalization:
  - Lowercase names.
  - Duplicate directives keep first occurrence in parse flow.

## 4) Test Matrix (Spec-Mapped)

- Parse serialized policy cases (valid, duplicates, empty tokens, malformed).
- Header-level policy list parsing for enforce/report-only.
- Source-list grammar and token validation.
- Directive-specific cases for `frame-ancestors`, `report-uri`, `report-to`.
- Round-trip parse/format stability for supported subset.

## 5) Documentation and API Map Updates

- Update `README.md` for CSP imports and coverage snapshot.
- Add module entry to `docs/src/lib/rfc-map.ts` with CSP3 section anchors and subset note.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add CSP types.
2. Implement `src/csp.ts` parser/formatter/validator.
3. Wire exports.
4. Add `test/csp.test.ts` with W3C section citations.
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

- Working Draft drift risk:
  - Pin implemented anchors and keep subset explicit.
- Over/under validation risk in source expressions:
  - Document accepted subset and add precise tests.
- Unknown directive round-trip expectations:
  - Document parser behavior clearly.
