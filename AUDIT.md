# RFC Coverage Audit

## Structured Fields (RFC 8941 + RFC 9651)

Module: `src/structured-fields.ts`

- RFC 8941 Sections 3-4: Implemented for Item/List/Dictionary parsing and serialization.
- RFC 9651 Section 3.3.7: Implemented (`SfDate`, `@<unix-seconds>` parsing/serialization).
- RFC 9651 Sections 3.3.8, 4.1.11, 4.2.10: Implemented (`SfDisplayString` parsing/serialization).

### RFC 9651 Display String decisions

- Strict parse behavior: malformed display strings fail the whole parse target (item/list/dictionary).
- `pct-encoded` triplets are accepted only with lowercase hex digits (`[0-9a-f]`).
- Percent triplets are UTF-8 decoded with fatal behavior; invalid byte sequences fail parsing.
- Serialization emits lowercase hex triplets and preserves unescaped visible ASCII except `%` and `"`.

### Deterministic compliance fixtures

- Vendored corpus fixture: `test/fixtures/structured-field-tests/display-string.json`.
- Source metadata: `test/fixtures/structured-field-tests/SOURCE.md`.

## Named Information URIs (RFC 6920)

Module: `src/ni.ts`

- RFC 6920 Section 2: Implemented NI identity comparison by algorithm + decoded digest bytes/length; authority/query are ignored for identity.
- RFC 6920 Section 3: Implemented ni URI parsing/formatting for `ni:///alg;val` and `ni://authority/alg;val`; digest value enforces base64url without `=` padding.
- RFC 6920 Section 3.1: Implemented parsing of `ct=` query attribute name and percent-decoded query values.
- RFC 6920 Section 4: Implemented `.well-known/ni` forward and reverse mapping helpers.
- RFC 6920 Section 5: Implemented `alg;val` URL segment parser/formatter.
- RFC 6920 Section 9.4: `sha-256` is mandatory and supported; truncated SHA-256 suites (`sha-256-128`, `-120`, `-96`, `-64`, `-32`) are supported.

### RFC 6920 scope and non-goals

- Implemented scope: ni URI syntax, identity comparison semantics, `.well-known/ni` mapping, URL segment form, and digest compute/verify helpers.
- Non-goals in this phase: binary Suite-ID format (RFC 6920 Section 6) and `nih` human-speakable URI format (RFC 6920 Section 7).
- Strictness decision: malformed/non-conforming NI names are parsed as invalid and treated as non-matching (RFC 6920 Section 10).

## Priority Header (RFC 9218)

Module: `src/priority.ts`

- RFC 9218 Sections 4, 4.1, 4.2, 5: Implemented `Priority` dictionary parsing/formatting for `u` and `i`, including defaults (`u=3`, `i=false`).
- RFC 9218 Section 8: Implemented explicit merge helper for combining client and server priority signals.
- RFC 9218 Section 7: Out of scope; HTTP/2 and HTTP/3 `PRIORITY_UPDATE` frame processing is not implemented.

### RFC 9218 parsing and permissiveness decisions

- Strict SF parse behavior: invalid dictionary syntax returns `null`.
- RFC 9218 semantic behavior: unknown members, invalid member types, and out-of-range `u` values are ignored after successful dictionary parse.
- Request-default materialization is explicit via `applyPriorityDefaults()` and is intentionally separate from `formatPriority()` omission semantics.

## Compression Dictionary Transport (RFC 9842)

Module: `src/compression-dictionary.ts`

- RFC 9842 Sections 2 and 2.1: Implemented `Use-As-Dictionary` Structured Field Dictionary parsing/formatting with required `match`, optional `match-dest`, optional `id`, and optional `type` defaults.
- RFC 9842 Section 2.1.1: Implemented `validateUseAsDictionary()` helper enforcing same-origin match resolution and rejecting regexp-group style patterns.
- RFC 9842 Sections 2.2 and 2.3: Implemented strict `Available-Dictionary` (single 32-byte SF Byte Sequence) and `Dictionary-ID` (SF String, max 1024 chars) parsing/formatting.
- RFC 9842 Sections 2.2.2 and 2.2.3: Implemented request matching and deterministic best-dictionary selection precedence (destination specificity, longest `match`, then most recently fetched).
- RFC 9842 Section 6.2: Implemented `mergeDictionaryVary()` helper that adds `accept-encoding` and `available-dictionary` to `Vary`.

