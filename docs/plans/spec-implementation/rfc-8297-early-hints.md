# RFC 8297 Implementation Plan: Early Hints

- Spec: https://www.rfc-editor.org/rfc/rfc8297.html
- Scope type: userspace helpers only
- Repo fit: HTTP/API and edge response optimization utilities

## 1) Scope and Non-Goals

- In scope:
  - Parse, format, validate, and merge helpers for Early Hints link values.
  - Modeling for `103` status and repeated hint batches.
  - Practical preload-oriented helpers that integrate with existing Link parsing.
- Non-goals:
  - Runtime transport emission (`writeEarlyHints`, proxy behavior, browser internals).
  - HTTP/2 push orchestration or client-side preload execution behavior.
  - Any logic that changes final response semantics based on 103 hints.

## 2) Proposed Module/Files and Public Exports

- New module: `src/early-hints.ts`
- Public exports:
  - `EARLY_HINTS_STATUS` (`103`)
  - `parseEarlyHintsLinks`
  - `formatEarlyHintsLinks`
  - `validateEarlyHintsLinks`
  - `extractPreloadLinks`
  - `mergeEarlyHintsLinks`
- Index/barrel wiring:
  - `src/index.ts`
  - Optional discoverability from `src/headers/index.ts` or `src/linking/index.ts`
- Tests: `test/early-hints.test.ts`

## 3) Data Model and Validation Behavior

- Reuse existing RFC 8288 parsing/formatting from `src/link.ts`:
  - Parse via `parseLinkHeader`
  - Format via `formatLinkHeader`/`formatLink`
- Parse contract:
  - Tolerant input (`string | string[] | null | undefined`)
  - Syntax-invalid input returns `[]`
- Validation/format contract:
  - Semantic-invalid entries throw `Error`
  - Optional strict mode may enforce preload-only requirements
- Merge contract:
  - Support multiple 103 batches
  - Deterministic dedupe strategy (documented keying)
  - Preserve first-seen order

## 4) Test Matrix (RFC-Mapped)

- RFC 8297 Section 2:
  - Parse nominal single and repeated Link values.
  - Aggregate multiple 103 hint batches.
  - Confirm no negative inference from absent hints in later batches.
- Preload helper behavior:
  - `extractPreloadLinks` returns only `rel=preload` links.
  - Strict mode rejects non-preload entries.
- Robustness:
  - Malformed values return `[]` in tolerant parser.
  - Round-trip parse/format stability tests.

## 5) Documentation and API Map Updates

- Update `README.md` import/task table for Early Hints utilities.
- Add RFC 8297 coverage mention in `README.md` summary.
- Add module entry in `docs/src/lib/rfc-map.ts` for `src/early-hints.ts` with sections and exports.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Implement types and helpers in `src/early-hints.ts`.
2. Wire exports in `src/index.ts` (and optional header/link barrel).
3. Add `test/early-hints.test.ts` with RFC section citations.
4. Update docs and changeset.
5. Run gates:
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

- Platform/runtime confusion about actually sending 103:
  - Keep API transport-agnostic and header-focused.
- Over-restrictive preload assumptions:
  - Default permissive behavior, optional strict mode.
- Merge dedupe ambiguity:
  - Define deterministic key and ordering in docs/tests.
