# Security Review and Fuzzing Plan

## Goal

Build a repeatable security review and fuzzing program for `@irvinebroque/http-rfc-utils` that catches parser/formatter vulnerabilities early, reduces regression risk, and becomes faster each release through reusable tooling.

## Dependency decision

Use `fast-check` as the canonical fuzz/property engine for this program. Favor `fast-check` capabilities (seeded runs, shrinking, replay) over custom fuzz generation/minimization logic unless there is a proven gap.

## Plan v1 (Initial Draft)

### 1) Baseline and scope

1. Freeze a baseline commit SHA and dependency lockfile snapshot.
2. Confirm current quality gates pass:
   - `pnpm check:structure`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
3. Define in-scope security classes:
   - header injection and control-byte handling
   - parser crash and denial-of-service risks (complexity, recursion, regex)
   - prototype pollution / special-key hazards
   - unsafe defaults in auth/cors helpers
   - dependency and supply-chain risk

### 2) Threat model + attack surface inventory

1. Enumerate all parse/format entry points exported from `src/index.ts`.
2. Classify each module by risk level:
   - High: complex parsers and evaluator logic (`structured-fields`, `jsonpath`, `link`, `forwarded`, `content-disposition`, `http-signatures`, `trace-context`).
   - Medium: stateful helpers and auth/cors behavior (`response`, `auth/*`, `cors`, `cookie`, `security-txt`).
   - Low: mostly deterministic formatters/builders with narrow input space.
3. For each high/medium target, document:
   - trusted vs untrusted inputs
   - intended failure mode (`null`, empty result, throw)
   - resource bounds expectations (depth, size, regex, loops)

### 3) Manual security review pass

1. Run a checklist-based code review against each high/medium target:
   - CRLF/CTL validation before header interpolation
   - regex safety and bounded execution
   - object key handling (`__proto__`, `constructor`, `prototype`)
   - parse error handling consistency
   - dangerous default behavior that should be opt-in
2. Record findings in a structured register (`id`, severity, module, trigger, impact, fix strategy).
3. Add deterministic regression tests for confirmed issues before or with fixes.

### 4) Fuzzing campaign

1. Start with deterministic, reproducible fuzzing using `fast-check` executed from `node:test`.
2. Use two fuzzing modes:
   - generator fuzzing from RFC grammar-informed `fast-check` arbitraries
   - mutation fuzzing from seed corpus (RFC examples + known edge cases) wrapped in `fast-check`
3. Prioritize fuzz targets:
   - parsers: `parseStructuredField*`, `parseLinkHeader`, `parseForwarded`, `parseContentDisposition`, `parseTraceparent`, `parseTracestate`, `parseJsonPath` and evaluator entrypoints
   - serializers/formatters: `formatLinkHeader`, `formatContentDisposition`, `formatForwarded`, `formatSetCookie`, response header composition paths
4. Enforce core invariants:
   - no hangs or unbounded runtime
   - no uncaught exceptions for non-throwing parse APIs
   - no control bytes in serialized header output
   - round-trip properties where defined (parse/format stability)
5. Persist crashing inputs and `fast-check` replay metadata (`seed`, `path`) to a corpus directory and replay them in CI.

### 5) CI integration + reporting

1. Add commands:
   - `pnpm security:review` (static/security checklist runner)
   - `pnpm fuzz:quick` (small deterministic seed set for PRs)
   - `pnpm fuzz:full` (larger nightly run)
   - `pnpm security:ci` (review + quick fuzz + baseline tests)
2. Add nightly workflow for long fuzz runs with artifacts for crashes.
3. Publish a monthly security report with:
   - new findings
   - fixed findings
   - top flaky/high-cost fuzz targets

### 6) Reusable utilities to speed future reviews

1. Shared `fast-check` harness (`test/fuzz/fast-check-harness.ts`) with:
   - common `fast-check` config (`seed`, `path`, `numRuns`, `endOnFailure`)
   - common target interface (`arbitrary`, `execute`, `assertInvariant`)
   - automatic failure artifact writing with replay command
2. Shared invariants library (`test/fuzz/invariants.ts`) for:
   - non-throwing parse behavior checks
   - no-CTL serialization checks
   - prototype safety checks
   - parse-format idempotence helpers
3. Corpus utilities:
   - `scripts/fuzz/replay-fast-check.mjs`
   - `scripts/fuzz/promote-counterexample.mjs`
   - per-module corpus folders under `test/fuzz/corpus/`
4. Security review scaffolding:
   - `scripts/security/risk-register.mjs`
   - `docs/security/review-template.md`
   - `docs/security/finding-template.md`

### 7) Exit criteria

1. Every high-risk module has checklist coverage and at least one fuzz target.
2. Quick fuzz suite runs in CI under 2-3 minutes.
3. Full fuzz suite runs nightly and archives crashes.
4. Findings are tracked with severity and remediation status.
5. Security regression tests are part of standard `pnpm test`.

## Self-review critique of v1

### Strengths

1. Covers both manual review and fuzzing instead of fuzz-only.
2. Includes deterministic replay and corpus persistence.
3. Identifies reusable tooling to reduce repeated setup work.