### RFC 9842 scope and non-goals

- Implemented scope: header-level negotiation and client-side dictionary selection helpers.
- Non-goals in this phase: dictionary-compressed stream codec implementation (`dcb`/`dcz` payload formats), freshness policy enforcement, dictionary storage partitioning, and transport/runtime decompression strategy.

## Targeted Cache-Control (RFC 9213)

Module: `src/targeted-cache-control.ts`

- RFC 9213 Sections 2 and 2.1: Implemented Structured Field Dictionary parsing/formatting for targeted cache-control fields.
- RFC 9213 Section 2.1: Implemented directive-parameter ignore behavior for known directives unless explicitly supported.
- RFC 9213 Section 2.1: Implemented strict numeric validation for known directives (`max-age`, `s-maxage`, `stale-while-revalidate`, `stale-if-error`) with no decimal coercion.
- RFC 9213 Sections 2.1 and 3.1: Implemented `CDN-Cache-Control` wrappers using shared targeted cache-control parser/formatter behavior.
- RFC 9213 Section 2.2: Implemented target-list selection helper where the first valid non-empty targeted field wins, with `Cache-Control` fallback behavior.

### RFC 9213 parsing and permissiveness decisions

- Strict SF parse behavior: invalid dictionary syntax returns `null` and is ignored by selection.
- Known directives: only semantically valid member values are applied; invalid known values are dropped.
- Unknown directives: preserved under `extensions` as uninterpreted structured members, including member parameters.
- Out of scope in this phase: runtime cache engine mutation/application strategy and intermediary deployment policy.

## Cache Groups (RFC 9875)

Module: `src/cache-groups.ts`

- RFC 9875 Section 2: Implemented strict Structured Field List parsing/formatting for `Cache-Groups` with sf-string member enforcement.
- RFC 9875 Section 2: Implemented parameter-ignore semantics where unrecognized member parameters do not affect parsed group identity.
- RFC 9875 Section 2.1: Implemented grouped-response identity helper requiring both same-origin comparison and case-sensitive group-string matches.
- RFC 9875 Section 3: Implemented `Cache-Group-Invalidation` parsing/formatting and explicit safe-method ignore behavior (`GET`, `HEAD`, `OPTIONS`, `TRACE`) in parser helper semantics.
- RFC 9875 Sections 2 and 3: Added explicit conformance tests validating support for at least 32 groups with 32-character member strings.

### RFC 9875 scope and non-goals

- Implemented scope: header-level parse/format and identity/invalidation decision helpers.
- Non-goals in this phase: cache storage, eviction, cascading group invalidation, and networked cache coordination across multiple caches.

## Early-Data and 425 Too Early (RFC 8470)

Module: `src/early-data.ts`

- RFC 8470 Section 5.1: Implemented `Early-Data` ABNF helpers (`parseEarlyData`, `formatEarlyData`) and server-side signal detection (`hasEarlyDataSignal`).
- RFC 8470 Section 5.1: Implemented server equivalence behavior in helpers: multiple or invalid field instances are treated as equivalent to `1` for replay-risk signaling decisions.
- RFC 8470 Section 5.2: Implemented `canSend425` eligibility helper for `425 Too Early` emission constraints (only eligible if request used early data or carried an `Early-Data` signal).
- RFC 8470 Sections 3 and 6: Out of scope; TLS anti-replay strategy, 0-RTT acceptance policy, and transport-level defenses are not implemented by this library.

## Alt-Svc and Alt-Used (RFC 7838)

Module: `src/alt-svc.ts`

- RFC 7838 Section 3: Implemented `Alt-Svc` parsing/formatting for `clear` and ordered alternative lists (`1#alt-value`).
- RFC 7838 Section 3: Implemented case-sensitive `clear` handling (only lowercase `clear` is recognized as the clear token).
- RFC 7838 Section 3.1: Implemented `ma` and `persist` parameter parsing/formatting, ignoring unknown parameters and treating `persist` as meaningful only when value is `1`.
- RFC 7838 Section 3: Implemented tolerant alternative parsing that skips malformed list members while preserving valid alternatives and preference order.
- RFC 7838 Section 5: Implemented `Alt-Used` parsing/formatting for `uri-host` with optional port, including bracketed IPv6 host support.

