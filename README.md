# http-rfc-utils

RFC-aligned HTTP utilities for APIs: ETags, conditional requests, caching, link headers, content negotiation, pagination, CORS, and Problem Details.

## Installation

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

## Supported RFCs

- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), Sections 5.6.7, 8.8.2-8.8.3.2, 10.2.3, 12.4.2, 12.5.3-12.5.5, 13.1.1-13.1.5, 13.2.2, 14.1.2-14.4, 15.4.5, 15.5.13, 15.5.17 (HTTP semantics)
- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html), Sections 1.2.2, 5.2, 5.2.2 (Cache-Control)
- [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html), Section 3 (Cache-Control extensions)
- [RFC 8246](https://www.rfc-editor.org/rfc/rfc8246.html), Section 2 (Immutable Cache-Control extension)
- [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html), Sections 3.1-3.4, 6 (Web Linking)
- [RFC 9264](https://www.rfc-editor.org/rfc/rfc9264.html), Sections 4.1-4.2, 6 (Linkset media types)
- [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727.html), Sections 2-4, 7 (api-catalog well-known URI and link relation)
- [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231.html), Sections 5.3.1-5.3.2 (Accept header) — obsoleted by RFC 9110
- [RFC 7240](https://www.rfc-editor.org/rfc/rfc7240.html), Sections 2-3 (Prefer)
- [RFC 7239](https://www.rfc-editor.org/rfc/rfc7239.html), Section 4 (Forwarded header)
- [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265.html), Sections 4.1.1, 4.2.1, 5.1.1, 5.1.3-5.1.4, 5.2-5.4 (Cookies)
- [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266.html), Sections 4-4.3 (Content-Disposition)
- [RFC 8187](https://www.rfc-editor.org/rfc/rfc8187.html), Section 3.2 (Header parameter encoding)
- [RFC 6797](https://www.rfc-editor.org/rfc/rfc6797.html), Sections 6.1-6.1.2 (Strict-Transport-Security)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617.html), Sections 2-2.1 (Basic authentication)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html), Sections 2.1, 3 (Bearer tokens)
- [RFC 7616](https://www.rfc-editor.org/rfc/rfc7616.html), Sections 3.3-3.5 (Digest authentication)
- [RFC 4647](https://www.rfc-editor.org/rfc/rfc4647.html), Section 3 (Language tag matching)
- [RFC 8941](https://www.rfc-editor.org/rfc/rfc8941.html), Sections 3-4 (Structured Field Values)
- [RFC 9651](https://www.rfc-editor.org/rfc/rfc9651.html), Section 3.3.7 (Structured Field Date type)
- [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html), Sections 2-4 (Deprecation header)
- [RFC 8942](https://www.rfc-editor.org/rfc/rfc8942.html), Sections 2.2, 3.1-3.2, 4.2 (Client Hints)
- [RFC 9211](https://www.rfc-editor.org/rfc/rfc9211.html), Sections 2-2.8 (Cache-Status)
- [RFC 9209](https://www.rfc-editor.org/rfc/rfc9209.html), Sections 2-2.4 (Proxy-Status)
- [RFC 9530](https://www.rfc-editor.org/rfc/rfc9530.html), Sections 2-5 (Digest Fields)
- [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), Sections 3.1-3.2, 4.1 (Problem Details)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901.html), Sections 3-7 (JSON Pointer)
- [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535.html), Sections 2.1-2.7 (JSONPath)
- [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339.html), Section 5.6 (timestamps)
- [RFC 850](https://www.rfc-editor.org/rfc/rfc850.html), Section 2 (legacy HTTP-date format, obsolete)
- [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html), Sections 3, 6 (Sunset header)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986.html), Sections 2, 3.1, 3.2.2, 5.2.4, 6.2 (URI Generic Syntax)
- [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570.html), Sections 1.2, 2-3 (URI Template)
- [RFC 9421](https://www.rfc-editor.org/rfc/rfc9421.html), Sections 2-4 (HTTP Message Signatures)
- [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html), Sections 2.1-2.4 (Robots Exclusion Protocol)
- [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116.html), Sections 2.3, 2.5, 3 (security.txt)
- [RFC 7033](https://www.rfc-editor.org/rfc/rfc7033.html), Sections 4.2-4.4 (WebFinger)
- [RFC 6415](https://www.rfc-editor.org/rfc/rfc6415.html), Sections 2-3 (Host Metadata)
- Fetch/CORS specs (CORS headers)

## RFC References

Use the RFC list in `AGENTS.md` as the project source of truth for implementation work.

Use `AUDIT.md` for current coverage status, partials, and explicit out-of-scope behavior.

## Requirements

- Node.js 22 or later

## Find APIs by task

- Conditional requests and validators: `src/etag.ts`, `src/conditional.ts`
- Caching and cache metadata: `src/cache.ts`, `src/cache-status.ts`, `src/proxy-status.ts`
- Negotiation and headers: `src/negotiate.ts`, `src/language.ts`, `src/encoding.ts`, `src/headers.ts`
- Linking and pagination: `src/link.ts`, `src/linkset.ts`, `src/pagination.ts`
- Auth, cookies, and transport: `src/auth.ts`, `src/cookie.ts`, `src/hsts.ts`, `src/cors.ts`
- API response utilities: `src/response.ts`, `src/problem.ts`

## Find exact imports by task

All public APIs are exported from `@irvinebroque/http-rfc-utils`.

| Task | Exact imports |
| --- | --- |
| ETag generation and comparison | `generateETag`, `generateETagAsync`, `parseETag`, `compareETags` |
| Conditional preconditions (`304`/`412`) | `evaluatePreconditions`, `handleConditionalRequest` |
| HTTP date and timestamp handling | `formatHTTPDate`, `parseHTTPDate`, `toRFC3339`, `parseRFC3339` |
| Cache-Control creation and parsing | `cacheControl`, `getCacheHeaders`, `parseCacheControl`, `CachePresets` |
| Problem Details responses | `createProblem`, `problemResponse`, `Problems` |
| Common response builders | `jsonResponse`, `simpleJsonResponse`, `csvResponse`, `noContentResponse` |
| Accept negotiation and CSV output | `parseAccept`, `negotiate`, `getResponseFormat`, `toCSV` |
| Language and encoding negotiation | `parseAcceptLanguage`, `negotiateLanguage`, `parseAcceptEncoding`, `negotiateEncoding` |
| Link header parsing and formatting | `parseLinkHeader`, `formatLinkHeader`, `buildLinkHeader` |
| Linkset and API catalog documents | `parseLinksetJson`, `formatLinksetJson`, `createApiCatalog`, `parseApiCatalog` |
| Pagination helpers | `parsePaginationParams`, `encodeCursor`, `decodeCursor`, `buildPaginationLinks` |
| CORS policies and preflight headers | `buildCorsHeadersForOrigin`, `buildPreflightHeaders`, `isOriginAllowed`, `corsHeaders` |
| Content-Disposition with RFC 8187 params | `parseContentDisposition`, `formatContentDisposition`, `formatHeaderParam` |
| Prefer and Forwarded headers | `parsePrefer`, `formatPrefer`, `formatPreferenceApplied`, `parseForwarded`, `formatForwarded` |
| Retry-After, Vary, and Sunset | `parseRetryAfter`, `formatRetryAfter`, `mergeVary`, `parseSunset`, `formatSunset` |
| Structured Field Values | `parseSfList`, `parseSfDict`, `parseSfItem`, `serializeSfList`, `serializeSfDict`, `serializeSfItem`, `SfDate` |
| JSON Pointer and JSONPath queries | `parseJsonPointer`, `evaluateJsonPointer`, `parseJsonPath`, `queryJsonPath` |
| URI and URI Template utilities | `normalizeUri`, `compareUris`, `parseUriTemplate`, `expandUriTemplate` |
| HTTP message signatures | `parseSignatureInput`, `formatSignatureInput`, `parseSignature`, `createSignatureBase` |
| Robots.txt parsing and matching | `parseRobotsTxt`, `formatRobotsTxt`, `matchUserAgent`, `isAllowed` |
| security.txt handling | `parseSecurityTxt`, `formatSecurityTxt`, `isSecurityTxtExpired`, `validateSecurityTxt` |
| WebFinger (JRD) | `parseJrd`, `formatJrd`, `validateJrd`, `matchResource`, `filterByRel`, `JRD_CONTENT_TYPE` |
| Host metadata (XRD/JSON) | `parseHostMeta`, `formatHostMeta`, `parseHostMetaJson`, `formatHostMetaJson` |

## RFC Map

| Module | RFCs | Exports | Usage |
| --- | --- | --- | --- |
| `src/etag.ts` | RFC 9110 §§8.8.3-8.8.3.2, 13.1.1-13.1.2 | `generateETag`, `generateETagAsync`, `parseETag`, `formatETag`, `compareETags`, `compareETagStrings`, `ETag` | Generate ETags for representations; parse/compare `If-Match` and `If-None-Match`. |
| `src/conditional.ts` | RFC 9110 §§13.1.1-13.1.4, 13.2.2, 15.4.5, 15.5.13 | `evaluatePreconditions`, `handleConditionalRequest`, `parseIfNoneMatch`, `parseIfMatch`, `evaluateIfMatch`, `evaluateIfNoneMatch`, `evaluateIfModifiedSince`, `evaluateIfUnmodifiedSince` | Evaluate conditional request headers and decide `304/412`. |
| `src/datetime.ts` | RFC 3339 §5.6; RFC 9110 §5.6.7; RFC 850 §2 | `toRFC3339`, `parseRFC3339`, `formatHTTPDate`, `parseHTTPDate`, `isExpired`, `secondsUntil` | Format JSON timestamps and HTTP date headers. |
| `src/cache.ts` | RFC 9111 §§1.2.2, 5.2, 5.2.2; RFC 5861 §3; RFC 8246 §2 | `cacheControl`, `getCacheHeaders`, `parseCacheControl`, `CachePresets` | Build/parse `Cache-Control`, add `ETag` + `Last-Modified`. |
| `src/range.ts` | RFC 9110 §§13.1.5, 14.1.2-14.4, 15.5.17 | `parseRange`, `formatContentRange`, `parseContentRange`, `acceptRanges`, `evaluateRange` | Parse and evaluate Range requests; build `Content-Range`. |
| `src/prefer.ts` | RFC 7240 §§2-3 | `parsePrefer`, `formatPrefer`, `formatPreferenceApplied` | Parse `Prefer` and emit `Preference-Applied`. |
| `src/forwarded.ts` | RFC 7239 §4 | `parseForwarded`, `formatForwarded` | Parse and format `Forwarded` header values. |
| `src/ext-value.ts` | RFC 8187 §3.2 | `decodeExtValue`, `encodeExtValue`, `needsExtendedEncoding`, `isAttrChar` | Decode/encode RFC 8187 ext-value for `title*`, `filename*`, etc. |
| `src/content-disposition.ts` | RFC 6266 §§4-4.3; RFC 8187 §3.2 | `parseContentDisposition`, `formatContentDisposition`, `formatHeaderParam` | Parse/format `Content-Disposition` with `filename*` support. |
| `src/cookie.ts` | RFC 6265 §§4.1.1, 4.2.1, 5.1.1, 5.1.3-5.1.4, 5.2-5.4 | `parseCookie`, `formatCookie`, `parseSetCookie`, `formatSetCookie`, `parseCookieDate`, `domainMatches`, `defaultPath`, `pathMatches`, `buildCookieHeader` | Parse/format cookies and build Cookie headers. |
| `src/auth.ts` | RFC 7617 §§2-2.1; RFC 6750 §§2.1, 3; RFC 7616 §§3.3-3.5 | `parseAuthorization`, `formatAuthorization`, `parseWWWAuthenticate`, `formatWWWAuthenticate`, `parseBasicAuthorization`, `formatBasicAuthorization`, `parseBasicChallenge`, `formatBasicChallenge`, `parseBearerAuthorization`, `formatBearerAuthorization`, `parseBearerChallenge`, `formatBearerChallenge`, `parseDigestChallenge`, `formatDigestChallenge`, `parseDigestAuthorization`, `formatDigestAuthorization`, `parseDigestAuthenticationInfo`, `formatDigestAuthenticationInfo`, `computeDigestResponse`, `computeA1`, `computeA2`, `hashDigestUsername`, `DIGEST_AUTH_ALGORITHMS` | Parse/format Basic, Bearer, and Digest auth headers; compute Digest response values. |
| `src/hsts.ts` | RFC 6797 §§6.1-6.1.2, 8.1 | `parseStrictTransportSecurity`, `formatStrictTransportSecurity` | Parse and format `Strict-Transport-Security`. |
| `src/language.ts` | RFC 9110 §§12.4.2, 12.5.4; RFC 4647 §3 | `parseAcceptLanguage`, `negotiateLanguage` | Parse and negotiate `Accept-Language` with basic filtering. |
| `src/encoding.ts` | RFC 9110 §§12.4.2, 12.4.3, 12.5.3 | `parseAcceptEncoding`, `negotiateEncoding` | Parse and negotiate `Accept-Encoding` values. |
| `src/headers.ts` | RFC 9110 §§10.2.3, 12.5.5; RFC 8594 §3 | `parseRetryAfter`, `formatRetryAfter`, `mergeVary`, `parseSunset`, `formatSunset`, `isSunsetImminent` | Retry-After parsing/formatting, Vary merging, and Sunset header. |
| `src/structured-fields.ts` | RFC 8941 §§3-4; RFC 9651 §3.3.7 | `parseSfList`, `parseSfDict`, `parseSfItem`, `serializeSfList`, `serializeSfDict`, `serializeSfItem`, `SfDate` | Structured field parsing and serialization with RFC 9651 Date type support. |
| `src/deprecation.ts` | RFC 9745 §§2-4; RFC 9651 §3.3.7 | `parseDeprecation`, `formatDeprecation`, `isDeprecated`, `validateDeprecationSunsetOrder`, `buildDeprecationHeaders` | Parse/format Deprecation header; validate deprecation/sunset ordering. |
| `src/client-hints.ts` | RFC 8942 §§2.2, 3.1-3.2, 4.2 | `parseAcceptCH`, `formatAcceptCH`, `filterClientHints`, `mergeClientHintsVary` | Accept-CH parsing and Vary helper for Client Hints. |
| `src/cache-status.ts` | RFC 9211 §§2-2.8 | `parseCacheStatus`, `formatCacheStatus` | Parse and format Cache-Status responses. |
| `src/proxy-status.ts` | RFC 9209 §§2-2.4 | `parseProxyStatus`, `formatProxyStatus`, `isProxyErrorType`, `PROXY_ERROR_TYPES` | Parse and format Proxy-Status responses; validate error types. |
| `src/digest.ts` | RFC 9530 §§2-5 | `parseContentDigest`, `parseReprDigest`, `parseWantContentDigest`, `parseWantReprDigest`, `formatContentDigest`, `formatReprDigest`, `formatWantContentDigest`, `formatWantReprDigest`, `generateDigest`, `verifyDigest`, `DIGEST_ALGORITHMS`, `isActiveAlgorithm`, `isDeprecatedAlgorithm` | Parse/format Content-Digest, Repr-Digest, and Want-* preference headers; generate and verify SHA-256/SHA-512 digests. |
| `src/link.ts` | RFC 8288 §§3-3.5, 6; RFC 8187 §3.2; RFC 9264 §6 | `formatLink`, `formatLinkHeader`, `parseLinkHeader`, `buildLinkHeader`, `quoteIfNeeded`, `unquote`, `LinkRelation` | Assemble and parse `Link` headers with `title*` (RFC 8187) and multiple `hreflang` support. |
| `src/linkset.ts` | RFC 9264 §§4.1-4.2, 6; RFC 9727 §§2-4, 7 | `parseLinkset`, `parseLinksetJson`, `formatLinkset`, `formatLinksetJson`, `linksetToJson`, `jsonToLinkset`, `isValidLinkset`, `linksetToLinks`, `linksToLinkset`, `createApiCatalog`, `parseApiCatalog`, `isApiCatalog`, `LINKSET_MEDIA_TYPE`, `API_CATALOG_PROFILE`, `API_CATALOG_PATH` | Parse/format linkset documents; create/parse API catalogs per RFC 9727. |
| `src/negotiate.ts` | RFC 7231 §§5.3.1-5.3.2 | `parseAccept`, `negotiate`, `getResponseFormat`, `toCSV`, `MEDIA_TYPES`, `MIME_TO_FORMAT` | Negotiate response media types and build CSV. |
| `src/response.ts` | RFC 9110 §§8.8.2-8.8.3; RFC 9111 §5.2.2; RFC 8288 §3; RFC 6266 §4 | `optionsResponse`, `headResponse`, `jsonResponse`, `csvResponse`, `redirectResponse`, `simpleJsonResponse`, `noContentResponse`, `textResponse` | Opinionated response helpers (CORS + cache + pagination). |
| `src/pagination.ts` | RFC 8288 §§3, 3.3 + API conventions | `parsePaginationParams`, `decodeCursor`, `encodeCursor`, `buildPaginationLinks`, `lastPageOffset`, `isFirstPage`, `isLastPage` | Cursor/offset parsing and pagination links. |
| `src/problem.ts` | RFC 9457 §§3.1-3.2, 4.1 | `createProblem`, `problemResponse`, `Problems` | Return structured error responses. |
| `src/json-pointer.ts` | RFC 6901 §§3-7 | `parseJsonPointer`, `formatJsonPointer`, `evaluateJsonPointer`, `toUriFragment`, `fromUriFragment`, `isValidJsonPointer` | Parse, format, and evaluate JSON Pointers; URI fragment encoding. |
| `src/jsonpath.ts` | RFC 9535 §§2.1-2.7 | `parseJsonPath`, `queryJsonPath`, `queryJsonPathNodes`, `isValidJsonPath`, `formatNormalizedPath`, `compileJsonPath` | Parse and execute JSONPath queries; return values or nodes with normalized paths. |
| `src/uri.ts` | RFC 3986 §§2, 3.1, 3.2.2, 5.2.4, 6.2 | `percentEncode`, `percentDecode`, `normalizeUri`, `removeDotSegments`, `compareUris`, `isUnreserved`, `isReserved` | URI percent-encoding, normalization, and comparison. |
| `src/uri-template.ts` | RFC 6570 §§1.2, 2-3 | `parseUriTemplate`, `expandUriTemplate`, `isValidUriTemplate`, `getTemplateVariables`, `compileUriTemplate` | Parse and expand URI Templates with support for all Level 4 operators and modifiers. |
| `src/http-signatures.ts` | RFC 9421 §§2-4 | `parseSignatureInput`, `formatSignatureInput`, `parseSignature`, `formatSignature`, `parseComponentIdentifier`, `formatComponentIdentifier`, `canonicalizeFieldValue`, `binaryWrapFieldValues`, `deriveComponentValue`, `createSignatureBase`, `isDerivedComponent`, `DERIVED_COMPONENTS` | Parse/format Signature-Input and Signature fields; create signature base strings for HTTP message signatures. |
| `src/robots.ts` | RFC 9309 §§2.1-2.4 | `parseRobotsTxt`, `formatRobotsTxt`, `matchUserAgent`, `isAllowed` | Parse and format robots.txt; match user agents; check path access with longest-match-wins, wildcards, and `$`. |
| `src/security-txt.ts` | RFC 9116 §§2.3, 2.5, 3 | `parseSecurityTxt`, `formatSecurityTxt`, `isSecurityTxtExpired`, `validateSecurityTxt` | Parse and format security.txt with CRLF; validate required fields and expiry. |
| `src/webfinger.ts` | RFC 7033 §§4.2-4.4 | `parseJrd`, `formatJrd`, `validateJrd`, `matchResource`, `filterByRel`, `JRD_CONTENT_TYPE` | Parse/format WebFinger JRD; match resources; filter links by `rel`. |
| `src/host-meta.ts` | RFC 6415 §§2-3 | `parseHostMeta`, `formatHostMeta`, `parseHostMetaJson`, `formatHostMetaJson` | Parse/format host-meta XRD XML and JSON. |
| `src/cors.ts` | Fetch/CORS specs | `defaultCorsHeaders`, `buildCorsHeaders`, `buildCorsHeadersForOrigin`, `buildPreflightHeaders`, `isOriginAllowed`, `corsHeaders` | Build CORS headers for single or multiple origins. |

## Recipes

### Conditional GET with ETag + Last-Modified

1. Generate an ETag (`generateETag` or `generateETagAsync`).
2. Determine `lastModified`.
3. Call `evaluatePreconditions(request, currentETag, lastModified)`.
4. If `proceed === false`, return `304` or `412` with the provided headers.
5. Otherwise return your response with `ETag` and `Last-Modified`.

```ts
import { evaluatePreconditions } from '@irvinebroque/http-rfc-utils';

const result = evaluatePreconditions(request, currentETag, lastModified);

if (!result.proceed) {
    return new Response(null, {
        status: result.status,
        headers: result.headers,
    });
}
```

### Cache-Control for API responses

1. Pick `CachePresets` or custom `CacheOptions`.
2. Use `cacheControl` or `getCacheHeaders`.
3. Combine with `jsonResponse`/`simpleJsonResponse`.

```ts
import { cacheControl, CachePresets } from '@irvinebroque/http-rfc-utils';

const headers = {
    'Cache-Control': cacheControl(CachePresets.revalidate),
};
```

### Accept negotiation + CSV

1. `negotiate(request, ['application/json', 'text/csv'])`.
2. If CSV, `toCSV(data)` and `csvResponse`.
3. Otherwise `jsonResponse`.

### Link header parsing

```ts
import { parseLinkHeader } from '@irvinebroque/http-rfc-utils';

const links = parseLinkHeader(response.headers.get('Link') ?? '');
```

## API Summary

- `etag`: generate/parse/compare validators; async uses `crypto.subtle` for hashing.
- `conditional`: RFC 9110 precondition evaluation with correct precedence.
- `datetime`: RFC 3339 timestamps and RFC 9110 HTTP dates.
- `cache`: Cache-Control builder/parser plus combined cache headers.
- `link`: RFC 8288 Link formatter/parser; handles quoted commas and escapes.
- `linkset`: RFC 9264 linkset document parser/formatter; RFC 9727 API catalog creation/parsing.
- `negotiate`: Accept parsing + media type negotiation; `toCSV` helper.
- `language`: Accept-Language parsing + basic filtering negotiation.
- `encoding`: Accept-Encoding parsing + negotiation.
- `range`: Range parsing + evaluation helpers.
- `prefer`: Prefer parsing + Preference-Applied formatting.
- `forwarded`: Forwarded header parsing + formatting.
- `content-disposition`: Content-Disposition parsing + formatting with RFC 8187 ext-value utilities.
- `cookie`: Cookie/Set-Cookie parsing, matching helpers, and Cookie header generation.
- `auth`: Basic, Bearer, and Digest Authorization + WWW-Authenticate parsing/formatting; Digest response computation.
- `hsts`: Strict-Transport-Security parsing/formatting.
- `headers`: Retry-After parsing/formatting, Vary merging, and Sunset header.
- `structured-fields`: Structured Field Values parsing + serialization with RFC 9651 Date type.
- `deprecation`: RFC 9745 Deprecation header parsing/formatting; deprecation/sunset validation.
- `client-hints`: Accept-CH parsing and Vary helper for Client Hints.
- `cache-status`: Cache-Status parsing and formatting.
- `proxy-status`: Proxy-Status parsing and formatting; error type validation.
- `digest`: RFC 9530 Content-Digest and Repr-Digest parsing/formatting; Want-* preferences; SHA-256/SHA-512 generation and verification.
- `response`: opinionated helpers for API responses with CORS + caching.
- `pagination`: cursor/limit parsing and Link header pagination.
- `problem`: RFC 9457 Problem Details responses.
- `json-pointer`: RFC 6901 JSON Pointer parsing, formatting, and evaluation.
- `jsonpath`: RFC 9535 JSONPath query parsing and execution with filters, slices, and built-in functions.
- `uri`: RFC 3986 URI percent-encoding, normalization, and comparison.
- `uri-template`: RFC 6570 URI Template parsing and expansion; all Level 4 operators and modifiers.
- `http-signatures`: RFC 9421 HTTP Message Signatures; Signature-Input/Signature field parsing; signature base creation.
- `robots`: RFC 9309 robots.txt parsing/formatting; user-agent matching and path access checking.
- `security-txt`: RFC 9116 security.txt parsing/formatting (CRLF); validation and expiry checking.
- `webfinger`: RFC 7033 JRD parsing/formatting; resource matching and rel filtering.
- `host-meta`: RFC 6415 host-meta XRD XML and JSON parsing/formatting.
- `cors`: permissive defaults plus origin-aware header builder.

## Notes

- `jsonResponse` returns `{ data, meta }`; use `simpleJsonResponse` for raw payloads.
- `csvResponse` only serializes data rows; pagination metadata remains in headers.
- `generateETagAsync` accepts `ArrayBuffer`/`ArrayBufferView` and hashes bytes directly.
- `generateETag` and `generateETagAsync` rely on `JSON.stringify` for non-binary objects; property order affects the resulting ETag.
- For multiple CORS origins, use `buildCorsHeadersForOrigin(requestOrigin, options)` and include `Vary: Origin`.

## Testing

```bash
pnpm test
```
