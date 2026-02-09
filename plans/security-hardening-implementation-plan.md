# Security Hardening Implementation Plan

## Goal

Harden `@irvinebroque/http-rfc-utils` against header injection and denial-of-service risks, improve parser resilience for untrusted input, and tighten default security posture without unnecessary breaking changes.

This plan covers all recommendations from the security review.

## Scope

- Header/value sanitization (CRLF and control character rejection)
- JSONPath denial-of-service hardening (cycles and regex backtracking)
- Prototype-key safety for dynamic object maps
- Safer cryptographic defaults for Digest authentication
- Non-throwing parse APIs for untrusted input paths
- CORS default posture and documentation hardening

Out of scope for this plan:

- New cryptographic signing/verification primitives
- Major API redesigns unrelated to security hardening

## Workstream 1: Header Injection and Control Character Hardening (High)

### Why

Current formatter paths can preserve `\r`/`\n` and other control bytes in values. In permissive stacks this can enable response splitting; in strict stacks it can still cause request crashes.

### Changes

1. Add shared internal validators (single source of truth):
   - `assertNoCtl(value: string, context: string)`
   - `assertHeaderToken(value: string, context: string)` for token-only fields
2. Call these validators from all header serialization paths before interpolation.
3. Enforce validation for both names and values where applicable.
4. Keep escaping behavior (`quoteIfNeeded`) after validation, not before.

### Target modules

- `src/header-utils.ts`
- `src/link.ts`
- `src/content-disposition.ts`
- `src/auth/shared.ts`
- `src/cookie.ts`
- `src/response.ts`
- `src/prefer.ts`
- `src/forwarded.ts`

### Tests

- Reject values containing `\r`, `\n`, NUL, or DEL across all formatters.
- Reject invalid parameter/header token names.
- Keep valid quoted-string round-trips unchanged.

### Acceptance criteria

- No public formatter returns a header string containing control characters.
- Existing RFC-conformant tests remain green.

## Workstream 2: JSONPath DoS Hardening (High)

### Why

JSONPath currently permits:

- Infinite traversal on cyclic object graphs
- Catastrophic regex backtracking via `match()` / `search()` patterns

### Changes

1. Add cycle detection to descendant traversal using `WeakSet<object>`.
2. Add execution budgets with safe defaults:
   - `maxNodesVisited`
   - `maxDepth`
   - `maxRegexPatternLength`
   - `maxRegexInputLength`
3. Add regex safety policy:
   - Reject patterns exceeding limits
   - Optionally reject clearly unsafe constructs (nested quantifier signatures/backreferences)
4. Return controlled failure (`null` or explicit error path per API mode) when limits are exceeded.

### Target modules

- `src/jsonpath/evaluator.ts`
- `src/types/shared.ts` (JSONPath options shape)
- `src/jsonpath.ts` exports (if options change)

### Tests

- Cyclic document query terminates deterministically.
- Catastrophic patterns are rejected quickly.
- Normal patterns and non-cyclic docs still work and keep ordering semantics.

### Acceptance criteria

- No hang on cyclic input.
- No unbounded regex execution from attacker-controlled patterns under default settings.

## Workstream 3: Prototype-Key Safety and Dynamic Map Hardening (Medium)

### Why

Dynamic key assignment to plain objects can break behavior for special keys like `__proto__` and produce parser-level DoS.

### Changes

1. Use `Object.create(null)` for dynamic extension maps.
2. Replace implicit truthy checks with `Object.hasOwn(...)` where key presence matters.
3. Add safe helper for creating and mutating extension dictionaries.

### Priority target

- `src/security-txt.ts` (confirmed crash path)

### Additional audit targets

- `src/linkset.ts`
- `src/host-meta.ts`
- Other modules using `Record<string, ...>` with user-supplied keys

### Tests

- Inputs with keys `__proto__`, `constructor`, `prototype` do not throw or mutate prototypes.
- Extension maps preserve values for normal keys.

### Acceptance criteria

- No parser crashes due to special JavaScript property names.

## Workstream 4: Safer Digest Auth Defaults (Medium)

### Why

Digest response computation currently defaults to `MD5`; this is unsafe as a default in modern adversarial settings.

### Changes

1. Change default algorithm from `MD5` to `SHA-256` in Digest compute helpers.
2. Keep MD5 support only when explicitly requested by caller.
3. Document compatibility mode behavior clearly.

### Target modules

- `src/auth/digest.ts`
- `README.md` auth docs
- `AUDIT.md` security note

### Tests

- Default compute path uses SHA-256.
- MD5 paths still pass when explicitly selected.

### Acceptance criteria

- No cryptographic helper defaults to MD5.

## Workstream 5: Parser Resilience for Untrusted Input (Medium/Low)

### Why

Some parse helpers throw on malformed input. In untrusted pipelines, uncaught exceptions become availability issues.

### Changes

1. Add non-throwing variants:
   - `tryParseJrd`
   - `tryParseHostMetaJson`
2. Keep existing throwing APIs for backward compatibility, but implement via safe internals.
3. Document throw vs non-throw semantics in README and API docs.

### Target modules

- `src/webfinger.ts`
- `src/host-meta.ts`
- `src/index.ts` exports

### Tests

- Malformed JSON never throws through `tryParse*` functions.
- Legacy `parse*` behavior remains stable (or intentionally documented if adjusted).

### Acceptance criteria

- Consumers have a first-class non-throwing API path for untrusted input.

## Workstream 6: CORS Default Posture and Docs (Low)

### Why

Library defaults are intentionally permissive. This is convenient but easy to misuse in production APIs.

### Changes

1. Add explicit docs warnings for `defaultCorsHeaders` and response helper defaults.
2. Add a stricter preset/helper for production-facing defaults (opt-in, non-breaking).
3. Provide secure usage recipes with explicit origin allowlists.

### Target modules/docs

- `src/cors.ts`
- `src/response.ts` docs/comments
- `README.md`

### Tests

- Strict preset outputs explicit origin policy and expected `Vary` behavior.

### Acceptance criteria

- Docs clearly distinguish development convenience from production-safe CORS patterns.

## Cross-Cutting Validation

1. Run canonical test suite:

```bash
pnpm test
```

2. Add dedicated security regression tests:
   - Header injection cases
   - JSONPath cycle/regex limits
   - Prototype-key edge cases
   - Parser crash-resilience

3. Add a small stress test set for JSONPath worst-case inputs with bounded runtime assertions.

## Rollout Strategy

### Phase 1 (Immediate)

- Workstream 1, Workstream 2 (cycle detection), Workstream 3 (`security-txt` fix)

### Phase 2

- Workstream 2 (regex policy + budgets)
- Workstream 4 (digest default)

### Phase 3

- Workstream 5 (`tryParse*` APIs)
- Workstream 6 (CORS docs/preset)

## Release and Compatibility Notes

- Most changes are patch-safe hardening.
- New APIs (`tryParse*`, strict CORS preset) are minor additions.
- If default digest algorithm changes and consumers rely on implicit MD5 behavior, document migration and call out in changelog.

## Done Definition

- All six workstreams implemented or explicitly deferred with rationale.
- Security regression tests added and passing.
- `pnpm test` passing.
- README and audit/docs updated to reflect new behavior and safer defaults.
