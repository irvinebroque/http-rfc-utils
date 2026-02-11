# TypeScript Type Precision Audit

Date: 2026-02-10
Repository: `http-rfc-utils`

## Scope And Audit Method

- Exhaustive scope scanned:
  - `src/**/*.ts` (117 files)
  - `scripts/**/*.ts` (9 files)
  - `docs/**/*.ts` (1 file)
  - `test/**/*.ts` (88 files)
  - `test/**/*.d.ts` (12 files)
  - Total: 227 TypeScript files
- Audit strategy:
  - Parallel deep file review with subagents by module family (`src/types`, OpenAPI/JSONPath, auth/security, linking/networking, scripts/tests)
  - Repo-wide pattern sweeps for type-risk indicators (`as` assertions, `Record<string, unknown>`, `JSON.parse`, restrictive generic bounds)
  - Manual verification of high-signal findings with file/line evidence
- Pattern baseline (repo-wide):
  - `as` assertions: 443
  - `Record<string, unknown>` usages: 74
  - `JSON.parse(...)` call sites: 29
  - `extends Record<string, unknown>` generic constraints: 4

## Executive Summary

- High-impact issues: 7
- Medium-impact issues: 17
- Low-impact opportunities: 10
- Most important themes:
  - Several core parser contracts are modeled too loosely and rely on unsafe assertions at trust boundaries.
  - A few public type models can be made materially stricter (OpenAPI, JSONPath, cache models) without changing runtime behavior.
  - Repeated cast-based narrowing patterns can be replaced with reusable type guards and readonly-friendly signatures.

## High-Impact Findings

### H1) Structured field schema core loses key/value type coupling

- Files: `src/structured-field-schema.ts:15`, `src/structured-field-schema.ts:18`, `src/structured-field-schema.ts:19`, `src/structured-field-schema.ts:32`, `src/structured-field-schema.ts:52`
- Current pattern:
  - Schema callbacks are `(value) => unknown` and `(value: unknown) => SfBareItem`.
  - Builder uses `const result = {} as T` and index assignment through `Record<string, unknown>`.
- Why this matters:
  - This utility is shared by multiple RFC modules (`Cache-Status`, `Proxy-Status`) and currently forces downstream casts.
  - Compile-time mismatch between parse/format and property type is not caught.
- Recommendation:
  - Make schema entry value-typed (`parse: (...) => T[K] | undefined`, `format: (value: T[K]) => SfBareItem`).
  - Build via `Partial<T>` + typed key assignment helper; only finalize once complete.

### H2) JSONPath singular query is constructed from non-singular segments

- Files: `src/jsonpath/parser.ts:381`, `src/jsonpath/parser.ts:384`, `src/jsonpath/parser.ts:473`, `src/jsonpath/parser.ts:476`, `src/types/jsonpath.ts:149`
- Current pattern:
  - `JsonPathSingularQuery` is created from `query.segments` without enforcing singular-only segment constraints.
  - Type model allows `segments: JsonPathSegment[]` for singular query.
- Why this matters:
  - Can represent invalid singular query states in the AST.
  - Pushes correctness burden to runtime behavior instead of type system.
- Recommendation:
  - Introduce singular-segment type subset and validate before constructing singular query nodes.

### H3) `Linkset` type guard is structurally incomplete but returns strong type

- Files: `src/linkset.ts:168`, `src/linkset.ts:172`, `src/linkset.ts:431`, `src/linkset.ts:462`, `src/linkset.ts:481`
- Current pattern:
  - `isValidLinkset` validates top-level shape and required `href`, then `parseLinksetJson` returns original `obj` as `Linkset`.
  - Full `LinksetTarget` member value domains are not fully validated.
- Why this matters:
  - Consumers get a strong `Linkset` type that may still contain runtime-invalid target members.
- Recommendation:
  - Either fully validate target member domains in guard, or normalize into a newly constructed validated object before returning.

### H4) `parseApiCatalog` uses assertion-based `profile` typing

- Files: `src/linkset.ts:587`, `src/linkset.ts:594`, `src/linkset.ts:597`
- Current pattern:
  - `(input as { profile: string }).profile` and `return linkset as ApiCatalog`.
- Why this matters:
  - Non-string profile values can flow into typed results as `string`.
- Recommendation:
  - Narrow `profile` with `typeof profile === 'string'` before assignment.
  - Return validated shape without `as ApiCatalog`.

