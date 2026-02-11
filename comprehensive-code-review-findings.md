# Comprehensive Code Review Findings

Date: 2026-02-11
Repository: `http-rfc-utils`

## Scope and Method

- Goal: thorough repository-wide review for bad practices and correctness risks.
- Coverage target: every tracked code line in this repository (`git ls-files` reported 357 tracked files).
- Review approach: parallel deep subagent passes by area, then independent critique, then implementation planning.
- Excluded from direct line-by-line review as non-source/generated/vendor context: local `node_modules/`, local `dist/`, and untracked workspace files.

## Coverage Tracker

| Area | Status | Reviewer Notes |
|---|---|---|
| `src/` core modules | Complete | 74 files reviewed line-by-line by subagent |
| `src/auth/` | Complete | 14 files reviewed line-by-line by subagent |
| `src/jsonpath/` | Complete | 8 files reviewed line-by-line by subagent |
| `src/openapi/` | Complete | 8 files reviewed line-by-line by subagent |
| `src/types/` and public facades | Complete | 23 files reviewed line-by-line by subagent |
| `test/` and `test/fuzz/` | Complete | 81 top-level tests + fuzz/corpus/fixtures reviewed line-by-line |
| `scripts/` and `bench/` | Complete | All script and semver tooling files + benchmark reviewed |
| Config and CI (`package.json`, `tsconfig*`, workflows, changesets) | Complete | Workflow/config files reviewed line-by-line |
| Docs and existing audit artifacts | Complete | 88 docs/audit/plan files reviewed line-by-line |
| Remaining tracked files (`pnpm-lock.yaml`, `typedoc.json`, `LICENSE`, `.opencode/napkin.md`, unusual root file) | Complete | Gap pass confirmed and reviewed |

Coverage completion note: a gap-audit subagent compared tracked files (`git ls-files`) against review scopes, found 4 uncovered files, and those were subsequently reviewed. Net coverage reached all tracked files in this repository snapshot.

## Findings Log (Appended During Review)

### 2026-02-11T1 - `src/*.ts` core modules

- **High** (`src/datetime.ts:206`): `parseHTTPDate` can accept impossible calendar tokens due to `Date.UTC` normalization; should reject non-existent dates/times before construction and verify UTC round-trip.
- **High** (`src/conditional.ts:62`): `parseIfNoneMatch` may accept malformed trailing garbage (e.g. valid tag prefix + invalid suffix), risking incorrect precondition handling.
- **High** (`src/oauth-authorization-server-metadata.ts:109`): tolerant parser can throw on cyclic objects due to unguarded recursive JSON-value validation.
- **Medium** (`src/cookie.ts:398`): cookie-date parser validates ranges but not true calendar validity (e.g., invalid month/day combos can normalize).
- **Medium** (`src/digest.ts:303`): formatter silently drops invalid `Want-*` preference weights instead of throwing, creating confusing output and inconsistent formatter behavior.
- **Medium** (`src/link.ts:555`): link parser may return partial successes on malformed trailing segments rather than fail-closed.

### 2026-02-11T2 - `src/auth/` + `src/auth.ts`

- **Medium** (`src/auth/digest.ts:367`, `src/auth/digest.ts:383`, `src/auth/digest.ts:388`, `src/auth/digest.ts:465`, `src/auth/digest.ts:480`): Digest formatters rely on type-level token correctness and can emit unsanitized bare values when called from JS/untyped contexts.
- **Medium** (`src/auth/digest.ts:293`, `src/auth/digest.ts:323`): parser accepts `cnonce`/`nc` even when `qop` is absent.
- **Medium** (`src/auth/digest.ts:429`, `src/auth/digest.ts:440`, `src/auth/digest.ts:447`): `Authentication-Info` parser can silently ignore invalid `qop`/`nc` instead of rejecting.
- **Medium** (`src/auth/basic.ts:81`): UTF-8 decode path may accept invalid octets because `Buffer#toString('utf8')` is non-fatal.
- **Medium** (`src/auth/bearer.ts:77`, `src/auth/bearer.ts:81`, `src/auth/bearer.ts:85`, `src/auth/bearer.ts:97`): Bearer challenge grammar under-validated; invalid fields may be tolerated too loosely.
- **Medium** (`src/auth/webauthn-authenticator-data.ts:268`, `src/auth/webauthn-authenticator-data.ts:300`, `src/auth/webauthn-authenticator-data.ts:315`, `src/auth/webauthn-authenticator-data.ts:329`): recursive CBOR walk lacks explicit depth/complexity guard.

