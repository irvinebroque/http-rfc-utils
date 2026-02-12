# http-rfc-utils plan (RFC mapping + usage)

Goal
Make it exceptionally clear what code maps to what RFC, and how consumers should use each utility. Resolve simplifications and consistency issues while keeping the public API stable unless explicitly changed.

1) Publish a RFC map table (docs + module headers)

RFC map (module -> RFC -> exports -> usage)

- src/etag.ts -> RFC 9110 Section 8.8 / 13.1
  - Exports: generateETag, generateETagAsync, parseETag, formatETag, compareETags, compareETagStrings
  - Usage:
    - Server: generate ETag for representations, add header ETag.
    - Client/Server: parse/compare If-Match / If-None-Match values.
  - Notes: Strong vs weak comparisons per RFC 9110 Section 8.8.3.

- src/conditional.ts -> RFC 9110 Section 13.2.2 (precondition evaluation)
  - Exports: evaluatePreconditions, handleConditionalRequest, parseIfNoneMatch, parseIfMatch, evaluateIfMatch, evaluateIfNoneMatch, evaluateIfModifiedSince, evaluateIfUnmodifiedSince
  - Usage:
    - Server: before sending a representation, call evaluatePreconditions with currentETag and lastModified.
    - If proceed=false, return 304/412 with ETag/Last-Modified as appropriate.
  - Notes: Document the precedence order (If-Match, If-Unmodified-Since, If-None-Match, If-Modified-Since).

- src/datetime.ts -> RFC 3339 (timestamps), RFC 9110 Section 5.6.7 (HTTP-date)
  - Exports: toRFC3339, parseRFC3339, formatHTTPDate, parseHTTPDate, isExpired, secondsUntil
  - Usage:
    - JSON timestamps: toRFC3339 for fields that are RFC 3339.
    - HTTP headers: formatHTTPDate for Date, Last-Modified, Expires.
    - Conditional requests: parseHTTPDate to interpret If-Modified-Since / If-Unmodified-Since.
  - Notes: Parsing supports IMF-fixdate, RFC 850, and asctime per RFC 9110 Section 5.6.7.

- src/cache.ts -> RFC 9111 (Cache-Control)
  - Exports: cacheControl, getCacheHeaders, parseCacheControl, CachePresets
  - Usage:
    - Server: cacheControl(options) to build header string; getCacheHeaders to add ETag + Last-Modified + Cache-Control together.
    - Client/Server: parseCacheControl to inspect existing directives.
  - Notes: Directives implemented include max-age, s-maxage, stale-while-revalidate, stale-if-error.

- src/link.ts -> RFC 8288 (Web Linking)
  - Exports: formatLink, formatLinkHeader, parseLinkHeader, buildLinkHeader, quoteIfNeeded, unquote, LinkRelation
  - Usage:
    - Server: formatLinkHeader to assemble Link headers; buildLinkHeader for pagination objects.
    - Client/Server: parseLinkHeader for consuming Link headers.
  - Notes: Parser handles commas inside quotes, escaped characters, boolean params.

- src/negotiate.ts -> RFC 7231 Section 5.3.2 (Accept header)
  - Exports: parseAccept, negotiate, getResponseFormat, toCSV, MEDIA_TYPES, MIME_TO_FORMAT
  - Usage:
    - Server: negotiate(request, supportedMimeTypes) to pick a MIME type; getResponseFormat to choose json vs csv.
    - Utility: toCSV for output when text/csv is chosen.
  - Notes: q-values, specificity rules, and parameter handling.

- src/response.ts -> RFC 9110 (response headers), RFC 9111 (cache), RFC 8288 (Link), RFC 7231 (content types)
  - Exports: optionsResponse, headResponse, jsonResponse, csvResponse, redirectResponse, simpleJsonResponse, noContentResponse, textResponse
  - Usage:
    - Server: use the helper matching your endpoint type.
    - jsonResponse/csvResponse are opinionated: includes CORS, ETag, Last-Modified, Cache-Control, Link, X-Total-Count.
  - Notes: If meta is intended for response body, specify and implement; otherwise remove to avoid confusion.

