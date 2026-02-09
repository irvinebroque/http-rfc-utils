# http-rfc-utils

RFC-aligned HTTP utilities for Node.js APIs, covering semantics, caching, negotiation, linking, auth, and structured metadata.

## Why this package

- RFC-first helpers for production HTTP APIs, not framework-specific wrappers.
- Consistent parse/format utilities for request and response headers.
- One entrypoint for standards-aligned utilities across caching, negotiation, linking, and security.
- Practical response builders for common API patterns.

## Installation

Requires Node.js `>=22`.

```bash
pnpm add @irvinebroque/http-rfc-utils
```

```bash
npm install @irvinebroque/http-rfc-utils
```

Import from `@irvinebroque/http-rfc-utils`.

## Quickstart

```ts
import {
    generateETag,
    parseETag,
    evaluatePreconditions,
    formatHTTPDate,
    cacheControl,
    CachePresets,
} from '@irvinebroque/http-rfc-utils';

const body = { id: '42', name: 'Ada' };
const etagHeader = generateETag(body);
const currentETag = parseETag(etagHeader);
const lastModified = new Date();
const request = new Request('https://api.example.test/items/42');

const conditional = evaluatePreconditions(request, currentETag, lastModified);
if (!conditional.proceed) {
    return new Response(null, {
        status: conditional.status,
        headers: conditional.headers,
    });
}

return new Response(JSON.stringify(body), {
    headers: {
        'Content-Type': 'application/json',
        'ETag': etagHeader,
        'Last-Modified': formatHTTPDate(lastModified),
        'Cache-Control': cacheControl(CachePresets.revalidate),
    },
});
```

## Find exact imports by task (common)

All public APIs are exported from `@irvinebroque/http-rfc-utils`.

| Task | Common imports |
| --- | --- |
| ETag generation and comparison | `generateETag`, `generateETagAsync`, `parseETag`, `compareETags` |
| Conditional preconditions (`304`/`412`) | `evaluatePreconditions`, `handleConditionalRequest` |
| Cache-Control and cache headers | `cacheControl`, `getCacheHeaders`, `parseCacheControl`, `CachePresets` |
| Targeted cache policy (`CDN-Cache-Control`) | `parseTargetedCacheControl`, `formatTargetedCacheControl`, `selectTargetedCacheControl` |
| HTTP date and RFC 3339 timestamps | `formatHTTPDate`, `parseHTTPDate`, `toRFC3339`, `parseRFC3339` |
| Media type negotiation | `parseAccept`, `negotiate`, `getResponseFormat`, `toCSV` |
| Language and encoding negotiation | `parseAcceptLanguage`, `negotiateLanguage`, `parseAcceptEncoding`, `negotiateEncoding` |
| Link and Link-Template headers | `parseLinkHeader`, `formatLinkHeader`, `parseLinkTemplateHeader`, `expandLinkTemplate` |
| Pagination links and cursors | `parsePaginationParams`, `encodeCursor`, `decodeCursor`, `buildPaginationLinks` |
| Problem Details responses | `createProblem`, `problemResponse`, `Problems` |
| CORS policy and preflight headers | `buildCorsHeadersForOrigin`, `buildStrictCorsHeadersForOrigin`, `buildPreflightHeaders` |
| Structured Field Values | `parseSfList`, `parseSfDict`, `serializeSfList`, `serializeSfDict`, `SfDate` |
| Trace Context propagation | `parseTraceparent`, `formatTraceparent`, `parseTracestate`, `formatTracestate` |
| JSON Pointer and JSONPath | `parseJsonPointer`, `evaluateJsonPointer`, `parseJsonPath`, `queryJsonPath` |

For the exhaustive task-to-import mapping, see:
`https://github.com/irvinebroque/http-rfc-utils/blob/main/docs/reference/imports-by-task.md`

## RFC/spec coverage snapshot

- HTTP semantics, caching, validators, and freshness: RFC 9110, RFC 9111, RFC 5861, RFC 8246, RFC 9211, RFC 9213, RFC 9875, RFC 9530, RFC 8594, RFC 850.
- Negotiation and request preferences: RFC 7231 (obsoleted by RFC 9110), RFC 5789, RFC 7240, RFC 4647, RFC 9218.
- Linking and discovery: RFC 8288, RFC 9264, RFC 9652, RFC 9727, RFC 8615, RFC 7033, RFC 6415.
- Content and metadata headers: RFC 6265, RFC 6266, RFC 8187, RFC 8941, RFC 9651, RFC 9745, RFC 8942, RFC 9209, RFC 9842.
- Auth and transport security: RFC 7617, RFC 6750, RFC 7616, RFC 6797, RFC 8470, RFC 7838, RFC 9421, RFC 9309, RFC 9116, RFC 7239.
- JSON, URI, and error formats: RFC 9457, RFC 6901, RFC 9535, RFC 3986, RFC 6570, RFC 3339, RFC 6920.
- Additional web specs: W3C Trace Context, W3C Fetch Metadata, Fetch/CORS specifications.

For module-level RFC mapping, see:
`https://github.com/irvinebroque/http-rfc-utils/blob/main/docs/reference/rfc-map.md`

## Key behavior notes

- `jsonResponse` returns `{ data, meta }`; use `simpleJsonResponse` for raw payloads.
- `csvResponse` serializes only data rows; pagination metadata stays in headers.
- `generateETag` and `generateETagAsync` hash `JSON.stringify` output for non-binary objects, so property order affects ETags.
- Digest helpers default to `SHA-256`; use `algorithm: 'MD5'` only for legacy interoperability.
- For production CORS allowlists, prefer `buildStrictCorsHeadersForOrigin` over `defaultCorsHeaders`.
- For untrusted discovery JSON, prefer `tryParseJrd` and `tryParseHostMetaJson`.

## Further docs

- Imports by task (full reference): `https://github.com/irvinebroque/http-rfc-utils/blob/main/docs/reference/imports-by-task.md`
- RFC map (full module coverage): `https://github.com/irvinebroque/http-rfc-utils/blob/main/docs/reference/rfc-map.md`
- Architecture notes: `https://github.com/irvinebroque/http-rfc-utils/blob/main/docs/architecture.md`
- Contributing and maintainer workflows: `https://github.com/irvinebroque/http-rfc-utils/blob/main/CONTRIBUTING.md`