### H5) OpenAPI runtime expression model is under-discriminated

- Files: `src/types/openapi.ts:86`, `src/types/openapi.ts:88`, `src/types/openapi.ts:89`, `src/openapi/runtime-expression.ts:113`, `src/openapi/runtime-expression.ts:115`, `src/openapi/runtime-expression.ts:117`, `src/openapi/runtime-expression.ts:121`
- Current pattern:
  - Single interface with optional `name` and `pointer` for all expression kinds.
  - Runtime code compensates with fallbacks like `parsed.name ?? ''`.
- Why this matters:
  - Impossible states are type-representable; failures are deferred to runtime.
- Recommendation:
  - Split into discriminated union keyed by `type`, requiring `name` or `pointer` only where valid.

### H6) OpenAPI apiKey security scheme allows invalid location

- File: `src/types/openapi.ts:142`
- Current pattern:
  - `OpenApiApiKeySecurityScheme.in?: OpenApiParameterLocation` includes `'path'`.
- Why this matters:
  - OpenAPI apiKey location should be `query | header | cookie`.
- Recommendation:
  - Narrow `in` accordingly; if compatibility is needed, add strict companion type and migrate internals first.

### H7) Cursor decode uses untyped JSON parse result

- Files: `src/pagination.ts:33`, `src/pagination.ts:35`, `src/pagination.ts:47`
- Current pattern:
  - `const parsed = JSON.parse(decoded);` then direct `parsed.offset` access.
- Why this matters:
  - `JSON.parse` returns `any`; this bypasses strict narrowing and weakens trust-boundary safety.
- Recommendation:
  - Parse into `unknown`, guard shape, then read `offset`.

## Medium-Impact Findings

### M1) Restrictive generic bounds reduce API ergonomics

- Files: `src/sorting.ts:48`, `src/sorting.ts:50`, `src/sorting.ts:60`, `src/sorting.ts:127`, `src/negotiate.ts:407`, `src/negotiate.ts:421`, `src/response.ts:162`
- Current pattern:
  - `T extends Record<string, unknown>` for sort/CSV utilities and record-cast index access.
- Recommendation:
  - Prefer `T extends object` and perform guarded dynamic indexing internally.

### M2) Avoidable sort direction assertions

- File: `src/sorting.ts:38`, `src/sorting.ts:43`
- Current pattern: `'desc' as SortDirection` and `'asc' as SortDirection`.
- Recommendation: rely on literal inference directly.

### M3) OpenAPI parameter spec normalization can be type-driven

- Files: `src/openapi/parameter-serialization.ts:41`, `src/openapi/parameter-serialization.ts:52`, `src/openapi/parameter-serialization.ts:62`, `src/openapi/parameter-serialization.ts:74`, `src/openapi/parameter-serialization.ts:87`
- Current pattern:
  - Runtime validates incompatible `in/style/valueType/explode` combinations.
- Recommendation:
  - Introduce discriminated normalized spec unions to encode legal combinations in types.

### M4) Path matcher loses method/path item precision

- Files: `src/openapi/path-server-resolver.ts:54`, `src/openapi/path-server-resolver.ts:460`, `src/openapi/path-server-resolver.ts:592`, `src/openapi/path-server-resolver.ts:597`, `src/types/openapi.ts:340`, `src/types/openapi.ts:348`, `src/types/openapi.ts:349`
- Current pattern:
  - `Record<string, unknown>` path items and `Set<string>` operation methods.
- Recommendation:
  - Use `OpenApiPathItemObjectLike` and `OpenApiPathItemHttpMethod` in method sets and candidate models.

### M5) Link callback materialization erases parameter shape

- Files: `src/openapi/link-callback.ts:28`, `src/openapi/link-callback.ts:34`, `src/openapi/link-callback.ts:146`, `src/openapi/link-callback.ts:152`
- Current pattern:
  - Materialized `parameters: Record<string, unknown>` with generic resolver returning `unknown`.
- Recommendation:
  - Add generic key-preserving materialization type for parameter map.

### M6) Additional OpenAPI model precision opportunities

- Files: `src/types/openapi.ts:287`, `src/types/openapi.ts:288`, `src/types/openapi.ts:348`
- Current pattern:
  - `OpenApiServerVariableObject.default?` optional, and method set typed as `Set<string>`.
- Recommendation:
  - Make validated server-variable type require `default`, and preserve method-literal union in sets.

