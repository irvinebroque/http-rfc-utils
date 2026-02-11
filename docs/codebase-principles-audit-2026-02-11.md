# http-rfc-utils AGENTS Principles Audit (2026-02-11)

## Executive Summary

This audit evaluated the repository against `AGENTS.md` principles: traceability over abstraction, strict public API control, parser-vs-formatter semantics, and RFC-cited test/doc discipline.

The codebase is broadly strong and RFC-focused, but there are several correctness and trust gaps:

- High-risk API governance gap: wildcard OpenAPI export in `src/index.ts` obscures contract changes.
- High-risk formatter semantics gaps: several formatters silently normalize or omit semantic-invalid input instead of throwing.
- Traceability/maintainability drift: helper indirection and duplicated parsing logic reduce local reasoning in some modules.
- Documentation drift: RFC map reference and API surface documentation have gaps and inconsistencies.

## Current Branch Status (Snapshot)

This document records findings from the 2026-02-11 audit. The following remediation items are resolved in the current branch snapshot:

- Resolved: wildcard OpenAPI export concern; `src/index.ts` now uses explicit OpenAPI exports.
- Resolved: formatter throw-contract fixes for semantic-invalid inputs in remediated auth/header/security.txt paths.
- Resolved: RFC map source-of-truth guidance now reflects generated map alignment plus intentional consolidated facade rows.

Remaining sections below should be read as the original audit baseline and backlog unless explicitly marked resolved.

## Scope and Method

This report synthesizes deep multi-pass subagent review across:

- Architecture and public API boundaries.
- Parser/formatter behavior consistency.
- Abstraction acceptance criteria and liftability.
- Tests and docs coverage quality.

## AGENTS Anti-Abstraction Checklist Status

1. Traceability to spec subsections: **partial fail in hotspots**.
2. Local reasoning without helper hopping: **partial fail in hotspots**.
3. Hidden semantics in abstractions: **partial fail in hotspots**.
4. Liftability/copyability: **at risk in helper-heavy paths**.
5. New abstraction necessity criteria: **inconsistent**.

## Must-Fix (Correctness and API Trust)

### 1) Wildcard OpenAPI export weakens API contract control

- Severity: High
- Evidence: `src/index.ts`
- Issue: `export * from './openapi.js';` makes surface drift easier and explicit semver review harder.

### 2) Auth formatter semantics do not consistently throw on semantic-invalid input

- Severity: High
- Evidence: `src/auth/basic.ts`, `src/auth/bearer.ts`, `src/auth/digest.ts`
- Issue: formatter behavior allowed silent `null`/drop semantics for invalid formatting inputs.
- AGENTS mismatch: formatters should throw for semantic-invalid inputs.

### 3) Retry-After formatter silently normalizes invalid values

- Severity: Medium
- Evidence: `src/headers.ts`
- Issue: invalid numeric semantics (non-finite, non-integer, negative) were coerced rather than rejected.

### 4) security.txt formatter error context was weak

- Severity: Low-Medium
- Evidence: `src/security-txt.ts`
- Issue: invalid `Expires` could leak generic runtime error shape instead of field-context error.

### 5) RFC map reference drift and omissions

- Severity: High (docs trust)
- Evidence: `docs/reference/rfc-map.md`, `docs/src/lib/rfc-map.ts`, `src/index.ts`
- Issue: missing exported modules and incomplete auth/WebAuthn coverage in reference map.

## Should-Fix (Maintainability and Traceability)

### 1) Boundary policy relies on hardcoded exclusions

- Severity: High
- Evidence: `scripts/check-structure.mjs`
- Issue: private/public module boundaries are partly encoded as exceptions instead of clear enforceable conventions.

### 2) Internal helper option-matrix obscures header ABNF

- Severity: High
- Evidence: `src/internal-parameterized-members.ts`, `src/alt-svc.ts`, `src/hsts.ts`, `src/prefer.ts`, `src/forwarded.ts`
- Issue: shared helper behavior can hide local protocol semantics and force reparsing.

### 3) Duplicate quoted/token parsing logic with semantic drift

- Severity: Medium
- Evidence: `src/internal-parameterized-members.ts`, `src/header-utils.ts`, `src/negotiate.ts`
- Issue: duplicate logic increases drift risk; protocol-named shared helper could reduce divergence where rule is truly identical.

### 4) JSONPath exception-driven syntax flow

- Severity: Medium-High
- Evidence: `src/jsonpath/parser.ts`, `src/jsonpath/lexer.ts`
- Issue: exceptions are used for ordinary syntax flow in paths where explicit branch control would improve reasoning.

### 5) Discoverability barrel overlap

- Severity: Medium
- Evidence: `src/headers/index.ts`, `src/security/index.ts`, `src/negotiation/index.ts`
- Issue: overlapping exports blur ownership and navigation.

### 6) Test coverage and citation quality gaps

- Severity: Medium
- Evidence: `test/auth.test.ts`, `test/datetime.test.ts`, selected WebAuthn tests
- Issue: some exported helpers lacked direct coverage; some WebAuthn tests could be more section-specific.

## Prioritized Remediation Backlog

### P0 (Immediate)

- Replace wildcard OpenAPI export in `src/index.ts` with explicit exports.
- Enforce throw-on-invalid semantics for formatter paths in auth and header utilities.
- Improve formatter error context for `security.txt` expires handling.
- Reconcile RFC map reference with current exported API and add source-of-truth note.

### P1 (Near-term)

- Add direct export-focused tests for high-signal helpers (`isExpired`, `secondsUntil`, `formatWWWAuthenticate`).
- Tighten internal/public boundary enforcement in structure checks.
- Reduce ambiguity in overlapping discoverability barrels.

### P2 (Follow-up)

- Simplify helper indirection where it obscures ABNF (especially parameterized-member stack).
- Consolidate truly shared quoted/token parsing rules behind protocol-named helpers.
- Refactor JSONPath flow away from exception-heavy control in common syntax paths.

## Expected Risk Reduction

- API surface drift risk: **high -> low** after explicit exports.
- Formatter silent-invalid-output risk: **high -> low** after throw semantics.
- Docs trust risk: **high -> medium/low** after map reconciliation.
- Maintainability/traceability risk: **medium-high -> medium** with follow-up P1/P2 refactors.
