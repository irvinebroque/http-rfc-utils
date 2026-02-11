# Code Sharing Opportunities (High Leverage)

Date: 2026-02-10

I scanned `src/**/*.ts` for repeated parser/formatter logic and gaps where existing helpers are not reused. The items below are ranked by expected maintenance payoff and blast radius reduction.

## 1) Centralize percent-encoding and safe decode policies

Why this is high leverage:
- URI and OpenAPI modules repeatedly implement RFC 3986-style encoding policies with slightly different allowlists and error handling.
- The repo already has low-level byte helpers in `src/internal-percent-encoding.ts`, but policy-level behavior is still duplicated.

Evidence:
- Duplicate ASCII lookup-table builder: `src/uri.ts:45`, `src/uri-template.ts:70`
- URI Template encoding logic: `src/uri-template.ts:126`
- URI component encoding/normalization logic: `src/uri.ts:131`, `src/uri.ts:463`
- OpenAPI strict encoding and decode helper: `src/openapi/parameter-serialization.ts:1028`, `src/openapi/parameter-serialization.ts:1046`, `src/openapi/parameter-serialization.ts:1053`
- Another safe decode clone: `src/openapi/runtime-expression.ts:328`
- Additional percent-encoding path: `src/json-pointer.ts:208`

Suggested shared layer:
- `encodeRfc3986(value, options)` (allowReserved, preservePctTriplets, uppercase hex)
- `decodePercentComponent(value): string | null` (non-throwing)
- `createAsciiAllowTable(chars)` or prebuilt tables for unreserved/reserved classes

Expected payoff:
- Fewer subtle inconsistencies across URI/OpenAPI/JSON Pointer behavior.
- Easier RFC updates (one implementation to change/test).

## 2) Define one Cache-Control directive schema for both RFC 9111 and RFC 9213 paths

Why this is high leverage:
- `cache.ts` and `targeted-cache-control.ts` encode/decode nearly the same directive set (`public`, `private`, `max-age`, `stale-if-error`, etc.) using separate switch trees.
- Drift risk is high whenever adding/changing directive handling.

Evidence:
- Classic Cache-Control parser/formatter: `src/cache.ts:46`, `src/cache.ts:145`
- Targeted Cache-Control parser/formatter: `src/targeted-cache-control.ts:33`, `src/targeted-cache-control.ts:133`, `src/targeted-cache-control.ts:222`
- Shared shape already exists in types: `src/types/cache.ts:16`, `src/types/cache.ts:33`

Suggested shared layer:
- Directive descriptor table with:
  - wire key (`max-age`)
  - internal property (`maxAge`)
  - value kind (boolean/non-negative integer)
  - parse/format hooks per wire format (token list vs SF dictionary)

Expected payoff:
- Keeps classic and targeted semantics aligned by construction.
- Reduces repetitive switch-case maintenance.

## 3) Consolidate Structured Field token/key validation and item extraction helpers

Why this is high leverage:
- Multiple modules re-declare identical SF token/key regexes and repeatedly hand-roll `item vs inner list` checks.
- These are correctness-critical primitives for every SF-based header.

Evidence:
- Duplicate SF token regex (same pattern):
  - `src/structured-fields.ts:13`
  - `src/proxy-status.ts:19`
  - `src/compression-dictionary.ts:21`
- Duplicate SF key regex pattern:
  - `src/structured-fields.ts:15`
  - `src/cache-status.ts:19`
  - `src/client-hints.ts:12`
- Repeated inner-list guards in module parsers:
  - `src/cache-status.ts:120`
  - `src/proxy-status.ts:192`
  - `src/cache-groups.ts:24`
  - `src/client-hints.ts:33`
  - `src/link-template.ts:29`

Suggested shared layer:
- Export SF validators from one place (`isSfTokenText`, `isSfKeyText`)
- Add tiny helpers like `expectSfItem(member)` / `expectNoSfParams(item)`
- Optionally add `parseSfStringList` and `parseSfTokenList` utilities for common list-only headers

Expected payoff:
- Better consistency across all SF modules.
- Smaller, clearer per-header parsing code.

## 4) Reuse quoted-string escaping/unescaping utilities everywhere

Why this is high leverage:
- There is already `escapeQuotedString` in `header-utils`, but several modules still duplicate escape logic directly.
- Quoted-string bugs are easy to introduce and hard to notice.

Evidence:
- Canonical helper exists: `src/header-utils.ts:243`
- Duplicate escaping expression in:
  - `src/http-signatures.ts:521`, `src/http-signatures.ts:529`, `src/http-signatures.ts:851`
  - `src/alt-svc.ts:223`
  - `src/structured-fields.ts:635` (similar pattern, SF-specific semantics)
- Separate unquote implementation in cookies: `src/cookie.ts:14`

Suggested shared layer:
- Reuse `escapeQuotedString` where RFC 9110 quoted-string rules apply
- If needed, add separate explicit helpers for:
  - HTTP quoted-string
  - Structured Field string escaping (different constraints)

Expected payoff:
- Eliminates repeated escaping code.
- Lowers risk of inconsistent quoting behavior between modules.

## 5) Introduce a generic parser for q-weighted token headers

Why this is high leverage:
- `Accept-Encoding` and `Accept-Language` have near-identical token + `q` parsing loops.
- `Accept` parsing is more complex but still uses the same `q` machinery.

Evidence:
- `Accept-Language`: `src/language.ts:35`, `src/language.ts:43`
- `Accept-Encoding`: `src/encoding.ts:20`, `src/encoding.ts:27`
- Shared q parser already exists: `src/header-utils.ts:384`

Suggested shared layer:
- `parseWeightedTokenList(header, options)` that handles:
  - token normalization
  - q extraction via `parseQSegments`
  - invalid-q policy
  - stable sorting strategy

Expected payoff:
- Less duplicate parsing logic.
- Easier to add future q-weighted headers.

## 6) Extract shared UTF-8/surrogate and byte-coercion utilities

Why this is medium leverage:
- Several modules carry identical `TextEncoder` setup and very similar Unicode/surrogate checks.
- Helpful cleanup after the higher-impact items above.

Evidence:
- Duplicate lone-surrogate checker:
  - `src/json-canonicalization.ts:161`
  - `src/structured-fields.ts:639`
- Repeated `TextEncoder` constants in many files, including:
  - `src/uri.ts:29`
  - `src/uri-template.ts:68`
  - `src/digest.ts:14`
  - `src/etag.ts:12`

Suggested shared layer:
- `hasLoneSurrogate(value)` in one internal module
- Optional helpers for `string|buffer view -> Uint8Array/ArrayBuffer`

Expected payoff:
- Reduces low-level duplication and keeps Unicode behavior consistent.

## Recommended sequencing

1. Percent-encoding consolidation (Item 1)
2. Cache-Control schema unification (Item 2)
3. Structured Field validator/item helper consolidation (Item 3)
4. Quoted-string helper adoption (Item 4)
5. q-weighted parser extraction (Item 5)
6. UTF-8/surrogate cleanup (Item 6)

This order front-loads the areas with the largest cross-module impact and highest long-term regression risk.