### 2026-02-11T3 - `src/jsonpath/` + `src/jsonpath.ts`

- **Critical** (`src/jsonpath/parser.ts:148`): parser can accept malformed trailing/incomplete segments by truncating to last valid prefix.
- **High** (`src/jsonpath/evaluator.ts:1348`, `src/jsonpath/evaluator.ts:967`): RFC 9535 `Nothing` semantics are represented as `null`, potentially altering filter/comparison outcomes.
- **Medium** (`src/jsonpath/evaluator.ts:778`): string length is counted as UTF-16 code units, not Unicode scalar values.
- **Medium** (`src/jsonpath/evaluator.ts:131`): `queryJsonPathNodes` does not consistently honor `throwOnError` for parse failures.
- **Medium** (`src/jsonpath/lexer.ts:229`): code-unit based shorthand-name scan may mishandle supplementary-plane characters.
- **Medium** (`src/jsonpath/evaluator.ts:1277`): regex function behavior depends on JS engine regex semantics versus I-Regexp strictness.

### 2026-02-11T4 - `src/openapi/` + `src/openapi.ts`

- **High** (`src/openapi/security-requirements.ts:237`, `src/openapi/security-requirements.ts:304`, `src/openapi/security-requirements.ts:191`): unknown-scheme `ignore` handling appears to still impact authorization outcome.
- **High** (`src/openapi/security-requirements.ts:334`, `src/openapi/security-requirements.ts:391`, `src/openapi/security-requirements.ts:249`): scope semantics applied too broadly to non-OAuth schemes.
- **High** (`src/openapi/security-requirements.ts:500`, `src/openapi/security-requirements.ts:513`, `src/openapi/security-requirements.ts:521`): credential presence checks may be too permissive for some schemes.
- **Medium** (`src/openapi/parameter-serialization.ts:389`, `src/openapi/parameter-serialization.ts:430`): exploded object query parsing can absorb unrelated query params.
- **Medium** (`src/openapi/lint.ts:97`): lint engine catches and suppresses rule exceptions, masking internal rule failures.
- **Medium** (`src/openapi/lint.ts:762`, `src/openapi/lint.ts:771`): extension-prefix detection misses many malformed extension-like keys.

### 2026-02-11T5 - `src/types/` + `src/types.ts`

- **High** (`src/types/digest.ts:11`, `src/types/digest.ts:30`, `src/digest.ts:23`, `src/digest.ts:44`): digest contracts are duplicated across type facade and runtime module, increasing drift risk.
- **Medium** (`src/types/header.ts:106`, `src/priority.ts:13`, `src/priority.ts:15`, `src/types/digest.ts:41`, `src/digest.ts:197`): public numeric types are broader than runtime-accepted ranges.
- **Medium** (`src/types/status.ts:9`, `src/types/status.ts:15`, `src/index.ts:130`): root export asymmetry for RFC 6585 type helpers may surprise consumers.
- **Low** (`src/types/json-patch.ts:7`, `src/types/json-merge-patch.ts:7`, `src/types/json-canonicalization.ts:7`): duplicated recursive JSON shape aliases across modules increase maintenance cost.
- **Low-Medium** (`src/types/header.ts:89`): public type includes DOM globals (`Request`, `Headers`), reducing portability for non-DOM TS consumers.

