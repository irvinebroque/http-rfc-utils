# Code Reuse and Shared Utilities Implementation Plan

## Goal

Implement all identified code reuse opportunities while preserving behavior and public API shape.

This plan converts the audit recommendations into an execution sequence with explicit dependency ordering and subagent parallelization opportunities.

## Scope

In scope (all recommendations from the audit):

1. Shared delimited parameter parsing primitives
2. Shared media type parsing/formatting internals
3. Shared weighted `q` list parsing scaffolding
4. Shared quoted-string parsing/unquoting variants
5. Shared Structured Field helper primitives
6. Data-driven mapping for `Cache-Status` and `Proxy-Status`
7. Shared numeric directive parsing helpers
8. Shared heterogeneous header access helper (`Request | Headers | Record`)
9. Shared low-level percent-encoding helpers
10. Shared JSON object shape extraction helpers
11. Replace manual `Vary` merge logic in CORS with `mergeVary`

Out of scope:

- RFC semantic rewrites or behavior changes
- Public API redesigns
- Large module moves unrelated to reuse

## Constraints and Safety Rules

- Keep `src/index.ts` exports stable unless explicitly planned and documented.
- Keep parser permissiveness/strictness semantics unchanged per module.
- Avoid over-abstraction: share lexical/util primitives, keep RFC policy logic local.
- Each migration step must be covered by tests before proceeding.

## Recommendation to Workstream Mapping

### WS1 - Shared parsing primitives (`src/header-utils.ts`, new internal helpers)

- Delimited parameter tokenization/reuse (Recommendation 1)
- Quoted-string strict/lenient reuse (Recommendation 4)
- Numeric directive parse helpers (Recommendation 7)
- Header lookup helper for mixed input types (Recommendation 8)

### WS2 - Header/media parsing convergence

- Media type parsing/formatting convergence (Recommendation 2)
- Weighted `q` list parsing scaffold (Recommendation 3)

### WS3 - Structured Field helper consolidation

- Shared `isSfItem` and header normalization helpers (Recommendation 5)
- Schema-driven param mapping for cache/proxy status (Recommendation 6)

### WS4 - Encoding and object-shape helper reuse

- Percent encoding byte/hex utility reuse (Recommendation 9)
- Shared JSON shape extraction helpers for host-meta/webfinger (Recommendation 10)

### WS5 - Quick win and consistency pass

- CORS `Vary` merge via `mergeVary` (Recommendation 11)
- Final duplication sweep and cleanup

## Implementation Phases

## Phase 0 - Baseline and Guardrails

1. Capture baseline behavior and duplication hotspots referenced in this plan.
2. Lock test baseline:
   - `pnpm test`
   - `pnpm check:structure`
   - `pnpm typecheck`
3. Add temporary migration checklist in PR notes to ensure semantics are unchanged.

Acceptance:

- Baseline commands pass.
- No code changes yet, only planning artifacts and tracking.

## Phase 1 - Introduce Shared Internal Primitives (No Call-Site Changes)

1. Add internal helpers for:
   - delimited split + key/value extraction skeleton
   - strict quoted-string parse + lenient unquote
   - numeric parse helpers (unsigned int/delta-seconds variants)
   - mixed-input header getters (`Request | Headers | Record`)
2. Add tests for helper behavior in isolation.
3. Do not migrate existing modules in this phase.

Acceptance:

- New helper tests pass.
- Existing tests unchanged and green.

## Phase 2 - Migrate Header and Media Parsers Incrementally

1. Migrate modules that currently duplicate delimited/key-value parsing:
   - `src/prefer.ts`
   - `src/forwarded.ts`
   - `src/content-disposition.ts`
   - `src/cache.ts`
   - `src/hsts.ts`
   - `src/alt-svc.ts`
   - `src/patch.ts`
2. Converge media type internals between:
   - `src/negotiate.ts`
   - `src/patch.ts`
3. Introduce shared weighted `q` list scaffolding and migrate:
   - `src/encoding.ts`
   - `src/language.ts`
   - relevant parsing path in `src/negotiate.ts`