### M7) Cache model unions can encode valid state combinations

- Files: `src/types/cache.ts:48`, `src/types/cache.ts:50`, `src/types/cache.ts:51`, `src/types/cache.ts:52`, `src/types/cache.ts:80`, `src/types/cache.ts:82`, `src/types/cache.ts:83`, `src/types/cache.ts:87`, `src/types/cache.ts:88`, `src/types/cache.ts:89`, `src/types/cache.ts:146`
- Current pattern:
  - `TargetedSelection`, `RangeDecision`, and `RetryAfterValue` allow contradictory states.
  - `ProxyStatusParams.error` is broad `string` despite `ProxyErrorType`.
- Recommendation:
  - Introduce discriminated unions / exclusive member unions for validated outputs.
  - Narrow `error` to known union with extension escape hatch.

### M8) JSONPath function arg model is too permissive

- Files: `src/types/jsonpath.ts:156`, `src/types/jsonpath.ts:158`, `src/types/jsonpath.ts:161`, `src/types/jsonpath.ts:164`
- Current pattern:
  - Function `name` and `args` are not coupled by type.
- Recommendation:
  - Define function-specific arg tuple and return-type mapping.

### M9) Linkset context index signature is wider than intended

- File: `src/types/link.ts:62`
- Current pattern:
  - `[relationType: string]: LinksetTarget[] | string | undefined` allows plain string for any relation key.
- Recommendation:
  - Split `anchor` from relation map (or equivalent type decomposition) so relation keys map to target arrays only.

### M10) Digest algorithm typing can preserve known values better

- Files: `src/types/digest.ts:31`, `src/types/digest.ts:40`, `src/digest.ts:90`, `src/digest.ts:98`, `src/digest.ts:124`, `src/digest.ts:190`
- Current pattern:
  - Parsed digest/preference `algorithm` fields are plain `string`; several set-membership checks rely on casts.
- Recommendation:
  - Use known algorithm union plus extensibility pattern (`Known | (string & {})`), and typed sets/guards.

### M11) Cast-based token guards in auth modules

- Files: `src/auth/pkce.ts:24`, `src/auth/digest.ts:42`, `src/auth/bearer.ts:77`, `src/auth/bearer.ts:78`
- Current pattern:
  - `includes(value as Union)` style narrowing.
- Recommendation:
  - Replace with explicit guards or typed readonly sets to remove assertions.

### M12) Proxy-Status parser/formatter loses type specificity

- Files: `src/proxy-status.ts:59`, `src/proxy-status.ts:74`, `src/proxy-status.ts:90`, `src/proxy-status.ts:99`, `src/proxy-status.ts:116`, `src/proxy-status.ts:158`
- Current pattern:
  - Error-type set uses `Set<string>`, schema formatters rely on assertion casts.
- Recommendation:
  - Type set as `ReadonlySet<ProxyErrorType>` and tighten schema callback typing.

### M13) CSP policy validation uses assertion-heavy narrowing

- Files: `src/csp.ts:450`, `src/csp.ts:462`, `src/csp.ts:471`, `src/csp.ts:476`
- Current pattern:
  - Several `as` assertions on directive/value path in validator.
- Recommendation:
  - Replace with key/value guards to make narrowing compiler-visible.

### M14) JSON shape helper accepts arrays as generic record

- Files: `src/internal-json-shape.ts:15`, `src/internal-json-shape.ts:17`, `src/internal-json-shape.ts:25`, `src/internal-json-shape.ts:29`
- Current pattern:
  - `toRecordOrEmpty` returns arrays as `Record<string, unknown>` via cast.
- Recommendation:
  - Distinguish array/non-array object helpers more explicitly to avoid accidental array-as-record behavior.

### M15) Problem response overload implementation relies on assertions

- Files: `src/problem.ts:76`, `src/problem.ts:77`, `src/problem.ts:88`
- Current pattern:
  - `as string`, non-null assertion, and casted CORS headers in overload branching.
- Recommendation:
  - Branch with stricter runtime checks and avoid assertion-based extraction.

### M16) OAuth metadata parse/merge uses double assertion cloning

- Files: `src/oauth-authorization-server-metadata.ts:113`, `src/oauth-authorization-server-metadata.ts:292`
- Current pattern:
  - `cloneJsonObject(value as JsonObject) as AuthorizationServerMetadata` style casting.
- Recommendation:
  - Add explicit guard/normalizer that returns strongly typed validated object.