### 2026-02-11T6 - Top-level tests (`test/*.test.ts`, `test/integration.test.ts`)

- **High** (`test/integration.test.ts:368`, `test/integration.test.ts:371`, `test/integration.test.ts:372`): at least one branch accepts either failure or success, which can mask regressions.
- **High** (`test/headers.test.ts:46`, `test/headers.test.ts:48`): an HTTP-date case appears to normalize mismatched weekday/date combinations; this may encode non-compliant behavior as expected.
- **Medium** (`test/auth.test.ts:247`, `test/auth.test.ts:250`, `test/response.test.ts:72`, `test/integration.test.ts:127`): heavy `includes(...)` assertions for formatted headers can miss ordering/delimiter/extra-token defects.
- **Medium** (`test/prefer.test.ts:43`, `test/forwarded.test.ts:33`, `test/digest.test.ts:415`, `test/digest.test.ts:417`): parser+formatter round-trips sometimes self-validate without independent oracle vectors.
- **Medium** (`test/host-meta.test.ts:168`, `test/webfinger.test.ts:83`, `test/oauth-authorization-server-metadata.test.ts:58`, `test/http-signatures.test.ts:431`): broad `assert.throws` usage often does not validate specific error reasons.

### 2026-02-11T7 - Fuzzing and fixtures (`test/fuzz/**`, `test/fixtures/**`)

- **High** (`test/fuzz/security-fuzz.spec.ts:776`, `test/fuzz/security-fuzz.spec.ts:889`, `test/fuzz/security-fuzz.spec.ts:1210`, `test/fuzz/security-fuzz.spec.ts:1264`): several invariants are weak (non-null/partial checks), leaving room for semantic regressions.
- **High** (`test/fuzz/security-fuzz.spec.ts:903`): `traceparent` invariant is close to tautological and may not detect semantic-invalid acceptance.
- **Medium** (`test/fuzz/security-fuzz.spec.ts:803`): link invariant checks cardinality, not structural equivalence.
- **Medium** (`test/fuzz/fast-check-harness.ts:19`): mutation charset misses some adversarial bytes and non-ASCII classes.
- **Medium** (`test/fuzz/fast-check-harness.ts:66`, `test/fuzz/fast-check-harness.ts:77`): line-oriented corpus loading prevents true multi-line seed cases.
- **Medium** (`test/fixtures/semver/add-required-parameter/base.d.ts:1`, `test/fixtures/semver/widen-parameter/head.d.ts:1`, `test/fixtures/semver/changesets/patch.md:2`): semver fixture matrix is narrow relative to broader API-diff surface.

### 2026-02-11T8 - Scripts and benchmark (`scripts/**`, `bench/perf.ts`)

- **High** (`scripts/semver/policy.ts:198`, `scripts/semver/compat.ts:89`): semver policy appears unable to require `minor` for additive public API growth.
- **High** (`scripts/check-coverage.mjs:46`, `scripts/check-coverage.mjs:47`, `scripts/run-coverage.mjs:53`): coverage gating parses textual sentinels from command output instead of structured coverage artifacts.
- **Medium** (`bench/perf.ts:82`, `bench/perf.ts:336`): sorting benchmark may reuse mutated dataset across iterations, biasing results.
- **Medium** (`scripts/check-coverage.mjs:136`, `scripts/check-coverage.mjs:138`): basename fallback matching can misattribute hotspots when filenames collide.
- **Medium** (`scripts/postprocess-typedoc.mjs:59`): broad catch can hide non-ENOENT filesystem failures.
- **Medium** (`scripts/semver/buildDts.ts:114`): ref snapshot copy set may miss extra config dependencies needed for robust historical DTS emit.

### 2026-02-11T9 - Config and CI (`.github/workflows`, package/config)

