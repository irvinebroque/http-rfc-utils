# Deep Code-Sharing Opportunities (2026-02-11)

This pass focuses on **current highest leverage** opportunities after the first code-sharing wave already landed (`internal-uri-encoding`, `internal-cache-control-schema`, structured-field helpers, q-weighted parser, and `internal-unicode`).

## Research method

- Very-thorough codebase scans were run via subagents over parser/formatter duplication, encoding/unicode duplication, and schema/mapping duplication.
- Findings were manually verified against `src/**/*.ts` with file-level reads and line references.
- Opportunities were ranked by:
  1. **Reach** (how many modules call into the pattern),
  2. **Drift risk** (likelihood of inconsistent behavior over time),
  3. **Refactor safety** (ability to migrate incrementally without API breaks).

## Current baseline

The previous six opportunities are mostly done:

- Fully implemented: cache-control schema unification, quoted-string consolidation, q-weighted token parser extraction.
- Partially implemented with remaining cleanup: percent-decoding policy convergence, SF helper adoption in all SF modules, UTF-8 helper adoption in all modules.

That means the highest leverage has shifted to the opportunities below.

## Ranked opportunities

### 1) Shared parser/formatter for parameterized members (`token[=value];param[=value]...`)

Why this is high leverage:

- The same parse skeleton appears across multiple headers with only policy differences (duplicate handling, value grammar, invalid-member behavior).
- This is one of the most repeated non-SF parser shapes in the repo.

Evidence:

- Shared low-level pieces already exist: `src/header-utils.ts:78`, `src/header-utils.ts:133`, `src/header-utils.ts:155`.
- Repeated member + params loops:
  - `src/forwarded.ts:29`, `src/forwarded.ts:35`
  - `src/prefer.ts:64`, `src/prefer.ts:69`
  - `src/hsts.ts:43`, `src/hsts.ts:49`
  - `src/content-disposition.ts:52`, `src/content-disposition.ts:63`
  - `src/alt-svc.ts:178`, `src/alt-svc.ts:244`

Suggested shared layer:

- `parseParameterizedMembers(input, options)`
- `formatParameterizedMember(base, params, options)`
- Policy knobs:
  - member delimiter / param delimiter,
  - key/value grammar (`token`, `quoted`, `token-or-quoted`),
  - duplicate policy (`first-wins`, `last-wins`, `reject`),
  - invalid policy (`skip-member`, `fail-field`, `return-empty`).

Risk:

- Medium. RFC-specific semantics differ, but migration can be done parser-by-parser with optionized behavior.

---

### 2) Schema-driven auth-param mapping across Basic, Bearer, and Digest

Why this is high leverage:

- `auth/shared.ts` already centralizes wire parsing, but each auth scheme still repeats object mapping + duplicate checks + formatter assembly.
- Digest alone contains multiple near-parallel mapping paths (challenge, credentials, auth-info).

Evidence:

- Existing generic auth param list parser: `src/auth/shared.ts:128`.
- Repeated per-scheme mapping loops:
  - Basic challenge mapping: `src/auth/basic.ts:89`
  - Bearer challenge parse/format: `src/auth/bearer.ts:58`, `src/auth/bearer.ts:104`
  - Digest parse/format families:
    - challenge: `src/auth/digest.ts:88`, `src/auth/digest.ts:163`
    - credentials: `src/auth/digest.ts:220`, `src/auth/digest.ts:343`
    - auth-info: `src/auth/digest.ts:415`, `src/auth/digest.ts:453`

Suggested shared layer:

- `AuthParamSchemaEntry` + `parseAuthParamsBySchema` + `buildAuthParamsBySchema` (parallel to `structured-field-schema`).
- Cross-field validators for scheme-specific constraints (for example Digest `qop` -> requires `cnonce` and `nc`).

Risk:

- Medium-high. Digest has semantic coupling rules; use phased migration (Bearer/Basic first, then Digest).

---

### 3) Structured-Field list/dictionary projection adapters

Why this is high leverage:

- The repo already has shared SF token/key validators and shared SF parameter schema mapping.
- The remaining repeated code is at the "entry projection" layer: parse list/dict, require item shape, enforce value type, map to typed records.

Evidence:

- Repeated SF list -> item/value mapping:
  - `src/cache-status.ts:120`, `src/cache-status.ts:127`
  - `src/proxy-status.ts:218`, `src/proxy-status.ts:227`
  - `src/client-hints.ts:26`, `src/client-hints.ts:32`
  - `src/cache-groups.ts:18`, `src/cache-groups.ts:25`
  - `src/link-template.ts:22`, `src/link-template.ts:30`