- src/pagination.ts -> RFC 8288 (Link usage) + API conventions
  - Exports: parsePaginationParams, decodeCursor, encodeCursor, buildPaginationLinks, lastPageOffset, isFirstPage, isLastPage
  - Usage:
    - Server: parse cursor/limit/offset from URL; build Link headers for pagination.
  - Notes: Cursor is base64 JSON { offset }.

- src/problem.ts -> RFC 9457 (Problem Details for HTTP APIs)
  - Exports: createProblem, problemResponse, Problems
  - Usage:
    - Server: return structured error responses with application/problem+json.
    - Use Problems.* helpers to standardize titles/status codes.

- src/cors.ts -> CORS (Fetch standard / W3C)
  - Exports: defaultCorsHeaders, buildCorsHeaders, buildPreflightHeaders, isOriginAllowed, corsHeaders
  - Usage:
    - Server: add appropriate CORS headers to responses; handle OPTIONS.
  - Notes: If you support multiple origins, you must echo request origin (cannot use comma-separated list).

2) Document how to use (recipes)

Recipe A: Conditional GET with ETag + Last-Modified
1) Generate ETag (generateETag or generateETagAsync).
2) Determine lastModified.
3) Call evaluatePreconditions(request, parsedETag, lastModified).
4) If proceed=false, return response with status 304/412 and headers.
5) Else return jsonResponse with ETag/Last-Modified.

Recipe B: Cache-Control for API responses
1) Pick CachePresets or custom CacheOptions.
2) Use cacheControl or getCacheHeaders.
3) Combine with response helper.

Recipe C: Accept negotiation + CSV
1) negotiate(request, ['application/json', 'text/csv']).
2) If csv, use toCSV and csvResponse.
3) Else jsonResponse.

Recipe D: Link header parsing
1) parseLinkHeader(response.headers.get('Link') ?? '').
2) Inspect rel or additional params.

3) Implementation simplifications (code-level)

- Datetime simplification
  - src/datetime.ts: replace manual IMF formatting with date.toUTCString().
  - src/conditional.ts: use formatHTTPDate(lastModified) for consistency.
  - Keep parsing logic as-is for RFC 9110 Section 5.6.7 compliance.

- Response API cleanup
  - Decide:
    - Option 1: remove meta param from jsonResponse and csvResponse.
    - Option 2: include meta in JSON body (e.g., { data, meta }) and document how CSV should represent meta.
  - Update signatures and tests accordingly.

- ETag binary handling
  - src/etag.ts: allow ArrayBuffer/ArrayBufferView to feed directly into crypto.subtle.digest.
  - Only stringify for non-binary object inputs.
  - Document that JSON.stringify ordering affects ETag values.

- CORS correctness
  - Replace origin: string[] behavior:
    - Provide buildCorsHeadersForOrigin(requestOrigin, options) that returns a single origin and adds Vary: Origin.
    - Or remove array support to avoid false correctness.
  - Update docs to explain that browsers do not accept multiple origins in the header.

- Type consolidation
  - Export ETag type from src/types.ts and re-export from src/etag.ts to avoid duplicates.

4) Documentation deliverables

- README.md
  - Purpose and supported RFCs.
  - RFC map table.
  - Usage recipes.
  - API reference summary.
  - Node.js >=22 requirement (matches `package.json` engines and `AGENTS.md`).
  - Examples for ETag/conditional, Cache-Control, Link header, Accept negotiation.

- AGENTS.md
  - How to run tests.
  - Code style conventions.
  - Review checklist focusing on RFC compliance.

5) Validation

- Run: pnpm exec tsx --test test/*.test.ts
- Ensure doc examples match actual exports.