- **High** (`.github/workflows/ci.yml:23`, `.github/workflows/ci.yml:64`, `.github/workflows/release.yml:44`, `.github/workflows/release.yml:67`, `.github/workflows/security-fuzz-nightly.yml:35`): third-party GitHub Actions are tag-pinned, not commit-SHA pinned.
- **High** (`.github/workflows/release.yml:26`, `.github/workflows/release.yml:36`, `.github/workflows/release.yml:50`, `.github/workflows/release.yml:51`): release workflow combines dependency install script execution with publish-token context.
- **Medium** (`.github/workflows/ci.yml:237`, `.github/workflows/ci.yml:218`): required-check aggregation treats `skipped` as success for dependencies.
- **Medium** (`.github/workflows/ci.yml:30`, `.github/workflows/ci.yml:31`, `.github/workflows/ci.yml:80`): compares against mutable base branch state instead of immutable PR base SHA.
- **Medium** (`api-extractor.json:34`, `api-extractor.json:35`): missing release-tag diagnostics suppressed, weakening API governance.

### 2026-02-11T10 - Docs/process artifacts and remaining tracked files

- **High** (`PLAN.md:130`, `PLAN.md:135`, `README.md:14`, `AGENTS.md:7`, `CONTRIBUTING.md:7`): stale baseline contradictions (e.g., Node/version/repo-structure guidance) can misdirect contributors.
- **High** (`docs/spec-compliance-audit.md:18`, `docs/spec-compliance-audit.md:23`, `docs/spec-compliance-audit-deep-pass-2026-02-11.md:17`, `docs/spec-compliance-audit-deep-pass-2026-02-11.md:21`): compliance status artifacts conflict, reducing trust in completion claims.
- **High** (`SECURITY_AUDIT_FINDINGS.md:14`, `SECURITY_AUDIT_FINDINGS.md:224`, `security-review-findings.md:255`, `security-review-findings.md:279`): security state appears fragmented across artifacts without explicit supersession linkage.
- **Medium** (`docs/reference/rfc-map.md:41`, `docs/src/lib/rfc-map.ts:307`, `docs/spec-remediation-plans/08-traceparent-version-forward-compat.md:4`): trace-context behavior claims diverge across docs.
- **Medium** (`, isValidJsonPath(q));":1`): anomalous tracked root filename with empty content appears to be accidental repository debris.

## Accuracy Critique (Independent Pass)

Independent critique subagent reviewed all logged findings against source lines and reclassified several items.

### Confirmed as accurate (high confidence focus)

- OpenAPI security evaluator semantics cluster (`src/openapi/security-requirements.ts:304`, `src/openapi/security-requirements.ts:334`, `src/openapi/security-requirements.ts:500`) remains a top-risk correctness issue.
- Digest bare-value formatter validation gap (`src/auth/shared.ts:265`, `src/auth/digest.ts:395`) confirmed.
- HTTP date parser calendar validation gap (`src/datetime.ts:206`) confirmed.
- OAuth metadata tolerant parse can throw on cyclic input (`src/oauth-authorization-server-metadata.ts:482`) confirmed.
- JSONPath `Nothing` vs `null` semantic conflation (`src/jsonpath/evaluator.ts:1348`) confirmed.
- Semver policy additive-export `minor` bump gap (`scripts/semver/policy.ts:198`) confirmed.
- Tag-pinned third-party GitHub actions instead of SHA pins confirmed (`.github/workflows/ci.yml:23`, `.github/workflows/release.yml:44`, `.github/workflows/security-fuzz-nightly.yml:35`).

### Refined severity/scope

- `parseIfNoneMatch` malformed-tail handling is still a defect, but downgraded from High to Medium severity (`src/conditional.ts:62`).
- `formatWant*Digest` invalid-weight handling is primarily API-consistency debt; downgraded to Low-Medium severity (`src/digest.ts:303`).
- link-parser partial-tail behavior appears intentional but still a quality-risk tradeoff (`src/link.ts:560` comment), downgraded to Low severity.
- Bearer parser looseness and Basic UTF-8 strictness concerns remain but were reclassified as lower-confidence quality/security hardening items.