### RFC 7838 scope and non-goals

- Implemented scope: HTTP header-level interoperability for `Alt-Svc` and `Alt-Used` field values.
- Non-goals in this phase: ALTSVC frame processing, client alternative-service cache lifecycle management, and transport/runtime selection policy.

## PATCH and Accept-Patch (RFC 5789)

Module: `src/patch.ts`

- RFC 5789 Section 3.1: Implemented strict `Accept-Patch` parsing (`1#media-type`) with malformed-member rejection.
- RFC 5789 Section 3.1: Implemented deterministic formatting with preserved member/parameter order and token normalization.
- RFC 5789 Section 3.1: Implemented PATCH support helper where valid `Accept-Patch` presence implies PATCH is allowed.
- RFC 5789 Section 3.2: Implemented optional `Accept-Patch` integration in `optionsResponse` for OPTIONS advertisement.
- RFC 5789 Section 2.2: Documented error-path guidance (`415 Unsupported Media Type` with `Accept-Patch`) in README recipes.

### RFC 5789 scope and non-goals

- Implemented scope: header-level interoperability utilities for advertising and checking PATCH document format support.
- Non-goals in this phase: patch document application semantics, conditional PATCH conflict resolution, and storage-layer atomicity enforcement.

## Link-Template Header (RFC 9652)

Module: `src/link-template.ts`

- RFC 9652 Section 2: Implemented strict Structured Field List parsing for `Link-Template` where each member MUST be an sf-string.
- RFC 9652 Section 2: Implemented constrained parameter enforcement (`rel`, `anchor`, `var-base` MUST be sf-string values) with invalid type rejection.
- RFC 9652 Section 2: Implemented target attribute serialization policy where non-ASCII string values are serialized as RFC 9651 Display Strings.
- RFC 9652 Section 2: Implemented URI Template expansion for both link target and templated `anchor` values using RFC 6570 utilities.
- RFC 9652 Section 2.1: Implemented `var-base` variable URI resolution, including second-pass resolution against link context when still relative.

### RFC 9652 scope and non-goals

- Implemented scope: header parsing/formatting, expansion helpers, constrained parameter validation, and variable URI construction for templates.
- Non-goals in this phase: dereferencing variable metadata and registry/publishing behaviors for variable URI descriptions.

## W3C Trace Context

Module: `src/trace-context.ts`

- W3C Trace Context Section 3.2: Implemented strict `traceparent` parsing/formatting/validation for version `00` with lowercase-hex enforcement.
- W3C Trace Context Section 3.2.2.3 and 3.2.2.4: Implemented non-zero checks for `trace-id` and `parent-id`.
- W3C Trace Context Sections 3.3 and 3.5: Implemented `tracestate` parsing/formatting/validation and mutation helpers with ordering preservation, duplicate-key rejection, and prepend-on-update behavior.
- W3C Trace Context Section 3.3.1.5: Implemented list-member (`32`) and header-length (`512`) truncation guardrails.
- W3C Trace Context Sections 4.2 and 4.3: Implemented parent mutation/restart helpers and combined behavior that drops `tracestate` when incoming `traceparent` is invalid.

### W3C Trace Context scope and non-goals

- Implemented scope: HTTP header-level parse/validate/format and deterministic mutation helpers suitable for service-to-service propagation.
- Non-goals in this phase: browser/user-agent trace generation behavior, non-HTTP transports, and backend-specific sampling policy decisions.
- Versioning decision: this implementation is strict for version `00`; non-`00` versions are rejected until version-specific behavior is explicitly added.

## W3C Fetch Metadata

Module: `src/fetch-metadata.ts`

- W3C Fetch Metadata Sections 2.1-2.4: Implemented `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site`, and `Sec-Fetch-User` parsing/formatting using Structured Field item parsing for token/boolean semantics.
- W3C Fetch Metadata Section 2: Implemented forward-compatible parsing behavior where unknown token values are ignored rather than treated as hard parse failures.
- W3C Fetch Metadata Section 5: Implemented policy helper with permissive default mode and strict-mode evaluation for same-origin/same-site/none/cross-site request handling.
- W3C Fetch Metadata Section 5.1: Implemented `fetchMetadataVary` helper to merge relevant `Sec-Fetch-*` request headers into `Vary`.

