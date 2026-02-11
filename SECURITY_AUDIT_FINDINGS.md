# Security Audit Findings

Date: 2026-02-11
Repository: `http-rfc-utils`
Scope: `src/**/*.ts`, `scripts/**/*.mjs`, `.github/workflows/*.yml`

## Methodology

- Manual code review of parser, validator, auth/crypto, and utility modules.
- Pattern-driven static review for dynamic regex, recursion, trust-boundary checks, and object-shape assumptions.
- Runtime proof-of-concept checks with `pnpm exec tsx -e ...` to validate exploitability and impact.
- CI/supply-chain hardening review of workflow configuration and release automation.

## Findings (Confirmed)

### 1) Regex complexity DoS in robots wildcard matching

- Severity: High
- Confidence: High
- Affected code:
  - `src/robots.ts:236`
  - `src/robots.ts:241`
  - `src/robots.ts:249`
  - `src/robots.ts:304`
  - `src/robots.ts:312`
- Impact:
  - Untrusted/attacker-influenced robots patterns can compile to regexes with repeated `.*` and trigger heavy backtracking on mismatch paths.
  - Matching runs in loops across rules, amplifying per-request CPU cost.
- Evidence:
  - Runtime PoC showed a single call taking ~497ms with crafted pattern/input.
- Why:
  - `*` is translated to `.*` and used in backtracking regex engine without complexity guardrails.
- Remediation:
  - Replace regex-based wildcard evaluation with a linear-time glob matcher.
  - If regex must remain, cap wildcard count and pattern length and add explicit backtracking-safe pattern generation.

### 2) Regex complexity DoS in JSONPath `match()`/`search()` policy bypass

- Severity: High
- Confidence: High
- Affected code:
  - `src/jsonpath/evaluator.ts:902`
  - `src/jsonpath/evaluator.ts:909`
  - `src/jsonpath/evaluator.ts:936`
  - `src/jsonpath/evaluator.ts:990`
- Impact:
  - Default unsafe-regex policy blocks some dangerous forms (e.g. nested quantifier heuristics) but misses others, enabling expensive regex execution in filter evaluation.
- Evidence:
  - Runtime PoC with pattern `(a|aa)+$` returned non-null result path (`result_is_null false`) and consumed noticeable runtime (~71ms on small sample), indicating policy bypass.
- Why:
  - Heuristic detection is incomplete; catastrophic/exponential patterns are broader than current checks.
- Remediation:
  - Use a proven safe-regex validator or regex engine with linear-time guarantees.
  - Keep strict budgets (`maxRegexPatternLength`, `maxRegexInputLength`) and consider lowering defaults.
  - Add denylist/allowlist tests including alternation-overlap families like `(a|aa)+$`.

### 3) Regex complexity risk in Compression Dictionary wildcard matching

- Severity: Medium
- Confidence: Medium
- Affected code:
  - `src/compression-dictionary.ts:43`
  - `src/compression-dictionary.ts:45`
  - `src/compression-dictionary.ts:46`
  - `src/compression-dictionary.ts:325`
  - `src/compression-dictionary.ts:348`
- Impact:
  - Wildcard patterns are translated to regex using repeated `.*` and evaluated per dictionary candidate.
  - Worst-case crafted patterns can increase CPU cost, especially when many dictionaries are scanned (`selectBestDictionary`).
- Evidence:
  - Code path mirrors the same regex construction pattern seen in `robots.ts`; runtime checks show measurable growth under larger candidate sets.
- Why:
  - Backtracking regex over attacker-influenced wildcard patterns without complexity bounds.
- Remediation:
  - Replace with linear wildcard matcher.
  - Add pattern limits and candidate-scan limits.

### 4) Unbounded recursion DoS in JSON Merge Patch

- Severity: High
- Confidence: High
- Affected code:
  - `src/json-merge-patch.ts:68`
  - `src/json-merge-patch.ts:83`
  - `src/json-merge-patch.ts:134`
- Impact:
  - Deeply nested attacker-controlled JSON can crash processing with `RangeError: Maximum call stack size exceeded`.
- Evidence:
  - Runtime PoC with deep nested object (~12000 depth) threw `RangeError`.
- Why:
  - Recursive merge and recursive cloning traverse unbounded depth.
- Remediation:
  - Enforce maximum nesting depth for parse/apply paths.
  - Refactor recursion into iterative traversal where feasible.

### 5) Unbounded recursion DoS in JSON Patch

- Severity: High
- Confidence: High
- Affected code:
  - `src/json-patch.ts:531`
  - `src/json-patch.ts:537`
  - `src/json-patch.ts:560`
  - `src/json-patch.ts:600`
- Impact:
  - Deeply nested documents/operations can trigger stack overflow during clone/equality/value-walk paths.
- Evidence:
  - Runtime PoC with deep structure (~12000 depth) threw `RangeError`.
- Why:
  - Multiple recursive helpers process attacker-controlled shape without depth caps.
- Remediation:
  - Add explicit max depth and max operation complexity limits.
  - Convert deep recursive helpers to iterative logic or bounded recursion.

### 6) Prototype-chain property acceptance in Linkset validation

- Severity: Medium
- Confidence: High
- Affected code:
  - `src/linkset.ts:481`
