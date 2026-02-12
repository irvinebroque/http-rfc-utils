# W3C Reporting API Implementation Plan

- Spec: https://www.w3.org/TR/reporting-1/
- Scope type: Reporting-Endpoints header and reports media helpers
- Repo fit: telemetry/security endpoint tooling for APIs/workers

## 1) Scope and Explicit Non-Goals

- In scope:
  - `Reporting-Endpoints` header parsing/formatting/processing.
  - Endpoint extraction with URL resolution and trust filtering.
  - Reports media type helpers for `application/reports+json` serialization support.
  - URL stripping helper for report payload use.
- Non-goals:
  - User-agent scheduling and delivery engine.
  - ReportingObserver runtime behavior.
  - WebDriver automation integration.
  - Legacy `Report-To` behavior.

## 2) Proposed Module/Files and Public Exports

- New module: `src/reporting.ts`
- Type additions: `src/types/reporting.ts`
- Planned exports:
  - `parseReportingEndpoints`
  - `formatReportingEndpoints`
  - `processReportingEndpointsForResponse`
  - `stripUrlForReport`
  - `serializeReports`
  - `formatReportsJson`
  - `parseReportsJson`
  - `REPORTS_MEDIA_TYPE`
  - Reporting endpoint/report types
- Export wiring:
  - `src/types/shared.ts`
  - `src/index.ts`
  - `src/headers/index.ts`
- Tests: `test/reporting.test.ts`

## 3) Data Model and Behavior

- Endpoint model:
  - `name`, `url`, `failures` (initialized to `0`).
- Header parsing:
  - Parse as Structured Fields dictionary (reuse existing SF parser).
  - Non-string dictionary member values ignored.
  - Member params ignored.
  - Invalid URI-reference members ignored.
- Response processing:
  - Resolve endpoint URI refs against response URL.
  - Keep only potentially trustworthy endpoint origins.
  - Return deterministic endpoint list.
- Reports media helpers:
  - Constant `REPORTS_MEDIA_TYPE = 'application/reports+json'`.
  - Serialize report collection with expected fields (`age`, `type`, `url`, `user_agent`, `body`).
  - Support deterministic `now` option for tests.

## 4) Test Matrix (Spec-Mapped)

- Reporting-Endpoints dictionary parsing (valid, invalid, unknown member forms).
- URI-reference resolution against base response URL.
- Trust filtering behavior (trusted vs non-trusted endpoints).
- Media type constant check.
- Report serialization shape and attempts increment semantics.
- URL stripping helper behavior.
- Parse round-trip and malformed JSON tolerance for report payload helper.

## 5) Documentation and API Map Updates

- Update `README.md` with Reporting API coverage and imports rows.
- Add entry in `docs/src/lib/rfc-map.ts` for `src/reporting.ts` with implemented section anchors.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add `src/types/reporting.ts` and re-export from `src/types/shared.ts`.
2. Implement `src/reporting.ts` helpers.
3. Wire exports in `src/index.ts` and `src/headers/index.ts`.
4. Add `test/reporting.test.ts` with W3C section citations.
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

- Working Draft behavior drift:
  - Pin implemented sections in docs and keep narrow scope.
- Trustworthiness policy complexity:
  - Keep helper explicit and thoroughly tested with known cases.
- Serializer side-effect surprises (attempt counter changes):
  - Document behavior and test explicitly.