### Gaps

1. Lacks explicit severity model and remediation SLA, which can stall triage.
2. Lacks phased milestones and ownership boundaries.
3. Does not define measurable target onboarding order beyond broad priority.
4. Assumes commands/utilities but does not map concrete deliverables to each phase.
5. Mentions static review but not dependency/vulnerability automation detail.

## Plan v2 (Improved)

This v2 plan addresses the gaps above and is the implementation plan to follow.

### Phase 0: Program setup (Day 0-1)

**Deliverables**

1. `docs/security/security-review-2026Q1.md` (scope, assumptions, risk rubric).
2. `docs/security/finding-template.md` and `docs/security/review-template.md`.
3. Risk rubric:
   - Critical: remote exploit or broad compromise
   - High: reliable DoS/injection or major trust boundary break
   - Medium: constrained abuse or unsafe default requiring specific setup
   - Low: hard-to-trigger edge case

**Tasks**

1. Build module inventory and assign owner + reviewer per risk tier.
2. Define SLA targets:
   - Critical/High: triage in 24h, fix plan in 72h
   - Medium: triage in 5 business days
   - Low: backlog with justification
3. Capture baseline command outputs and store links in the review doc.

### Phase 1: Structured review sweep (Day 1-3)

**Deliverables**

1. Completed checklist for all high-risk modules.
2. Initial finding register (`temp/security/findings.json` or equivalent tracked artifact).

**Tasks**

1. Perform code review using fixed checklist categories:
   - Input validation and canonicalization
   - Runtime/resource bounds
   - Error semantics and throw/null consistency
   - Injection-safe serialization
   - Prototype-safe dynamic maps
   - Cryptographic and policy defaults
2. Run dependency checks:
   - `pnpm audit`
   - lockfile drift and stale package review
3. Convert each confirmed issue into a test case plan (regression-first).

### Phase 2: Reusable fuzzing foundation (Day 3-5)

**Deliverables**

1. `test/fuzz/fast-check-harness.ts` shared runner wrappers around `fast-check`.
2. `test/fuzz/invariants.ts` shared assertions.
3. `test/fuzz/corpus/` seed corpus structure.
4. `scripts/fuzz/replay-fast-check.mjs` and `scripts/fuzz/promote-counterexample.mjs`.

**Tasks**

1. Implement deterministic seeded execution via `fast-check` options (`seed`, `path`, `numRuns`).
2. Standardize fuzz target contract:
   - `name`
   - `arbitrary` (generator or corpus-backed mutator)
   - `execute(input)`
   - `assertInvariant(result, input)`
3. Add automatic crash artifact persistence including target, `fast-check` `seed/path`, and shrunken counterexample.
4. Keep fuzz tests compatible with `node:test` conventions used in this repo.

### Phase 3: High-risk target onboarding (Day 5-8)

**Tier 1 targets (first)**

1. `structured-fields` parser/serializer.
2. `jsonpath` parser + evaluator.
3. `link`, `forwarded`, `content-disposition` parse/format.
4. `trace-context` and `http-signatures` parsing paths.

**Tier 2 targets (second)**

1. `cookie`, `response`, `cors`, `security-txt`, `host-meta`, `webfinger`.

**Invariants to enforce per target**

1. Bounded runtime and memory under configured iteration limits.
2. Correct non-throwing behavior for safe-parse APIs.
3. No control characters in emitted header values.
4. Round-trip or normalization stability where RFC behavior defines it.

### Phase 4: CI and nightly automation (Day 8-10)

**Deliverables**

1. `package.json` scripts:
   - `security:review`
   - `fuzz:quick`
   - `fuzz:full`
   - `security:ci`
2. CI integration:
   - PR: `pnpm security:ci`
   - Nightly: `pnpm fuzz:full` with artifact upload

**Targets**

1. `fuzz:quick` <= 3 minutes on CI hardware.
2. `fuzz:full` >= 10x quick iterations across Tier 1+2 targets.
3. Crash artifacts include replay command with `fast-check` `seed/path` and shrunken input.

### Phase 5: Remediation loop and hardening cadence (ongoing)

**Deliverables**

1. Monthly security status update in `docs/security/`.
2. Updated `AUDIT.md` section for notable security behavior changes.
3. Persistent regression corpus from every resolved finding.

**Tasks**

1. Triage findings by severity rubric and SLA.
2. For each fix: add regression test + corpus sample + short rationale note.
3. Review fuzz target effectiveness quarterly (hang rate, unique crash rate, time cost).

## Definition of done

1. All Tier 1 modules have checklist review + fuzz coverage + replayable corpus.
2. Tier 2 modules have at least quick fuzz coverage and checklist review.
3. Security commands are documented and runnable in CI and locally.
4. Every confirmed security bug has a deterministic regression test.
5. The reusable `fast-check` harness/invariants/corpus tooling is in place so future RFC additions can onboard a new fuzz target in under 30 minutes.
6. Any fuzz failure is reproducible locally from recorded `fast-check` `seed/path`.