### Rejected as false positives

- JSONPath parser trailing-segment acceptance claim was rejected: parser does reject unconsumed trailing input (`src/jsonpath/parser.ts:81`).
- JSONPath supplementary-plane shorthand-name lexer bug claim was rejected (`src/jsonpath/lexer.ts:229`, `src/jsonpath/lexer.ts:264`).
- OpenAPI extension-prefix detector “misses many malformed keys” claim was rejected as insufficiently substantiated (`src/openapi/lint.ts:762`).

### Corrected priority top-15

1. OpenAPI security evaluator semantics cluster (`src/openapi/security-requirements.ts:304`, `src/openapi/security-requirements.ts:334`, `src/openapi/security-requirements.ts:500`)
2. Digest bare-value formatter validation gap (`src/auth/shared.ts:265`, `src/auth/digest.ts:395`)
3. HTTP date calendar/weekday validation gap (`src/datetime.ts:206`)
4. OAuth metadata cyclic object tolerant parse throw (`src/oauth-authorization-server-metadata.ts:482`)
5. JSONPath `Nothing` vs `null` semantics (`src/jsonpath/evaluator.ts:1348`)
6. Semver policy cannot require `minor` for additive exports (`scripts/semver/policy.ts:198`)
7. GitHub Actions not SHA pinned (`.github/workflows/ci.yml:23`)
8. `If-None-Match` malformed-tail parsing strictness (`src/conditional.ts:62`)
9. Cookie date calendar validity gap (`src/cookie.ts:398`)
10. WebAuthn CBOR recursion/depth guard gap (`src/auth/webauthn-authenticator-data.ts:268`)
11. OpenAPI exploded object query parse scope (`src/openapi/parameter-serialization.ts:389`)
12. `queryJsonPathNodes` parse-failure `throwOnError` inconsistency (`src/jsonpath/evaluator.ts:131`)
13. Coverage-tooling text-sentinel and basename matching fragility (`scripts/check-coverage.mjs:46`, `scripts/check-coverage.mjs:136`)
14. CI required-check aggregation treats `skipped` as pass (`.github/workflows/ci.yml:237`)
15. Documentation and status contradictions (`PLAN.md:135`, `docs/spec-compliance-audit.md:18`, `docs/spec-compliance-audit-deep-pass-2026-02-11.md:17`)

## Implementation Plan

### Phased roadmap

- **P0 (highest impact first):** OpenAPI security evaluator semantics, Digest bare-value validation, strict HTTP-date validation, OAuth metadata cycle safety, JSONPath Nothing semantics, SHA pinning workflows, strict `If-None-Match` parsing.
- **P1:** semver minor-bump policy for additive exports, strict cookie-date calendar checks, WebAuthn CBOR depth guard, OpenAPI exploded-object parse scoping, JSONPath node-query `throwOnError` consistency.
- **P2:** coverage tooling hardening, CI required-check skip policy tightening, documentation/status artifact reconciliation.

### Itemized execution plan