- Impact:
  - `parseLinksetJson` can accept target objects where required `href` exists only on prototype, violating strict own-property JSON object expectations.
- Evidence:
  - Runtime PoC: `parseLinksetJson inherited href accepted: true`.
- Why:
  - Uses `('href' in target)` rather than own-property check.
- Remediation:
  - Replace with `Object.prototype.hasOwnProperty.call(target, 'href')` and keep type check.

### 7) Prototype-chain traversal in JSON Pointer evaluation

- Severity: Medium
- Confidence: High
- Affected code:
  - `src/json-pointer.ts:180`
- Impact:
  - Pointer evaluation can resolve inherited properties (prototype chain), which diverges from strict JSON object member semantics and may expose unexpected values.
- Evidence:
  - Runtime PoC: `evaluateJsonPointer('/secret', Object.create({ secret: 'from-proto' }))` returned inherited value.
- Why:
  - Uses `token in obj` instead of own-property check.
- Remediation:
  - Require own-property lookup when traversing objects.

### 8) Non-constant-time digest comparison in content digest verification

- Severity: Medium
- Confidence: High
- Affected code:
  - `src/digest.ts:447`
  - `src/digest.ts:451`
  - `src/digest.ts:452`
- Impact:
  - Byte-by-byte early-exit comparison leaks mismatch position via timing differences.
  - Risk depends on deployment model and attacker timing precision.
- Why:
  - Manual loop returns on first mismatch.
- Remediation:
  - Use constant-time compare primitive (`timingSafeEqual`-style approach for equal-length buffers).

### 9) Path traversal in fuzz artifact promotion script

- Severity: Medium
- Confidence: High
- Affected code:
  - `scripts/fuzz/promote-counterexample.mjs:83`
  - `scripts/fuzz/promote-counterexample.mjs:89`
  - `scripts/fuzz/promote-counterexample.mjs:109`
- Impact:
  - Untrusted `module`/artifact-derived module names can escape intended corpus subdirectory and write files elsewhere on disk relative to repo root.
- Evidence:
  - Path construction demo:
    - `../../outside => /Users/brendan/src/http-rfc-utils/test/outside`
    - `../../../../tmp/evil => /Users/brendan/src/tmp/evil`
- Why:
  - `path.join(..., moduleName)` is used without validating/sanitizing path segments.
- Remediation:
  - Restrict module names to safe basename tokens.
  - Resolve and verify destination prefix remains under intended corpus root before writes.

### 10) CI workflow hardening gaps (supply chain / token exposure surface)

- Severity: Medium
- Confidence: High
- Affected code:
  - `.github/workflows/ci.yml:20`
  - `.github/workflows/ci.yml:63`
  - `.github/workflows/security-fuzz-nightly.yml:13`
  - `.github/workflows/security-fuzz-nightly.yml:22`
  - `.github/workflows/release.yml:23`
  - `.github/workflows/release.yml:33`
- Impact:
  - Third-party actions are tag-pinned (`@v4`, `@v1`, etc.) rather than commit-SHA pinned.
  - `ci.yml` and `security-fuzz-nightly.yml` do not set explicit least-privilege `permissions`.
  - `actions/checkout` uses default credential persistence.
  - `pnpm install --frozen-lockfile` executes lifecycle scripts in CI/release contexts.
- Why:
  - Workflow defaults increase blast radius if upstream action/dependency compromise occurs.
- Remediation:
  - Pin actions to full commit SHAs.
  - Add top-level/job-level minimal `permissions`.
  - Set `persist-credentials: false` on checkout where push is unnecessary.
  - Consider `pnpm install --frozen-lockfile --ignore-scripts` in non-release jobs, with explicit allowlist jobs for required scripts.

## Findings (Needs Confirmation / Lower Confidence)

### A) `createProblem` extension merge and magic keys

- Status: Needs confirmation (likely low severity hardening issue)
- Affected code:
  - `src/problem.ts:39`
- Note:
  - `Object.assign(problem, options.extensions)` can copy magic keys (e.g. `__proto__`) into returned object state.
  - Current evidence does not show global prototype pollution in this repository path.
- Suggested follow-up:
  - Decide policy for extension-key filtering and/or use null-prototype output objects.

## Reviewed and triaged as not currently vulnerable (for this issue class)

- `src/oauth-authorization-server-metadata.ts`
  - Re-reviewed object guards and clone paths (`isRecord`, `isJsonValue`, `Object.entries`, own-key serialization flow).
  - No confirmed prototype pollution exploit found in current implementation.

## Prioritized Remediation Plan

1. Fix regex complexity risks in `src/robots.ts` and `src/jsonpath/evaluator.ts` (highest external DoS exposure).
2. Add depth/complexity limits to `src/json-merge-patch.ts` and `src/json-patch.ts`.
3. Replace prototype-chain checks with own-property checks in `src/linkset.ts` and `src/json-pointer.ts`.
4. Harden digest verification to constant-time comparison.
5. Patch path traversal in `scripts/fuzz/promote-counterexample.mjs`.
6. Harden CI workflows (SHA pinning, permissions, credential persistence, install script posture).

## Notes

- Dependency advisory scans (`pnpm audit --prod --json`, `pnpm audit --json`) returned no advisories at audit time.
- This report is intended to be updated continuously as additional modules are exhaustively reviewed.