Acceptance:

- Behavior parity with existing tests.
- No parser semantic regressions (invalid input handling must stay unchanged).

## Phase 3 - Structured Field Refactor

1. Consolidate repeated SF helper functions (`isSfItem`, header normalization) across:
   - `src/priority.ts`
   - `src/targeted-cache-control.ts`
   - `src/compression-dictionary.ts`
2. Refactor `Cache-Status` and `Proxy-Status` to data-driven field schemas:
   - `src/cache-status.ts`
   - `src/proxy-status.ts`
3. Keep schemas explicit per RFC in each module; share only mapper mechanics.

Acceptance:

- All status header tests remain green.
- Extension parameter behavior preserved.

## Phase 4 - Encoding and JSON Shape Consolidation

1. Extract low-level percent-encoding byte/hex helpers reused by:
   - `src/uri.ts`
   - `src/uri-template.ts`
   - adjacent hex encoding usage in `src/ext-value.ts` and `src/json-pointer.ts`
2. Extract JSON shape helpers and migrate:
   - `src/webfinger.ts`
   - `src/host-meta.ts`
3. Keep module-level semantics and validation rules local.

Acceptance:

- URI, URI template, ext-value, json-pointer tests unchanged and passing.
- Host-meta/WebFinger parse behavior unchanged for malformed input pathways.

## Phase 5 - Quick Win, Final Cleanup, and Documentation

1. Replace manual CORS `Vary` merge block with `mergeVary`:
   - `src/cors.ts`
2. Remove dead/duplicated helpers made obsolete by migration.
3. Update docs comments where internals changed significantly.
4. Run full validation gates:
   - `pnpm check:structure`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
5. If API shape changed unexpectedly, run:
   - `pnpm api:extract`
   - `pnpm semver:check`

Acceptance:

- Full validation green.
- No unplanned API or behavior deltas.

## Subagent Parallelization Plan

This work can be parallelized safely in waves with dependency boundaries.

## Wave A (parallel, independent foundational work)

- Subagent A1: Add shared numeric + header-input helpers
- Subagent A2: Add shared quoted-string strict/lenient helpers
- Subagent A3: Add SF helper primitives (`isSfItem`, normalization helpers)

Merge prerequisite:

- All foundational helper PRs/tests green before migration waves begin.

## Wave B (parallel by module clusters)

- Subagent B1: Header parser migrations (`prefer`, `forwarded`, `content-disposition`, `hsts`)
- Subagent B2: Media and weighted parsing (`negotiate`, `encoding`, `language`, `patch`)
- Subagent B3: Structured Field consumers (`priority`, `targeted-cache-control`, `compression-dictionary`)

Merge prerequisite:

- Rebase B waves on Wave A helper APIs.

## Wave C (parallel, mostly isolated)

- Subagent C1: Status schema refactor (`cache-status`, `proxy-status`)
- Subagent C2: Percent-encoding helper extraction (`uri`, `uri-template`, `ext-value`, `json-pointer`)
- Subagent C3: JSON shape helper extraction (`webfinger`, `host-meta`)

Merge prerequisite:

- Wave B complete for shared parser API stability.

## Wave D (single quick-win lane)

- Subagent D1: CORS `mergeVary` migration and final cleanup.

## Coordination Notes for Subagents

- Define helper contracts first; freeze signatures for one wave.
- Use module ownership split to avoid overlapping file edits.
- Require each subagent PR to include behavior-parity test updates.
- Run full gate commands on integration branch after each wave.

## Risks and Mitigations

- Risk: over-abstraction hides RFC semantics.
  - Mitigation: share lexical primitives only; keep semantic decisions in modules.
- Risk: subtle parser behavior drift.
  - Mitigation: migrate one module at a time with focused tests and fixture parity checks.
- Risk: merge conflicts from broad touch points.
  - Mitigation: wave-based subagent partitioning and helper API freeze.

## Deliverables

- Refactored internal helper layer for reuse
- Reduced duplicate parsing/encoding logic across modules
- Preserved API and behavior
- Updated plan artifact (this file) and PR wave checklist