- **OpenAPI security semantics (P0):** update `src/openapi/security-requirements.ts`; restrict scope checks to OAuth/OIDC flows, make unknown schemes truly ignorable in tolerant mode, tighten per-scheme credential presence checks; extend `test/openapi-security-requirements.test.ts` for unknown+ignore behavior and non-OAuth scope arrays.
- **Digest formatter hardening (P0):** update `src/auth/shared.ts` + `src/auth/digest.ts` to validate bare token fields (including strict `nc` shape) before serialization; add negative formatter tests in `test/auth.test.ts`.
- **HTTP date correctness (P0):** update `src/datetime.ts` with strict calendar/weekday round-trip checks; update/add cases in `test/datetime.test.ts` and `test/headers.test.ts` (remove normalization-as-valid expectation).
- **OAuth metadata cycle safety (P0):** make recursive JSON validation cycle-safe in `src/oauth-authorization-server-metadata.ts`; add cyclic input tests in `test/oauth-authorization-server-metadata.test.ts`.
- **JSONPath semantics (P0/P1):** add internal `NOTHING` sentinel and comparison rules in `src/jsonpath/evaluator.ts`; add query semantics tests in `test/jsonpath.test.ts`; in same area, align `queryJsonPathNodes` parse-error behavior with `throwOnError` option.
- **Semver policy (P1):** enhance `scripts/semver/policy.ts` and fixtures/tests in `test/semver-guard.test.ts` + `test/fixtures/semver/**` to require `minor` on additive exports.
- **Workflow hardening (P0/P2):** pin third-party actions in `.github/workflows/*.yml` by SHA; then tighten required-check aggregator behavior in `.github/workflows/ci.yml` so unintended `skipped` states cannot pass silently.
- **Parser strictness hardening (P0/P1):** implement strict `If-None-Match` parsing in `src/conditional.ts` + tests; implement strict cookie-date round-trip in `src/cookie.ts` + tests.
- **WebAuthn resilience (P1):** thread recursion-depth/item-budget guards through CBOR readers in `src/auth/webauthn-authenticator-data.ts`; add adversarial nesting tests.
- **Coverage tooling robustness (P2):** replace text-sentinel parsing in `scripts/check-coverage.mjs` / `scripts/run-coverage.mjs` with structured artifact parsing and deterministic path resolution.
- **Docs reconciliation (P2):** set one canonical status source, add explicit supersession links between `docs/spec-compliance-audit.md`, `docs/spec-compliance-audit-deep-pass-2026-02-11.md`, `SECURITY_AUDIT_FINDINGS.md`, `security-review-findings.md`, and align baseline claims in `PLAN.md` vs `README.md`/`AGENTS.md`.

### Dependency/order constraints

- Implement date strictness in `src/datetime.ts` before cookie-date strictness in `src/cookie.ts` to reuse validation pattern.
- Bundle JSONPath semantic fix and `throwOnError` consistency changes together because both touch `src/jsonpath/evaluator.ts`.
- Land OpenAPI security semantics before exploded-object parse hardening to avoid conflicting behavior expectations in tests.
- Pin actions first, then adjust required-check aggregation logic to reduce rebasing churn in CI files.

### Suggested PR slicing

1. **PR-A:** OpenAPI security semantics + exploded-object parse scope (`src/openapi/security-requirements.ts`, `src/openapi/parameter-serialization.ts`, related tests).
2. **PR-B:** Digest formatter hardening + strict `If-None-Match` parser (`src/auth/shared.ts`, `src/auth/digest.ts`, `src/conditional.ts`, tests).
3. **PR-C:** Date strictness (HTTP date + cookie date + tests).
4. **PR-D:** JSONPath semantics cluster + OAuth metadata cycle safety + WebAuthn recursion guard.
5. **PR-E:** Semver policy + coverage tooling robustness.
6. **PR-F:** CI workflow hardening + docs/status reconciliation.

### Acceptance criteria

- OpenAPI security requirements produce expected outcomes for unknown schemes and non-OAuth scope arrays.
- Digest formatters throw on invalid bare values and invalid `nc` inputs.
- HTTP and cookie date parsers reject impossible dates and weekday/date mismatches.
- Tolerant OAuth metadata parser returns `null` for cyclic input instead of throwing.
- JSONPath distinguishes missing (`Nothing`) from JSON `null`, and `queryJsonPathNodes` honors `throwOnError`.
- Semver guard requires `minor` for additive exports.
- All third-party GitHub actions are SHA pinned.
- CI required-check logic no longer treats unintended `skipped` states as pass.
- Coverage checks rely on structured outputs, not ad-hoc textual sentinels.
- Docs identify one canonical status source and resolve contradictory claims.