### M17) JSONPath evaluator function typing can be specialized

- Files: `src/jsonpath/evaluator.ts:846`, `src/jsonpath/evaluator.ts:862`
- Current pattern:
  - Generic `unknown` return path for function dispatch and generic arg list.
- Recommendation:
  - Use function-spec map to couple function name with arg tuple and return type.

## Low-Impact Findings

### L1) Readonly input opportunities for formatter-style APIs

- Files: `src/auth/shared.ts:257`, `src/auth/shared.ts:342`, `src/cors.ts:253`, `src/trace-context.ts:287`, `src/types/structured-fields.ts:68`, `src/types/structured-fields.ts:69`, `src/types/structured-fields.ts:70`
- Recommendation:
  - Accept `readonly` arrays/collections where mutation is not required.

### L2) Mutable exported constants could be narrowed

- Files: `src/cors.ts:16`, `src/cors.ts:24`, `src/cors.ts:25`, `src/auth/digest.ts:27`, `src/auth/bearer.ts:20`, `src/cookie.ts:12`
- Recommendation:
  - Use `as const` / readonly arrays for static token registries and constants.

### L3) Minor non-null assertions and cast cleanup in cookie parser

- Files: `src/cookie.ts:93`, `src/cookie.ts:102`
- Recommendation:
  - Remove avoidable non-null assertions through guarded destructuring.

### L4) WebFinger and host-meta trust-boundary casts

- Files: `src/webfinger.ts:67`, `src/webfinger.ts:69`, `src/webfinger.ts:78`, `src/host-meta.ts:203`
- Recommendation:
  - Parse link objects from `unknown` with local guards instead of cast chains.

### L5) Canonical JSON parser uses asserted parse result

- Files: `src/json-canonicalization.ts:52`, `src/json-canonicalization.ts:84`
- Recommendation:
  - Keep `JSON.parse` result as `unknown` and narrow before use.

### L6) Scripts: error and JSON-shape casts can be narrowed safely

- Files: `scripts/semver/git.ts:31`, `scripts/semver/git.ts:88`, `scripts/semver/policy.ts:43`, `scripts/semver/policy.ts:124`, `scripts/semver/policy.ts:125`
- Recommendation:
  - Replace assertion casts in catch/JSON-shape handling with guard helpers.

### L7) Test fixtures: unsafe conversion patterns are repetitive

- Files: `test/structured-fields.corpus.test.ts:47`, `test/json-patch.test.ts:108`, `test/json-patch.test.ts:112`, `test/json-merge-patch.test.ts:88`, `test/json-merge-patch.test.ts:92`, `test/json-canonicalization.test.ts:92`
- Recommendation:
  - Centralize intentional invalid-input casting behind one explicit test helper.

### L8) Test JSON parse typing is broad at assertion sites

- Files: `test/reporting.test.ts:170`, `test/oauth-authorization-server-metadata.test.ts:256`, `test/host-meta.test.ts:186`, `test/host-meta.test.ts:197`, `test/host-meta.test.ts:203`, `test/webfinger.test.ts:108`, `test/webfinger.test.ts:116`
- Recommendation:
  - Parse into explicit local payload interfaces for stronger compile-time contract checks.

### L9) Test-side `unknown[]` relation casts lose shape checks

- Files: `test/linkset.test.ts:615`, `test/linkset.test.ts:912`
- Recommendation:
  - Prefer typed target arrays (`{ href: string }[]`) over `unknown[]`.

### L10) Additional cast cleanup in JSON and SF tests

- Files: `test/structured-fields.test.ts:264`, `test/structured-fields.test.ts:273`, `test/structured-fields.test.ts:274`, `test/structured-fields.test.ts:320`
- Recommendation:
  - Use concrete parser result types and reusable guards (`SfDate`, param maps) rather than ad hoc cast objects.

## Prioritized Remediation Plan

1. Fix trust-boundary and model-soundness issues first (H1-H7).
2. Tighten public model types with additive strict companions where compatibility risk exists (OpenAPI, cache, JSONPath, linkset).
3. Replace repetitive assertion-based narrowing with typed guard helpers in shared utilities.
4. Apply readonly signature improvements and test-helper cleanup.

## Notes On Compatibility

- Several recommendations can be introduced in non-breaking phases:
  - Add strict companion types first.
  - Migrate internal implementations and tests.
  - Promote strict types to primary exports in a major version if needed.
