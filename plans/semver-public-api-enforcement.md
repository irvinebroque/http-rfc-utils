# SemVer Public API Enforcement Plan (Pure TypeScript)

## Goal

Build a test suite and CI gate that guarantees:

- breaking changes to the package public API are never released as `patch` or `minor`
- CI fails on pull requests when declared release intent (Changesets) is lower than required by API compatibility
- SemVer policy is enforced continuously, not only at release time

Reference: [Semantic Versioning 2.0.0](https://semver.org/).

---

## EXA Research: Existing SemVer Enforcement Projects and Patterns

I reviewed these projects/docs via EXA and extracted reusable ideas:

1. **API Extractor**
   - Links:
     - https://api-extractor.com/
     - https://api-extractor.com/pages/overview/demo_api_report
   - Pattern to reuse: keep an API signature artifact under version control so API changes are explicit in PRs.

2. **api-extractor-tools (`change-detector`, `changeset-change-detector`)**
   - Link: https://github.com/mike-north/api-extractor-tools
   - Pattern to reuse: compare old/new `.d.ts` surfaces and compute required SemVer bump (`major`/`minor`/`patch`), then validate against declared release metadata.

3. **cargo-semver-checks**
   - Links:
     - https://github.com/obi1kenobi/cargo-semver-checks
     - https://github.com/obi1kenobi/cargo-semver-checks-action
   - Pattern to reuse: baseline comparison + rule-based diagnostics + CI failure before publication.

4. **Revapi (Java ecosystem)**
   - Links:
     - https://revapi.org/revapi-site/main/index.html
     - https://revapi.org/revapi-maven-plugin/0.15.1/index.html
   - Pattern to reuse: policy layer that maps detected changes to allowed version bumps, plus explicit justified ignores.

5. **WIBY (`Will I Break You`)**
   - Link: https://github.com/pkgjs/wiby
   - Pattern to reuse: dependent testing is a useful secondary signal for behavioral breakage (future enhancement).

6. **SemVer for TypeScript Types**
   - Link: https://www.semver-ts.org/appendices/b-tooling.html
   - Pattern to reuse: treat published types as API contract and run type compatibility checks in CI.

7. **typeversion (TypeScript declaration compatibility checker)**
   - Link: https://github.com/kenotron/typeversion
   - Pattern to reuse: compare before/after declaration surfaces directly for release guidance.

8. **ts-semver-detector (TypeScript AST-based classifier)**
   - Link: https://github.com/Bryan-Cee/ts-semver-detector
   - Pattern to reuse: classify change kinds and provide human-readable explanations for why a bump is required.

---

## Iteration 1 (Initial Draft)

### Plan

1. Build declaration output for `base` and `head`.
2. Compare exported API signatures.
3. Parse changed Changeset files to read intended bump.
4. Fail CI when breaking API changes are paired with `patch` or `minor`.

### Initial Deliverables

- `scripts/semver/check.ts` (CLI gate)
- `scripts/semver/compare.ts` (API diff)
- `test/semver-guard.test.ts` (unit tests)
- CI step in `.github/workflows/ci.yml`

### Review of Iteration 1

Gaps found:

- baseline source was underspecified (main branch? merge-base? published npm?)
- naive text diff of `.d.ts` would create false positives/false negatives
- no policy decision for `0.x` versions
- no documented exception process for intentional temporary breakage

---

## Iteration 2 (Improved Draft)

### Improvements Applied

1. **Baseline defined**: use PR merge-base with `origin/<base branch>`.
2. **Comparison method upgraded**: use TypeScript type-assignability checks (not text diff).
3. **Policy file added**: configurable SemVer policy, including pre-1.0 behavior.
4. **Exception path added**: justified, expiring allowlist entries.

### Updated Scope

- first-class objective remains: prevent breaking changes in `patch`/`minor`
- optional strict mode later: also enforce `minor` for additive API changes

### Review of Iteration 2

Remaining gaps:

- reproducibility/performance not yet specified
- report quality needs to be explicit (must tell maintainers exactly what broke)
- rollout path should start non-blocking to measure noise

---

## Iteration 3 (Final Plan)

### 1) Enforcement Contract

- On PRs, compute whether the public API change is breaking.
- Read release intent from changed `.changeset/*.md` files for `@irvinebroque/http-rfc-utils`.
- Pre-1.0 policy for this repository: still require `major` for breaking changes (strict mode, even while on `0.x`).
- Gate rule:
  - if breaking change exists and declared bump is `patch` or `minor`, fail CI
  - if declared bump is `major`, pass SemVer gate
- Optional future strict mode:
  - fail when declared bump is lower than computed required bump (`major > minor > patch`)

### 2) Pure TypeScript Implementation Design

Create `scripts/semver/` modules:

- `check.ts`: CLI entrypoint
- `git.ts`: resolve merge-base and changed files
- `buildDts.ts`: emit declaration-only output for base/head
- `apiModel.ts`: collect exported symbols and signatures
- `compat.ts`: compatibility engine using TypeScript compiler API
- `changesetIntent.ts`: parse changed Changeset files and compute declared bump
- `policy.ts`: enforce rules, allowlist handling, exit code
- `report.ts`: human + JSON output

Implementation choice: use `@microsoft/api-extractor` as a first-class artifact generator, then run a thin in-repo TypeScript policy gate.

- `api-extractor` generates normalized API artifacts for `base` and `head` (prefer `.api.md` report and/or rolled-up `.d.ts`).
- `scripts/semver/*` compares these artifacts and applies SemVer policy against Changesets intent.
- This keeps enforcement logic in-repo while relying on a mature, well-maintained API surface tool.

All custom policy logic remains pure TypeScript.

### 3) Compatibility Algorithm

For each export in old API (`base`) derived from API Extractor artifacts:

1. missing in new API -> breaking
2. present but `new` export type is not assignable to `old` export type -> breaking
3. otherwise compatible

Then classify:

- `breaking = true` if any breaking finding exists
- `breaking = false` otherwise

This directly supports the required gate (`patch`/`minor` cannot include breaking API deltas).

### 4) Changeset Intent Parsing

- Parse only changed `.changeset/*.md` files (excluding `.changeset/README.md`).
- Read frontmatter entries for `@irvinebroque/http-rfc-utils`.
- Compute max declared bump across changed files (`major` > `minor` > `patch`).
- If PR changes code but has no package bump entry, fail with actionable message.

### 5) CI Integration

Add script in `package.json`:

- `"api:extract": "api-extractor run --local"`
- `"semver:check": "tsx scripts/semver/check.ts"`

Add CI step in `.github/workflows/ci.yml` (PR only), after "Ensure changeset exists":

- run `pnpm api:extract` for `head` workspace state
- run `pnpm semver:check -- --base-ref origin/${{ github.event.pull_request.base.ref }}` (script checks out/reads `base`, runs API Extractor for baseline, compares base vs head artifacts)

If exit code is non-zero, PR fails.

### 6) Test Suite Plan

Implement tests in `test/semver-guard.test.ts` plus fixture pairs under `test/fixtures/semver/`.

Minimum fixture coverage:

1. removed export -> breaking
2. renamed export -> breaking
3. optional -> required property change -> breaking
4. added required function parameter -> breaking
5. widened function parameter type -> non-breaking
6. added export only -> non-breaking
7. breaking + patch changeset -> CI fail
8. breaking + minor changeset -> CI fail
9. breaking + major changeset -> pass
10. malformed/empty changeset for package -> fail

### 7) Rollout Strategy

1. **Week 1**: implement comparator + fixtures + local CLI.
2. **Week 2**: run in CI in report-only mode (no fail), collect false positives.
3. **Week 3**: switch to blocking mode for PRs.
4. **Week 4**: decide whether to enable strict mode (`required bump <= declared bump`).

### 8) Acceptance Criteria

- A PR with breaking API changes and `patch` changeset fails.
- A PR with breaking API changes and `minor` changeset fails.
- A PR with breaking API changes and `major` changeset passes this gate.
- Failure output names at least one concrete offending export/signature.
- Gate runs on every PR targeting `main`.

### 9) Future Enhancements

- Add optional API report artifact (API Extractor style) for easier review.
- Add downstream consumer smoke tests (WIBY-like signal).
- Add a small allowlist file with required `justification` and `expiresOn` fields.
