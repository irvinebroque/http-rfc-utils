# OpenAPI 3.1.1 Implementation Plan: Standards Patterns for HTTP/API Utilities

- Spec: https://spec.openapis.org/oas/v3.1.1.html
- Scope type: phased utility suite (OpenAPI-focused helpers, not a full OpenAPI parser)
- Repo fit: API/server/worker interoperability helpers built on existing RFC utilities

## 1) Goals and Non-Goals

- Goals:
  - Add a high-value OpenAPI utility suite that maps directly to spec semantics most teams implement repeatedly.
  - Reuse existing repo primitives (`uri-template`, `json-pointer`, auth/header modules) instead of reimplementing RFC behavior.
  - Keep parser helpers tolerant (`null`/issues for malformed inputs) and formatter/validator helpers strict (throwing with precise errors).
  - Deliver in small, reviewable phases with subagent implementation + subagent critique loops.
- Non-goals:
  - Full OpenAPI document parser/validator replacement for existing ecosystem tools.
  - Token/JWT verification, OAuth introspection, network fetches, or remote policy engines.
  - Full JSON Schema validation engine (schema-aware coercion can be a later optional phase).

## 2) Why These OpenAPI Patterns

This plan prioritizes features that are both high-impact and semantically tricky in OpenAPI 3.1.1:

- Parameter serialization styles (`style`, `explode`, `allowReserved`) and location-aware parsing/formatting.
- Runtime expression evaluation used by Link and Callback objects.
- Security Requirement semantics (AND within an object, OR across list entries, `{}` for anonymous access).
- Path matching and server URL resolution precedence.
- Lint rules for common interoperability failures.

## 3) Proposed Module Layout

- New facade and decomposition:
  - `src/openapi.ts`
  - `src/openapi/index.ts`
  - `src/openapi/parameter-serialization.ts`
  - `src/openapi/runtime-expression.ts`
  - `src/openapi/link-callback.ts`
  - `src/openapi/security-requirements.ts`
  - `src/openapi/path-server-resolver.ts`
  - `src/openapi/lint.ts`
  - deferred: `src/openapi/ref-resolution.ts`
- Types:
  - `src/types/openapi.ts`
  - re-export from `src/types/shared.ts`
- Public exports:
  - `src/index.ts` (sectioned OpenAPI exports)
  - optional discoverability export in `src/security/index.ts` and `src/linking/index.ts` for domain-adjacent helpers
- Tests:
  - `test/openapi-parameter-serialization.test.ts`
  - `test/openapi-runtime-expression.test.ts`
  - `test/openapi-link-callback.test.ts`
  - `test/openapi-security-requirements.test.ts`
  - `test/openapi-path-server-resolver.test.ts`
  - `test/openapi-lint.test.ts`
  - deferred: `test/openapi-ref-resolution.test.ts`

## 4) Subagent Execution Framework (Per Step)

Each phase step uses two subagent passes:

1. Implementation pass: `general` or `explore` subagent produces a concrete file-by-file change plan.
2. Critique pass: separate `general` (or `docs` for doc-heavy work) subagent audits edge cases, test gaps, and semver/API risks.

Definition of done per step:

- Implementation deliverable is accepted only after critique findings are resolved or explicitly deferred.
- Every step ends with a crisp acceptance checklist and mapped tests.

## 5) Phased Plan

## Phase 0 - Foundation and Scaffolding

### Objective

Create OpenAPI suite structure, stable type contracts, and export wiring before behavior modules.

### Subagent Steps

- Step 0.1 (Implementation subagent: `explore`)
  - Confirm integration points and update plan for actual repo state at execution time.
  - Output: concrete file creation/modification map.
- Step 0.2 (Implementation subagent: `general`)
  - Define `src/types/openapi.ts` baseline types shared across all phases.
  - Output: type model and naming consistency plan.
- Step 0.3 (Critique subagent: `general`)
  - Review type boundaries for semver stability and avoid over-broad unions.
  - Output: narrowed/adjusted type surface recommendations.

### Deliverables

- OpenAPI facade/barrel scaffold files.
- Type export wiring in `src/types/shared.ts` and `src/index.ts`.
- Structure check updates in `scripts/check-structure.mjs` so CI guards the new suite layout.

### Acceptance Criteria

- `pnpm check:structure` passes with new facade rules.
- `pnpm typecheck` passes before adding behavior modules.

## Phase 1 - Parameter Serialization and Parsing (MVP Core)

### Objective

Implement deterministic OpenAPI Parameter Object helpers for `schema` strategy with style/location semantics.

### Subagent Steps