- Repeated SF dict member projection patterns:
  - `src/digest.ts:109`, `src/digest.ts:175`
  - `src/reporting.ts:43`, `src/reporting.ts:50`
  - `src/priority.ts:35`, `src/priority.ts:42`
  - `src/compression-dictionary.ts:107`, `src/compression-dictionary.ts:112`
  - `src/http-signatures.ts:73`, `src/http-signatures.ts:297`

Suggested shared layer:

- `parseSfListItems(value, mapper, policy)`
- `parseSfDictItems(value, mapper, policy)`
- Policy knobs for strict vs tolerant member handling (`fail-field` vs `skip-member`).

Risk:

- Medium. Mechanically straightforward if policies are explicit.

---

### 4) OpenAPI runtime-expression descriptor registry + shared template interpolation engine

Why this is high leverage:

- OpenAPI runtime expression handling is now split between two modules with duplicated branch and scanning logic.
- This area has high correctness sensitivity due to path/error diagnostics and strict/tolerant mode behavior.

Evidence:

- Mirrored request/response parse branches: `src/openapi/runtime-expression.ts:131`, `src/openapi/runtime-expression.ts:171`.
- Duplicated brace-template scanners in callback resolver:
  - callback key scanner: `src/openapi/link-callback.ts:99`
  - runtime template scanner: `src/openapi/link-callback.ts:245`

Suggested shared layer:

- `RuntimeExpressionDescriptor[]` registry (prefix, name validator, formatter, evaluator accessor).
- `resolveInterpolatedRuntimeTemplate(template, context, issueFactory, options)` used by both callback key and runtime template paths.

Risk:

- Medium. Keep existing issue codes/messages stable while refactoring.

---

### 5) Consolidate media-type parsing for negotiation and patch flows

Why this is high leverage:

- A canonical parser exists, but `negotiate.ts` still reimplements a sibling parser for media ranges and MIME-with-params.
- This creates an avoidable drift point for token normalization and parameter handling.

Evidence:

- Canonical parser: `src/header-utils.ts:581`.
- Negotiation-specific re-parsers:
  - `src/negotiate.ts:98`
  - `src/negotiate.ts:205`
- Existing reuse example in Accept-Patch: `src/patch.ts:113`.

Suggested shared layer:

- Extend media-type helper APIs with options for:
  - wildcard allowance,
  - parameter container (`Map` vs array),
  - optional q-parameter boundary awareness.

Risk:

- Medium-low. Contained blast radius with clear regression tests.

---

### 6) Finish percent-decoding policy convergence (strict vs lenient decode)

Why this is high leverage:

- Encoding policy is centralized, but decode semantics still diverge across modules.
- Inconsistent invalid-escape behavior is one of the easiest ways for URI behavior to drift.

Evidence:

- Strict shared decoder: `src/internal-uri-encoding.ts:88`.
- Legacy lenient decoder preserving original on failure: `src/uri.ts:128`.
- Separate decode wrappers:
  - `src/ext-value.ts:143`
  - `src/openapi/path-server-resolver.ts:580`

Suggested shared layer:

- `tryDecodePercentUtf8(value): string | null` (strict)
- `decodePercentUtf8OrOriginal(value): string` (lenient compatibility wrapper)
- `tryDecodeUriComponent(value): string | null` alias for call-site clarity.

Risk:

- Medium. Behavior is observable; migration should preserve existing public contracts.

---

### 7) Complete internal UTF-8 helper adoption for remaining modules

Why this still matters:

- `internal-unicode.ts` exists, but several modules still instantiate local encoders/byte coercers.
- This is lower risk cleanup with steady maintenance payoff.

Evidence:

- Shared helper exists: `src/internal-unicode.ts:34`, `src/internal-unicode.ts:38`.
- Remaining local encoder/coercion sites:
  - `src/http-signatures.ts:44`
  - `src/ext-value.ts:19`
  - `src/robots.ts:13`
  - `src/reporting.ts:31`
  - `src/auth/webauthn-client-data.ts:19`, `src/auth/webauthn-client-data.ts:182`

Suggested shared layer:

- Reuse `encodeUtf8` and `toUint8ArrayView` directly; add `tryDecodeUtf8` only if needed by multiple modules.

Risk:

- Low.

## Recommended sequencing

1. Parameterized member parser/formatter extraction.
2. Auth-param schema engine (Basic/Bearer first, Digest second).
3. SF list/dict projection adapters.
4. OpenAPI runtime-expression descriptor + interpolation unification.
5. Media-type parser convergence.
6. Percent-decoding policy convergence.
7. UTF-8 helper adoption cleanup.

This order front-loads broad cross-module reuse with manageable migration risk, then lands behavioral convergence work after shared scaffolding exists.