### W3C Fetch Metadata scope and non-goals

- Implemented scope: header-level parsing/formatting, aggregate metadata extraction, policy decision helper, and Vary integration helper for server-side deployment.
- Non-goals in this phase: user-agent generation algorithms and browser-side fetch integration details from specification Sections 3 and 4.

## Well-Known URIs (RFC 8615)

Module: `src/well-known.ts`

- RFC 8615 Section 3: Implemented top-level-only `/.well-known/` prefix validation for path and URI helpers.
- RFC 8615 Section 3: Implemented nested-form rejection (for example `/foo/.well-known/x`) to preserve root-path ownership constraints.
- RFC 8615 Section 3 and RFC 3986 Section 3.3: Implemented suffix validation as a single non-empty path segment (`segment-nz`) with no slash.
- RFC 8615 Section 3: Implemented strict builders (`buildWellKnownPath`, `buildWellKnownUri`) that throw on invalid suffix/origin inputs.
- RFC 8615 Section 3: Implemented non-throwing parsers/checkers (`parseWellKnownPath`, `isWellKnownPath`, `isWellKnownUri`) that return null/false for invalid input.

### RFC 8615 scope and non-goals

- Implemented scope: generic top-level path/URI utility behavior only.
- Non-goals in this phase: IANA well-known registration workflow and endpoint-specific protocol/application semantics.

## Security Hardening (cross-cutting)

Modules: `src/header-utils.ts`, `src/link.ts`, `src/content-disposition.ts`, `src/auth/shared.ts`, `src/cookie.ts`, `src/response.ts`, `src/prefer.ts`, `src/forwarded.ts`, `src/jsonpath/evaluator.ts`, `src/object-map.ts`, `src/security-txt.ts`, `src/linkset.ts`, `src/host-meta.ts`, `src/webfinger.ts`, `src/auth/digest.ts`, `src/cors.ts`

- Header/control-byte hardening: shared `assertNoCtl` and `assertHeaderToken` validation is applied to formatter and serializer paths to reject CR, LF, NUL, DEL, and invalid token names before header interpolation.
- JSONPath DoS guardrails: evaluator now enforces bounded traversal/recursion and regex controls (`maxNodesVisited`, `maxDepth`, `maxRegexPatternLength`, `maxRegexInputLength`, `rejectUnsafeRegex`) with deterministic failure behavior under limits.
- Prototype-key safety: dynamic extension maps now use null-prototype dictionaries (`createObjectMap`) and own-key checks to prevent `__proto__`/`constructor`/`prototype` special-key crashes and prototype mutation side effects.
- Digest auth default posture: Digest response helpers now default to `SHA-256`; `MD5` remains available only when explicitly requested for compatibility.
- Untrusted JSON parse resilience: non-throwing APIs `tryParseJrd` and `tryParseHostMetaJson` provide first-class safe parse paths while preserving existing throwing parse APIs for compatibility.
- CORS posture hardening: `defaultCorsHeaders` remains intentionally permissive for local/dev flows; `buildStrictCorsHeadersForOrigin` provides explicit allowlist behavior for production deployments with `Vary: Origin` support.

## Security Review and Fuzzing Program (2026 Q1)

Modules: `test/fuzz/security-fuzz.spec.ts`, `test/fuzz/fast-check-harness.ts`, `scripts/fuzz/*.mjs`, `scripts/security/*.mjs`, `docs/security/*`

- Added deterministic fast-check harness with replay metadata (`seed`/`path`) and automatic crash artifact persistence to `temp/fuzz-artifacts/`.
- Added shared fuzz invariants for non-throwing parser behavior, control-byte-free header serialization checks, and null-prototype map checks.
- Added corpus-backed mutation fuzzing structure under `test/fuzz/corpus/` for Tier 1 parser targets plus Tier 2 security/discovery modules (`security-txt`, `host-meta`, `webfinger`).
- Added security review scaffolding (`docs/security/security-review-2026Q1.md`, review/finding templates, findings register) and validation scripts.
- Added package scripts for CI/local security workflows: `security:review`, `fuzz:quick`, `fuzz:full`, and `security:ci`.