- Step 1.1 (Implementation subagent: `general`)
  - Define public API for normalize/format/parse across query/path/header/cookie contexts.
  - Include defaulting rules for style/explode/allowReserved.
- Step 1.2 (Implementation subagent: `general`)
  - Implement style codecs: `simple`, `form`, `matrix`, `label`, `pipeDelimited`, `spaceDelimited`, `deepObject`.
  - Include strict validation for unsupported/undefined combinations.
- Step 1.3 (Critique subagent: `general`)
  - Audit delimiter handling, percent-encoding, and ambiguous cases (`deepObject` + `explode=false`, non-query `allowReserved`).

### Deliverables

- `src/openapi/parameter-serialization.ts`
- Type additions in `src/types/openapi.ts`
- Test suite `test/openapi-parameter-serialization.test.ts`

### Required Behaviors

- Parse helpers return `null` on malformed syntax/shape.
- Formatter/normalizer helpers throw `Error` with parameter context.
- Deterministic formatting:
  - stable object-key order
  - stable repeated query key ordering
  - uppercase percent-hex output

### MVP Boundaries

- Include primitive, array, and one-level object values.
- Exclude deep nested object serialization and full `content`-strategy parameter handling (defer).

### Acceptance Criteria

- Style matrix tests pass for primitive/array/object cases.
- Edge tests cover `allowReserved`, malformed percent encoding, and parse/format round-trip where defined.

## Phase 2 - Runtime Expressions + Link/Callback Materialization

### Objective

Implement runtime expression parser/evaluator and use it to materialize Link Object values and Callback URLs.

### Subagent Steps

- Step 2.1 (Implementation subagent: `general`)
  - Implement runtime expression parser/evaluator for:
    - `$url`, `$method`, `$statusCode`
    - `$request.path.*`, `$request.query.*`, `$request.header.*`, `$request.body#...`
    - `$response.header.*`, `$response.body#...`
- Step 2.2 (Implementation subagent: `general`)
  - Implement link materialization helper:
    - resolve expression-valued `parameters`
    - resolve expression/literal `requestBody`
    - collect issues for unresolved/malformed expressions.
- Step 2.3 (Implementation subagent: `general`)
  - Implement callback key resolver from runtime expression to URL.
- Step 2.4 (Critique subagent: `general`)
  - Validate failure semantics (`undefined` vs throw) and JSON Pointer parity.

### Deliverables

- `src/openapi/runtime-expression.ts`
- `src/openapi/link-callback.ts`
- `test/openapi-runtime-expression.test.ts`
- `test/openapi-link-callback.test.ts`

### Integration Notes

- Reuse `src/json-pointer.ts` for pointer parsing/evaluation.
- Keep default mode tolerant: collect issues, avoid throwing on ordinary missing runtime data.

### Acceptance Criteria

- Expression parser rejects malformed syntax with `null`.
- Evaluator returns `undefined` for absent runtime values, not throws.
- Link/callback helpers produce deterministic issue lists and partial outputs.

## Phase 3 - Security Requirements Evaluation

### Objective

Implement OpenAPI Security Requirement evaluation semantics with explicit non-goals around token verification.

### Subagent Steps

- Step 3.1 (Implementation subagent: `general`)
  - Implement parse/normalize/validate/evaluate helpers for Security Requirement Objects.
- Step 3.2 (Implementation subagent: `general`)
  - Implement precedence resolver for global vs operation-level security.
- Step 3.3 (Implementation subagent: `general`)
  - Add scheme metadata and credential contracts for `apiKey`, `http`, `oauth2`, `openIdConnect`, `mutualTLS`.
- Step 3.4 (Critique subagent: `general`)
  - Verify AND/OR semantics, `{}` anonymous behavior, and scope matching edge cases.

### Deliverables

- `src/openapi/security-requirements.ts`
- `test/openapi-security-requirements.test.ts`

### Required Behaviors

- AND within each requirement object.
- OR across requirement objects in array.
- `{}` grants anonymous access.
- Tolerant parse path and strict validate path.

### Non-Goals (Explicit)

- No JWT signature verification.
- No OAuth introspection/network calls.
- No external policy engine calls.

### Acceptance Criteria

- Precedence tests pass for root vs operation security.
- Scope satisfaction/missing diagnostics are deterministic.
- Unknown scheme handling is configurable (tolerant warning vs strict error).

## Phase 4 - Path Matching + Server Resolution

### Objective

Implement path/template matching and server URL resolution helpers aligned to OpenAPI precedence rules.

### Subagent Steps

