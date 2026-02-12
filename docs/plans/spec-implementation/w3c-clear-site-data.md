# W3C Clear Site Data Implementation Plan

- Spec: https://www.w3.org/TR/clear-site-data/
- Scope type: header parse/format/validate subset only
- Repo fit: logout/incident-response safety headers for APIs/workers

## 1) Scope and Explicit Non-Goals

- In scope:
  - Header syntax support for known directives:
    - `"cache"`, `"cookies"`, `"storage"`, `"executionContexts"`, `"*"`
  - Parsing behavior aligned to spec parsing algorithm:
    - unknown directives ignored
    - parse failure yields empty result
  - Formatting and strict validation helpers.
- Non-goals:
  - User agent data-clearing side effects.
  - Fetch integration/runtime behavior.
  - Service worker lifecycle actions.

## 2) Proposed Module/Files and Public Exports

- New module: `src/clear-site-data.ts`
- Type additions: `src/types/security.ts`
- Planned exports:
  - `parseClearSiteData`
  - `formatClearSiteData`
  - `validateClearSiteData`
  - `ClearSiteDataType`
  - `ClearSiteDataDirective`
- Export wiring:
  - `src/index.ts`
  - `src/headers/index.ts`
- Tests: `test/clear-site-data.test.ts`

## 3) Data Model and Behavior

- Known type constants:
  - `cache`, `cookies`, `storage`, `executionContexts`
  - wildcard `*`
- Parser behavior (tolerant):
  - Accept header value string or `string[]`.
  - Require quoted-string member syntax.
  - Syntax-invalid member list returns `[]`.
  - Unknown but syntactically valid types ignored.
  - `"*"` expands to all known types in canonical order.
- Formatter/validator behavior (strict):
  - Throw on unknown directives.
  - Throw on empty directive list.
  - Output quoted-string list format.

## 4) Test Matrix (Spec-Mapped)

- Nominal parsing of single and multiple known directives.
- Wildcard expansion behavior.
- Unknown directive ignore behavior.
- Invalid syntax returns empty parse result.
- Strict formatter/validator failure cases.
- Round-trip parse/format tests.

## 5) Documentation and API Map Updates

- Update `README.md` with Clear-Site-Data imports and coverage note.
- Add module entry in `docs/src/lib/rfc-map.ts` with implemented anchors.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add types in `src/types/security.ts`.
2. Implement `src/clear-site-data.ts`.
3. Wire exports in `src/index.ts` and `src/headers/index.ts`.
4. Add `test/clear-site-data.test.ts` with W3C section citations.
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

- Working Draft evolution risk:
  - Keep scope narrow to stable header parsing/formatting subset.
- Parser strictness surprises:
  - Document parse-failure behavior and include explicit malformed tests.
- Future directive additions:
  - Keep parser forward-compatible by ignoring unknown directives.
