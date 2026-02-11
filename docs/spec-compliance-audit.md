# Specification Compliance Audit

Started: 2026-02-11
Repository: `http-rfc-utils`

## Scope and method

- Goal: identify implementation behavior that is out of compliance with the underlying RFC/W3C specification text.
- Method: line-by-line review of source files, with direct spec lookup for each issue candidate.
- Rule for findings: include code location, concrete behavior, normative spec requirement, and impact.

## Progress log

- [done] Source inventory captured (`src/**/*.ts`), plus follow-up coverage check for uncovered modules.
- [done] First-pass domain audits completed in parallel (HTTP semantics, security/auth, linking/URI/discovery, JSON formats, OpenAPI, facades).
- [done] Coverage gap pass completed for previously unassigned files: `src/internal-cache-control-schema.ts`, `src/openapi/lint.ts`, `src/reporting.ts`, `src/sorting.ts`, `src/types/reporting.ts`.
- [done] Per-finding remediation plans created under `docs/spec-remediation-plans/` for findings 01-36.
- [done] All remediation plans implemented in source and tests.
- [done] Targeted remediation suite executed successfully.

## Findings

Confirmed non-compliance findings: **36**

Remediation status:

- [done] Findings **01-06** (Structured Fields + Cache-Status + Proxy-Status)
- [done] Findings **07-14** (security.txt + Trace Context + Content-Disposition + auth challenges/credentials)
- [done] Findings **15-19** (Link + Linkset + ext-value + WebFinger)
- [done] Findings **20-25** (JSONPath lexer/parser/evaluator compliance)
- [done] Findings **26-31** (OpenAPI server fallback + robots + negotiation grammar)
- [done] Findings **32-36** (OpenAPI and Problem Details public type contracts)

Implementation artifacts:

- Per-finding plans: `docs/spec-remediation-plans/01-structured-dict-boolean.md` through `docs/spec-remediation-plans/36-problem-details-optional-members.md`.
- Core implementation files touched include:
  - `src/structured-fields.ts`, `src/cache-status.ts`, `src/proxy-status.ts`
  - `src/security-txt.ts`, `src/trace-context.ts`, `src/content-disposition.ts`, `src/auth/basic.ts`, `src/auth/digest.ts`
  - `src/link.ts`, `src/linkset.ts`, `src/ext-value.ts`, `src/webfinger.ts`
  - `src/jsonpath/lexer.ts`, `src/jsonpath/parser.ts`, `src/jsonpath/evaluator.ts`, `src/jsonpath/tokens.ts`
  - `src/openapi/path-server-resolver.ts`, `src/robots.ts`, `src/language.ts`, `src/encoding.ts`
  - `src/types/openapi.ts`, `src/types/problem.ts`, `src/openapi/security-requirements.ts`, `src/index.ts`

Verification:

- Targeted remediation suite command:
  - `pnpm exec tsx --test test/structured-fields.test.ts test/structured-fields.corpus.test.ts test/cache-status.test.ts test/proxy-status.test.ts test/security-txt.test.ts test/trace-context.test.ts test/content-disposition.test.ts test/auth.test.ts test/link.test.ts test/linkset.test.ts test/ext-value.test.ts test/webfinger.test.ts test/jsonpath.test.ts test/openapi-path-server-resolver.test.ts test/robots.test.ts test/language.test.ts test/encoding.test.ts test/problem.test.ts test/openapi-security-requirements.test.ts test/openapi-link-callback.test.ts`
- Result: **834 passed, 0 failed**.