- Step 4.1 (Implementation subagent: `general`)
  - Implement path matcher with concrete-over-templated precedence and param extraction.
- Step 4.2 (Implementation subagent: `general`)
  - Implement server resolution with operation > path > root server precedence.
- Step 4.3 (Implementation subagent: `general`)
  - Implement server variable substitution with default + enum validation.
- Step 4.4 (Critique subagent: `general`)
  - Audit ambiguous path-template behavior and relative server URL edge cases.

### Deliverables

- `src/openapi/path-server-resolver.ts`
- `test/openapi-path-server-resolver.test.ts`

### Acceptance Criteria

- Path precedence tests pass (`/pets/mine` over `/pets/{id}`).
- Template collisions are detected for lint phase reuse.
- Server precedence and variable resolution tests pass for root/path/operation layers.

## Phase 5 - Lint Rules (High-Value Interoperability Checks)

### Objective

Implement non-throwing linter utilities that surface common OpenAPI interoperability defects.

### Subagent Steps

- Step 5.1 (Implementation subagent: `general`)
  - Implement diagnostics model (`code`, `severity`, `pointer`, `message`, `relatedPointers`).
- Step 5.2 (Implementation subagent: `general`)
  - Implement MVP rules:
    - duplicate `operationId`
    - missing required path params / param-template mismatches
    - `schema` + `content` conflicts in parameters
    - invalid parameter `content` media map cardinality
    - invalid extension key prefix handling (`x-`)
    - invalid components key regex
    - path template collisions
- Step 5.3 (Critique subagent: `docs`)
  - Validate clarity/actionability of diagnostics and recommend severity defaults.

### Deliverables

- `src/openapi/lint.ts`
- `test/openapi-lint.test.ts`

### Acceptance Criteria

- Lint output is deterministic and stable for snapshot testing.
- Rules can be enabled/disabled and severity-overridden.

## Phase 6 - Deferred Advanced: Multi-Document Ref + Implicit Connections

### Objective

Add advanced graph-based resolution for multi-document OpenAPI descriptions.

### Subagent Steps

- Step 6.1 (Implementation subagent: `general`)
  - Build a bounded `$ref` resolution graph API.
- Step 6.2 (Implementation subagent: `general`)
  - Add implicit connection diagnostics (`operationId`, security scheme name lookup, callback/link cross-document ambiguity).
- Step 6.3 (Critique subagent: `general`)
  - Threat-model recursion, graph explosion, and remote loader risk controls.

### Deliverables

- `src/openapi/ref-resolution.ts` (experimental namespace)
- `test/openapi-ref-resolution.test.ts`

### Acceptance Criteria

- Cycles and unresolved references yield diagnostics, not crashes.
- Depth limits and loader policy are explicit and tested.

## 6) Cross-Phase Documentation and API Map Updates

After each shipped phase:

- Update `README.md`:
  - add OpenAPI utilities to imports-by-task table
  - add coverage bullet for OpenAPI 3.1.1 utilities
- Update `docs/src/lib/rfc-map.ts` with module + sections + exports.
- Update `docs/reference/rfc-map.md` and `docs/reference/imports-by-task.md`.
- Keep this plan file current with delivered/deferred scope.

## 7) PR Slicing Strategy

- PR 1: Phase 0 + Phase 1
- PR 2: Phase 2
- PR 3: Phase 3
- PR 4: Phase 4
- PR 5: Phase 5
- PR 6: Phase 6 (experimental/deferred)

Each PR includes:

- code + tests + docs updates for the phase
- no unrelated refactors
- changeset entry when user-facing exports are added

## 8) Test and Quality Gates (Per PR)

Run at minimum:

- `pnpm check:structure`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

For export-shape or semver-sensitive phases (1-5), also run:

- `pnpm typecheck:all`
- `pnpm typecheck:strict`
- `pnpm typecheck:lib`
- `pnpm api:extract`
- `pnpm semver:check`

## 9) Risk Register and Mitigations

- Undefined/implementation-defined corners in OpenAPI serialization:
  - mitigate with strict MVP boundaries + explicit diagnostics.
- Encoding ambiguities (`allowReserved`, form/query edge cases):
  - centralize encoding policy and include exhaustive edge tests.
- API surface growth risk:
  - keep phase-scoped exports small and review with critique subagent before merge.
- Multi-document resolver complexity:
  - keep as deferred experimental phase with bounded loader/depth policies.

## 10) Deliverable Summary

By the end of Phase 5, this repo will provide a practical OpenAPI 3.1.1 utility layer for API teams, with deterministic behavior, strong tests, and an RFC-style ergonomics model consistent with existing modules.
