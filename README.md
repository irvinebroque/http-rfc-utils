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
- [RFC 5789](https://www.rfc-editor.org/rfc/rfc5789.html), Sections 2, 2.2, 3.1-3.2 (PATCH method and Accept-Patch advertisement)
- [RFC 7240](https://www.rfc-editor.org/rfc/rfc7240.html), Sections 2-3 (Prefer)
- [RFC 7239](https://www.rfc-editor.org/rfc/rfc7239.html), Section 4 (Forwarded header)
- [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265.html), Sections 4.1.1, 4.2.1, 5.1.1, 5.1.3-5.1.4, 5.2-5.4 (Cookies)
- [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266.html), Sections 4-4.3 (Content-Disposition)
- [RFC 8187](https://www.rfc-editor.org/rfc/rfc8187.html), Section 3.2 (Header parameter encoding)
- [RFC 6797](https://www.rfc-editor.org/rfc/rfc6797.html), Sections 6.1-6.1.2 (Strict-Transport-Security)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617.html), Sections 2-2.1 (Basic authentication)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html), Sections 2.1, 3 (Bearer tokens)
- [RFC 7616](https://www.rfc-editor.org/rfc/rfc7616.html), Sections 3.3-3.5 (Digest authentication)
- [RFC 8470](https://www.rfc-editor.org/rfc/rfc8470.html), Sections 5.1-5.2 (Early-Data and 425 Too Early)
- [RFC 7838](https://www.rfc-editor.org/rfc/rfc7838.html), Sections 3, 3.1, 5 (Alt-Svc and Alt-Used)
- [RFC 4647](https://www.rfc-editor.org/rfc/rfc4647.html), Section 3 (Language tag matching)
- [RFC 8941](https://www.rfc-editor.org/rfc/rfc8941.html), Sections 3-4 (Structured Field Values)
- [RFC 9651](https://www.rfc-editor.org/rfc/rfc9651.html), Sections 3.3.7-3.3.8, 4.1.11, 4.2.10 (Structured Field Date + Display String types)
- [RFC 9652](https://www.rfc-editor.org/rfc/rfc9652.html), Sections 2-2.1 (Link-Template header)
- [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html), Sections 2-4 (Deprecation header)
- [RFC 8942](https://www.rfc-editor.org/rfc/rfc8942.html), Sections 2.2, 3.1-3.2, 4.2 (Client Hints)
- [RFC 9211](https://www.rfc-editor.org/rfc/rfc9211.html), Sections 2-2.8 (Cache-Status)
- [RFC 9213](https://www.rfc-editor.org/rfc/rfc9213.html), Sections 2-3.1 (Targeted Cache-Control and CDN-Cache-Control)
- [RFC 9875](https://www.rfc-editor.org/rfc/rfc9875.html), Sections 2-3 (Cache groups and invalidation signals)
- [RFC 9842](https://www.rfc-editor.org/rfc/rfc9842.html), Sections 2-2.3, 6.1-6.2 (Compression Dictionary Transport negotiation headers)
- [RFC 9218](https://www.rfc-editor.org/rfc/rfc9218.html), Sections 4-5, 8 (Priority header)
- [RFC 9209](https://www.rfc-editor.org/rfc/rfc9209.html), Sections 2-2.4 (Proxy-Status)
- [RFC 9530](https://www.rfc-editor.org/rfc/rfc9530.html), Sections 2-5 (Digest Fields)
- [RFC 6920](https://www.rfc-editor.org/rfc/rfc6920.html), Sections 2-5, 8.1, 9.4-9.5 (Named Information URIs)
- [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615.html), Section 3 (Well-Known URIs)
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
- [W3C Trace Context](https://www.w3.org/TR/trace-context/), Sections 3.2-3.5, 4.2-4.3 (`traceparent` and `tracestate`)
- [W3C Fetch Metadata](https://www.w3.org/TR/fetch-metadata/), Sections 2.1-2.4, 5.1 (`Sec-Fetch-*` request headers)

## RFC References

Use the RFC list in `AGENTS.md` as the project source of truth for implementation work.

Use the RFC map below for module-level coverage and exported API references.

## Requirements

- Node.js 22 or later

## Find APIs by task

- Conditional requests and validators: `src/etag.ts`, `src/conditional.ts`
- Caching and cache metadata: `src/cache.ts`, `src/targeted-cache-control.ts`, `src/cache-status.ts`, `src/proxy-status.ts`
- Cache grouping and grouped invalidation signals: `src/cache-groups.ts`
- Compression dictionary negotiation helpers: `src/compression-dictionary.ts`
- Request urgency and incremental delivery hints: `src/priority.ts`
- Early data replay signaling and `425 Too Early` eligibility: `src/early-data.ts`
- Alternative Services header parsing and formatting: `src/alt-svc.ts`
- Fetch Metadata parsing and request policy evaluation: `src/fetch-metadata.ts`
- Distributed tracing header propagation: `src/trace-context.ts`
- Negotiation and headers: `src/negotiate.ts`, `src/language.ts`, `src/encoding.ts`, `src/headers.ts`
- PATCH capability advertisement: `src/patch.ts`
- Linking and pagination: `src/link.ts`, `src/link-template.ts`, `src/linkset.ts`, `src/pagination.ts`
- Auth, cookies, and transport: `src/auth.ts`, `src/cookie.ts`, `src/hsts.ts`, `src/cors.ts`
- Named Information hash URIs: `src/ni.ts`
- Well-known URI/path helpers: `src/well-known.ts`
- API response utilities: `src/response.ts`, `src/problem.ts`
- Internal architecture notes: `docs/architecture.md`

## Find exact imports by task

All public APIs are exported from `@irvinebroque/http-rfc-utils`.

| Task | Exact imports |
| --- | --- |
| ETag generation and comparison | `generateETag`, `generateETagAsync`, `parseETag`, `compareETags` |
| Conditional preconditions (`304`/`412`) | `evaluatePreconditions`, `handleConditionalRequest` |
| HTTP date and timestamp handling | `formatHTTPDate`, `parseHTTPDate`, `toRFC3339`, `parseRFC3339` |
| Cache-Control creation and parsing | `cacheControl`, `getCacheHeaders`, `parseCacheControl`, `CachePresets` |
| Targeted cache policy fields (`CDN-Cache-Control`) | `parseTargetedCacheControl`, `formatTargetedCacheControl`, `parseCdnCacheControl`, `formatCdnCacheControl`, `selectTargetedCacheControl` |
| Cache groups (`Cache-Groups`, `Cache-Group-Invalidation`) | `parseCacheGroups`, `formatCacheGroups`, `parseCacheGroupInvalidation`, `formatCacheGroupInvalidation`, `sharesCacheGroup` |
| Compression dictionary negotiation (`Use-As-Dictionary`, `Available-Dictionary`, `Dictionary-ID`) | `parseUseAsDictionary`, `formatUseAsDictionary`, `validateUseAsDictionary`, `parseAvailableDictionary`, `formatAvailableDictionary`, `parseDictionaryId`, `formatDictionaryId`, `matchesDictionary`, `selectBestDictionary`, `mergeDictionaryVary` |
| Problem Details responses | `createProblem`, `problemResponse`, `Problems` |
| Common response builders | `jsonResponse`, `simpleJsonResponse`, `csvResponse`, `noContentResponse` |
| Accept negotiation and CSV output | `parseAccept`, `negotiate`, `getResponseFormat`, `toCSV` |
| PATCH capability advertisement (`Accept-Patch`) | `parseAcceptPatch`, `formatAcceptPatch`, `supportsPatch` |
| Language and encoding negotiation | `parseAcceptLanguage`, `negotiateLanguage`, `parseAcceptEncoding`, `negotiateEncoding` |
| Link header parsing and formatting | `parseLinkHeader`, `formatLinkHeader`, `buildLinkHeader` |
| Link-Template parsing, formatting, and expansion | `parseLinkTemplateHeader`, `formatLinkTemplateHeader`, `expandLinkTemplate`, `resolveTemplateVariableUri` |
| Linkset and API catalog documents | `parseLinksetJson`, `formatLinksetJson`, `createApiCatalog`, `parseApiCatalog` |
| Pagination helpers | `parsePaginationParams`, `encodeCursor`, `decodeCursor`, `buildPaginationLinks` |
| CORS policies and preflight headers | `buildCorsHeaders`, `buildCorsHeadersForOrigin`, `buildStrictCorsHeadersForOrigin`, `buildPreflightHeaders`, `isOriginAllowed`, `corsHeaders` |
| Content-Disposition with RFC 8187 params | `parseContentDisposition`, `formatContentDisposition`, `formatHeaderParam` |
| Prefer and Forwarded headers | `parsePrefer`, `formatPrefer`, `formatPreferenceApplied`, `parseForwarded`, `formatForwarded` |
| Retry-After, Vary, and Sunset | `parseRetryAfter`, `formatRetryAfter`, `mergeVary`, `parseSunset`, `formatSunset` |
| Early-Data parsing and `425 Too Early` gating | `parseEarlyData`, `formatEarlyData`, `hasEarlyDataSignal`, `canSend425` |
| Alternative Services (`Alt-Svc`, `Alt-Used`) | `parseAltSvc`, `formatAltSvc`, `parseAltUsed`, `formatAltUsed` |
| Fetch Metadata request filtering | `parseFetchMetadata`, `evaluateFetchMetadataPolicy`, `fetchMetadataVary` |
| Structured Field Values | `parseSfList`, `parseSfDict`, `parseSfItem`, `serializeSfList`, `serializeSfDict`, `serializeSfItem`, `SfDate`, `SfDisplayString` |
| Priority header parsing and merge behavior | `parsePriority`, `formatPriority`, `applyPriorityDefaults`, `mergePriority` |
| Trace Context parsing and propagation | `parseTraceparent`, `formatTraceparent`, `validateTraceparent`, `parseTracestate`, `formatTracestate`, `validateTracestate`, `updateTraceparentParent`, `restartTraceparent`, `addOrUpdateTracestate`, `removeTracestateKey`, `truncateTracestate` |
| JSON Pointer and JSONPath queries | `parseJsonPointer`, `evaluateJsonPointer`, `parseJsonPath`, `queryJsonPath`, `queryJsonPathNodes` |
| URI and URI Template utilities | `normalizeUri`, `compareUris`, `parseUriTemplate`, `expandUriTemplate` |
| Named Information (NI) URIs and digest checks | `parseNiUri`, `formatNiUri`, `compareNiUris`, `parseNiUrlSegment`, `formatNiUrlSegment`, `toWellKnownNiUrl`, `fromWellKnownNiUrl`, `computeNiDigest`, `verifyNiDigest` |
| Well-known path and URI validation/building | `WELL_KNOWN_PREFIX`, `isWellKnownPath`, `isWellKnownUri`, `validateWellKnownSuffix`, `buildWellKnownPath`, `buildWellKnownUri`, `parseWellKnownPath` |
| HTTP message signatures | `parseSignatureInput`, `formatSignatureInput`, `parseSignature`, `createSignatureBase` |
| Robots.txt parsing and matching | `parseRobotsTxt`, `formatRobotsTxt`, `matchUserAgent`, `isAllowed` |
| security.txt handling | `parseSecurityTxt`, `formatSecurityTxt`, `isSecurityTxtExpired`, `validateSecurityTxt` |
| WebFinger (JRD) | `parseJrd`, `tryParseJrd`, `formatJrd`, `validateJrd`, `matchResource`, `filterByRel`, `JRD_CONTENT_TYPE` |
| Host metadata (XRD/JSON) | `parseHostMeta`, `formatHostMeta`, `parseHostMetaJson`, `tryParseHostMetaJson`, `formatHostMetaJson` |

## RFC Map

| Module | RFCs | Exports | Usage |
| --- | --- | --- | --- |
| `src/etag.ts` | RFC 9110 §§8.8.3-8.8.3.2, 13.1.1-13.1.2 | `generateETag`, `generateETagAsync`, `parseETag`, `formatETag`, `compareETags`, `compareETagStrings`, `ETag` | Generate ETags for representations; parse/compare `If-Match` and `If-None-Match`. |
| `src/conditional.ts` | RFC 9110 §§13.1.1-13.1.4, 13.2.2, 15.4.5, 15.5.13 | `evaluatePreconditions`, `handleConditionalRequest`, `parseIfNoneMatch`, `parseIfMatch`, `evaluateIfMatch`, `evaluateIfNoneMatch`, `evaluateIfModifiedSince`, `evaluateIfUnmodifiedSince` | Evaluate conditional request headers and decide `304/412`. |
| `src/datetime.ts` | RFC 3339 §5.6; RFC 9110 §5.6.7; RFC 850 §2 | `toRFC3339`, `parseRFC3339`, `formatHTTPDate`, `parseHTTPDate`, `isExpired`, `secondsUntil` | Format JSON timestamps and HTTP date headers. |
| `src/cache.ts` | RFC 9111 §§1.2.2, 5.2, 5.2.2; RFC 5861 §3; RFC 8246 §2 | `cacheControl`, `getCacheHeaders`, `parseCacheControl`, `CachePresets` | Build/parse `Cache-Control`, add `ETag` + `Last-Modified`. |
| `src/targeted-cache-control.ts` | RFC 9213 §§2-2.2, 3.1 | `parseTargetedCacheControl`, `formatTargetedCacheControl`, `parseCdnCacheControl`, `formatCdnCacheControl`, `selectTargetedCacheControl` | Parse/format targeted cache-control fields (`CDN-Cache-Control`) and select effective policy by target-list precedence with fallback. |
| `src/cache-groups.ts` | RFC 9875 §§2-2.2.1, 3 | `parseCacheGroups`, `formatCacheGroups`, `parseCacheGroupInvalidation`, `formatCacheGroupInvalidation`, `sharesCacheGroup` | Parse/format `Cache-Groups` and `Cache-Group-Invalidation` as Structured Field lists of strings; compare grouped responses by case-sensitive group string and same-origin requirements. |
| `src/compression-dictionary.ts` | RFC 9842 §§2-2.3, 6.1-6.2 | `parseUseAsDictionary`, `formatUseAsDictionary`, `validateUseAsDictionary`, `parseAvailableDictionary`, `formatAvailableDictionary`, `parseDictionaryId`, `formatDictionaryId`, `matchesDictionary`, `selectBestDictionary`, `mergeDictionaryVary` | Parse/format dictionary negotiation headers and select one best dictionary deterministically; merge dictionary-aware `Vary` fields. |
| `src/range.ts` | RFC 9110 §§13.1.5, 14.1.2-14.4, 15.5.17 | `parseRange`, `formatContentRange`, `parseContentRange`, `acceptRanges`, `evaluateRange` | Parse and evaluate Range requests; build `Content-Range`. |
| `src/prefer.ts` | RFC 7240 §§2-3 | `parsePrefer`, `formatPrefer`, `formatPreferenceApplied` | Parse `Prefer` and emit `Preference-Applied`. |
| `src/forwarded.ts` | RFC 7239 §4 | `parseForwarded`, `formatForwarded` | Parse and format `Forwarded` header values. |
| `src/ext-value.ts` | RFC 8187 §3.2 | `decodeExtValue`, `encodeExtValue`, `needsExtendedEncoding`, `isAttrChar` | Decode/encode RFC 8187 ext-value for `title*`, `filename*`, etc. |
| `src/content-disposition.ts` | RFC 6266 §§4-4.3; RFC 8187 §3.2 | `parseContentDisposition`, `formatContentDisposition`, `formatHeaderParam` | Parse/format `Content-Disposition` with `filename*` support. |
| `src/cookie.ts` | RFC 6265 §§4.1.1, 4.2.1, 5.1.1, 5.1.3-5.1.4, 5.2-5.4 | `parseCookie`, `formatCookie`, `parseSetCookie`, `formatSetCookie`, `parseCookieDate`, `domainMatches`, `defaultPath`, `pathMatches`, `buildCookieHeader` | Parse/format cookies and build Cookie headers. |
| `src/auth.ts` | RFC 7617 §§2-2.1; RFC 6750 §§2.1, 3; RFC 7616 §§3.3-3.5 | `parseAuthorization`, `formatAuthorization`, `parseWWWAuthenticate`, `formatWWWAuthenticate`, `parseBasicAuthorization`, `formatBasicAuthorization`, `parseBasicChallenge`, `formatBasicChallenge`, `parseBearerAuthorization`, `formatBearerAuthorization`, `parseBearerChallenge`, `formatBearerChallenge`, `parseDigestChallenge`, `formatDigestChallenge`, `parseDigestAuthorization`, `formatDigestAuthorization`, `parseDigestAuthenticationInfo`, `formatDigestAuthenticationInfo`, `computeDigestResponse`, `computeA1`, `computeA2`, `hashDigestUsername`, `DIGEST_AUTH_ALGORITHMS` | Parse/format Basic, Bearer, and Digest auth headers; compute Digest response values (default algorithm is SHA-256, with explicit MD5 opt-in for legacy interop). |
| `src/hsts.ts` | RFC 6797 §§6.1-6.1.2, 8.1 | `parseStrictTransportSecurity`, `formatStrictTransportSecurity` | Parse and format `Strict-Transport-Security`. |
| `src/language.ts` | RFC 9110 §§12.4.2, 12.5.4; RFC 4647 §3 | `parseAcceptLanguage`, `negotiateLanguage` | Parse and negotiate `Accept-Language` with basic filtering. |
| `src/encoding.ts` | RFC 9110 §§12.4.2, 12.4.3, 12.5.3 | `parseAcceptEncoding`, `negotiateEncoding` | Parse and negotiate `Accept-Encoding` values. |
| `src/headers.ts` | RFC 9110 §§10.2.3, 12.5.5; RFC 8594 §3 | `parseRetryAfter`, `formatRetryAfter`, `mergeVary`, `parseSunset`, `formatSunset`, `isSunsetImminent` | Retry-After parsing/formatting, Vary merging, and Sunset header. |
| `src/early-data.ts` | RFC 8470 §§5.1-5.2 | `parseEarlyData`, `formatEarlyData`, `hasEarlyDataSignal`, `canSend425` | Parse/format `Early-Data`; detect replay-risk signaling; gate `425 Too Early` emission eligibility. |
| `src/alt-svc.ts` | RFC 7838 §§3, 3.1, 5 | `parseAltSvc`, `formatAltSvc`, `parseAltUsed`, `formatAltUsed` | Parse/format `Alt-Svc` (`clear` or ordered alternatives with `ma`/`persist`) and `Alt-Used` host[:port] values. |
| `src/fetch-metadata.ts` | W3C Fetch Metadata §§2.1-2.4, 5.1 | `parseSecFetchDest`, `formatSecFetchDest`, `parseSecFetchMode`, `formatSecFetchMode`, `parseSecFetchSite`, `formatSecFetchSite`, `parseSecFetchUser`, `formatSecFetchUser`, `parseFetchMetadata`, `evaluateFetchMetadataPolicy`, `fetchMetadataVary` | Parse/format `Sec-Fetch-*` request headers, evaluate strict/permissive server-side policy decisions, and merge relevant `Vary` values. |
| `src/structured-fields.ts` | RFC 8941 §§3-4; RFC 9651 §§3.3.7-3.3.8, 4.1.11, 4.2.10 | `parseSfList`, `parseSfDict`, `parseSfItem`, `serializeSfList`, `serializeSfDict`, `serializeSfItem`, `SfDate`, `SfDisplayString` | Structured field parsing and serialization with RFC 9651 Date and Display String type support. |
| `src/deprecation.ts` | RFC 9745 §§2-4; RFC 9651 §3.3.7 | `parseDeprecation`, `formatDeprecation`, `isDeprecated`, `validateDeprecationSunsetOrder`, `buildDeprecationHeaders` | Parse/format Deprecation header; validate deprecation/sunset ordering. |
| `src/client-hints.ts` | RFC 8942 §§2.2, 3.1-3.2, 4.2 | `parseAcceptCH`, `formatAcceptCH`, `filterClientHints`, `mergeClientHintsVary` | Accept-CH parsing and Vary helper for Client Hints. |
| `src/cache-status.ts` | RFC 9211 §§2-2.8 | `parseCacheStatus`, `formatCacheStatus` | Parse and format Cache-Status responses. |
| `src/priority.ts` | RFC 9218 §§4-5, 8 | `parsePriority`, `formatPriority`, `applyPriorityDefaults`, `mergePriority` | Parse/format Priority dictionary members (`u`, `i`) and merge client/server signals. |
| `src/trace-context.ts` | W3C Trace Context §§3.2-3.5, 4.2-4.3 | `parseTraceparent`, `formatTraceparent`, `validateTraceparent`, `parseTracestate`, `formatTracestate`, `validateTracestate`, `updateTraceparentParent`, `restartTraceparent`, `addOrUpdateTracestate`, `removeTracestateKey`, `truncateTracestate` | Parse/format/validate `traceparent` and `tracestate`, rotate parent IDs, and enforce list-member limits and ordering. |
| `src/proxy-status.ts` | RFC 9209 §§2-2.4 | `parseProxyStatus`, `formatProxyStatus`, `isProxyErrorType`, `PROXY_ERROR_TYPES` | Parse and format Proxy-Status responses; validate error types. |
| `src/digest.ts` | RFC 9530 §§2-5 | `parseContentDigest`, `parseReprDigest`, `parseWantContentDigest`, `parseWantReprDigest`, `formatContentDigest`, `formatReprDigest`, `formatWantContentDigest`, `formatWantReprDigest`, `generateDigest`, `verifyDigest`, `DIGEST_ALGORITHMS`, `isActiveAlgorithm`, `isDeprecatedAlgorithm` | Parse/format Content-Digest, Repr-Digest, and Want-* preference headers; generate and verify SHA-256/SHA-512 digests. |
| `src/ni.ts` | RFC 6920 §§2-5, 8.1, 9.4-9.5 | `parseNiUri`, `formatNiUri`, `compareNiUris`, `parseNiUrlSegment`, `formatNiUrlSegment`, `toWellKnownNiUrl`, `fromWellKnownNiUrl`, `computeNiDigest`, `verifyNiDigest` | Parse and format `ni` URIs, compare NI identity by algorithm+digest bytes, map `.well-known/ni` URLs, and compute/verify NI digest values. |
| `src/well-known.ts` | RFC 8615 §3; RFC 3986 §3.3 | `WELL_KNOWN_PREFIX`, `isWellKnownPath`, `isWellKnownUri`, `validateWellKnownSuffix`, `buildWellKnownPath`, `buildWellKnownUri`, `parseWellKnownPath` | Validate and build top-level `/.well-known/{suffix}` paths and HTTP(S) URIs with single-segment suffix constraints. |
| `src/link.ts` | RFC 8288 §§3-3.5, 6; RFC 8187 §3.2; RFC 9264 §6 | `formatLink`, `formatLinkHeader`, `parseLinkHeader`, `buildLinkHeader`, `quoteIfNeeded`, `unquote`, `LinkRelation` | Assemble and parse `Link` headers with `title*` (RFC 8187) and multiple `hreflang` support. |
| `src/link-template.ts` | RFC 9652 §§2-2.1; RFC 6570 §3; RFC 9651 §3.3.8 | `parseLinkTemplateHeader`, `formatLinkTemplateHeader`, `expandLinkTemplate`, `resolveTemplateVariableUri` | Parse/format `Link-Template` as Structured Fields and expand templated target/anchor links with variable URI resolution. |
| `src/linkset.ts` | RFC 9264 §§4.1-4.2, 6; RFC 9727 §§2-4, 7 | `parseLinkset`, `parseLinksetJson`, `formatLinkset`, `formatLinksetJson`, `linksetToJson`, `jsonToLinkset`, `isValidLinkset`, `linksetToLinks`, `linksToLinkset`, `createApiCatalog`, `parseApiCatalog`, `isApiCatalog`, `LINKSET_MEDIA_TYPE`, `API_CATALOG_PROFILE`, `API_CATALOG_PATH` | Parse/format linkset documents; create/parse API catalogs per RFC 9727. |
| `src/negotiate.ts` | RFC 7231 §§5.3.1-5.3.2 | `parseAccept`, `negotiate`, `getResponseFormat`, `toCSV`, `MEDIA_TYPES`, `MIME_TO_FORMAT` | Negotiate response media types and build CSV. |
| `src/patch.ts` | RFC 5789 §§2, 2.2, 3.1-3.2 | `parseAcceptPatch`, `formatAcceptPatch`, `supportsPatch` | Parse/format `Accept-Patch` and detect PATCH support from advertised patch document media types. |
| `src/response.ts` | RFC 9110 §§8.8.2-8.8.3; RFC 9111 §5.2.2; RFC 8288 §3; RFC 6266 §4; RFC 5789 §3.1 | `optionsResponse`, `headResponse`, `jsonResponse`, `csvResponse`, `redirectResponse`, `simpleJsonResponse`, `noContentResponse`, `textResponse` | Opinionated response helpers (CORS + cache + pagination), with optional `Accept-Patch` advertisement for OPTIONS. |
| `src/pagination.ts` | RFC 8288 §§3, 3.3 + API conventions | `parsePaginationParams`, `decodeCursor`, `encodeCursor`, `buildPaginationLinks`, `lastPageOffset`, `isFirstPage`, `isLastPage` | Cursor/offset parsing and pagination links. |
| `src/problem.ts` | RFC 9457 §§3.1-3.2, 4.1 | `createProblem`, `problemResponse`, `Problems` | Return structured error responses. |
| `src/json-pointer.ts` | RFC 6901 §§3-7 | `parseJsonPointer`, `formatJsonPointer`, `evaluateJsonPointer`, `toUriFragment`, `fromUriFragment`, `isValidJsonPointer` | Parse, format, and evaluate JSON Pointers; URI fragment encoding. |
| `src/jsonpath.ts` | RFC 9535 §§2.1-2.7 | `parseJsonPath`, `queryJsonPath`, `queryJsonPathNodes`, `isValidJsonPath`, `formatNormalizedPath`, `compileJsonPath` | Parse and execute JSONPath queries; return values or nodes with normalized paths and bounded execution controls for untrusted inputs. |
| `src/uri.ts` | RFC 3986 §§2, 3.1, 3.2.2, 5.2.4, 6.2 | `percentEncode`, `percentDecode`, `normalizeUri`, `removeDotSegments`, `compareUris`, `isUnreserved`, `isReserved` | URI percent-encoding, normalization, and comparison. |
| `src/uri-template.ts` | RFC 6570 §§1.2, 2-3 | `parseUriTemplate`, `expandUriTemplate`, `isValidUriTemplate`, `getTemplateVariables`, `compileUriTemplate` | Parse and expand URI Templates with support for all Level 4 operators and modifiers. |
| `src/http-signatures.ts` | RFC 9421 §§2-4 | `parseSignatureInput`, `formatSignatureInput`, `parseSignature`, `formatSignature`, `parseComponentIdentifier`, `formatComponentIdentifier`, `canonicalizeFieldValue`, `binaryWrapFieldValues`, `deriveComponentValue`, `createSignatureBase`, `isDerivedComponent`, `DERIVED_COMPONENTS` | Parse/format Signature-Input and Signature fields; create signature base strings for HTTP message signatures. |
| `src/robots.ts` | RFC 9309 §§2.1-2.4 | `parseRobotsTxt`, `formatRobotsTxt`, `matchUserAgent`, `isAllowed` | Parse and format robots.txt; match user agents; check path access with longest-match-wins, wildcards, and `$`. |
| `src/security-txt.ts` | RFC 9116 §§2.3, 2.5, 3 | `parseSecurityTxt`, `formatSecurityTxt`, `isSecurityTxtExpired`, `validateSecurityTxt` | Parse and format security.txt with CRLF; validate required fields and expiry. |
| `src/webfinger.ts` | RFC 7033 §§4.2-4.4 | `parseJrd`, `tryParseJrd`, `formatJrd`, `validateJrd`, `matchResource`, `filterByRel`, `JRD_CONTENT_TYPE` | Parse/format WebFinger JRD; match resources; filter links by `rel`; use non-throwing parsing for untrusted JSON. |
| `src/host-meta.ts` | RFC 6415 §§2-3 | `parseHostMeta`, `formatHostMeta`, `parseHostMetaJson`, `tryParseHostMetaJson`, `formatHostMetaJson` | Parse/format host-meta XRD XML and JSON; use non-throwing JSON parsing for untrusted inputs. |
| `src/cors.ts` | Fetch/CORS specs | `defaultCorsHeaders`, `buildCorsHeaders`, `buildCorsHeadersForOrigin`, `buildStrictCorsHeadersForOrigin`, `buildPreflightHeaders`, `isOriginAllowed`, `corsHeaders` | Build CORS headers for single or multiple origins, with an explicit strict allowlist helper for production APIs. |

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

### Targeted Cache-Control (`CDN-Cache-Control`) selection

```ts
import {
    selectTargetedCacheControl,
    parseCacheControl,
} from '@irvinebroque/http-rfc-utils';

const selected = selectTargetedCacheControl(
    ['cdn-cache-control', 'surrogate-control'],
    {
        'CDN-Cache-Control': response.headers.get('CDN-Cache-Control'),
        'Surrogate-Control': response.headers.get('Surrogate-Control'),
        'Cache-Control': response.headers.get('Cache-Control'),
    }
);

if (selected.source === 'targeted' && selected.targeted) {
    // Apply CDN/shared-cache specific policy.
}

if (selected.source === 'fallback' && selected.fallback) {
    const fallbackPolicy = parseCacheControl(selected.fallback);
    // Apply ordinary Cache-Control fallback policy.
}
```

### Cache groups and grouped invalidation signals

```ts
import {
    parseCacheGroups,
    parseCacheGroupInvalidation,
    sharesCacheGroup,
} from '@irvinebroque/http-rfc-utils';

const responseGroups = parseCacheGroups('"scripts", "shared"') ?? [];
const invalidateGroups = parseCacheGroupInvalidation(
    response.headers.get('Cache-Group-Invalidation') ?? '',
    request.method
) ?? [];

const shouldInvalidate = sharesCacheGroup(
    responseGroups,
    'https://example.com',
    invalidateGroups,
    'https://example.com'
);
```

### Compression dictionary negotiation helpers

```ts
import {
    parseUseAsDictionary,
    parseAvailableDictionary,
    selectBestDictionary,
    mergeDictionaryVary,
} from '@irvinebroque/http-rfc-utils';

const useAs = parseUseAsDictionary('match="/app/*", match-dest=("script"), id="dict-v2"');
const available = parseAvailableDictionary(':AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=:');

const best = selectBestDictionary(storedDictionaries, 'https://example.test/app/main.js', {
    requestDestination: 'script',
});

const vary = mergeDictionaryVary(response.headers.get('Vary'));
```

### Strict CORS allowlist for production APIs

```ts
import { buildStrictCorsHeadersForOrigin } from '@irvinebroque/http-rfc-utils';

const corsHeaders = buildStrictCorsHeadersForOrigin(
    request.headers.get('Origin'),
    ['https://app.example.com', 'https://admin.example.com'],
    {
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    }
);
```

### Non-throwing parse helpers for untrusted JSON input

```ts
import { tryParseJrd, tryParseHostMetaJson } from '@irvinebroque/http-rfc-utils';

const jrd = tryParseJrd(jrdText);
const hostMeta = tryParseHostMetaJson(hostMetaJsonText);

if (!jrd || !hostMeta) {
    return new Response('Invalid discovery payload', { status: 400 });
}
```

### JSONPath execution limits for untrusted documents

```ts
import { queryJsonPath } from '@irvinebroque/http-rfc-utils';

const result = queryJsonPath(document, '$..items[?match(@.name, "^api-")]', {
    maxNodesVisited: 50000,
    maxDepth: 32,
    maxRegexPatternLength: 128,
    maxRegexInputLength: 512,
    rejectUnsafeRegex: true,
});
```

### Accept negotiation + CSV

1. `negotiate(request, ['application/json', 'text/csv'])`.
2. If CSV, `toCSV(data)` and `csvResponse`.
3. Otherwise `jsonResponse`.

### OPTIONS + `Accept-Patch` advertisement

```ts
import { optionsResponse } from '@irvinebroque/http-rfc-utils';

return optionsResponse(['GET', 'HEAD', 'OPTIONS'], {
    acceptPatch: [
        { type: 'application', subtype: 'json-patch+json', parameters: [] },
        { type: 'application', subtype: 'merge-patch+json', parameters: [] },
    ],
});
```

For unsupported PATCH document media types, RFC 5789 §2.2 recommends `415 Unsupported Media Type` and including `Accept-Patch` in the response.

### Priority parsing + merge

```ts
import {
    parsePriority,
    applyPriorityDefaults,
    mergePriority,
} from '@irvinebroque/http-rfc-utils';

const client = applyPriorityDefaults(parsePriority('u=1, i'));
const effective = mergePriority(client, parsePriority('u=0'));
// effective => { u: 0, i: true }
```

### Early-Data signal handling + `425 Too Early` eligibility

```ts
import {
    hasEarlyDataSignal,
    canSend425,
} from '@irvinebroque/http-rfc-utils';

const tlsEarlyDataAccepted = false;
const signal = hasEarlyDataSignal(request);
if (canSend425({ requestInEarlyData: tlsEarlyDataAccepted, earlyData: request })) {
    return new Response(null, { status: 425 });
}

// If you return 425, RFC 8470 §5.2 expects the client to retry without early data.
```

### Alternative Services (`Alt-Svc` and `Alt-Used`)

```ts
import {
    parseAltSvc,
    formatAltSvc,
    parseAltUsed,
} from '@irvinebroque/http-rfc-utils';

const parsed = parseAltSvc('h2=":8443"; ma=300, h3="alt.example.test:443"; persist=1');
// parsed?.alternatives[0] => { protocolId: 'h2', authority: ':8443', ma: 300 }

const serialized = formatAltSvc({
    clear: false,
    alternatives: [{ protocolId: 'h2', authority: ':8443', ma: 300 }],
});
// serialized => h2=":8443"; ma=300

const altUsed = parseAltUsed('alt.example.test:443');
// altUsed => { host: 'alt.example.test', port: 443 }
```

### Fetch Metadata policy for CSRF-related filtering

```ts
import {
    parseFetchMetadata,
    evaluateFetchMetadataPolicy,
    fetchMetadataVary,
} from '@irvinebroque/http-rfc-utils';

const metadata = parseFetchMetadata(request);
const decision = evaluateFetchMetadataPolicy(metadata, { strict: true });

if (!decision.allow) {
    return new Response('Blocked by Fetch Metadata policy', {
        status: 403,
        headers: {
            'Vary': fetchMetadataVary(null, ['site', 'mode', 'dest', 'user']),
        },
    });
}
```

### Trace Context parse + forward mutation

```ts
import {
    parseTraceparent,
    updateTraceparentParent,
    addOrUpdateTracestate,
    formatTraceparent,
    formatTracestate,
} from '@irvinebroque/http-rfc-utils';

const inboundParent = request.headers.get('traceparent') ?? '';
const inboundState = request.headers.get('tracestate') ?? '';

const parsed = parseTraceparent(inboundParent);
if (parsed) {
    const updated = updateTraceparentParent(parsed, { sampled: true, tracestate: inboundState });
    const nextState = addOrUpdateTracestate(updated.tracestate, 'example', 'txn-42');

    if (updated.traceparent) {
        response.headers.set('traceparent', formatTraceparent(updated.traceparent));
    }
    if (nextState && nextState.length > 0) {
        response.headers.set('tracestate', formatTracestate(nextState));
    }
}
```

### Link header parsing

```ts
import { parseLinkHeader } from '@irvinebroque/http-rfc-utils';

const links = parseLinkHeader(response.headers.get('Link') ?? '');
```

### Link-Template parsing and expansion

```ts
import {
    parseLinkTemplateHeader,
    expandLinkTemplate,
} from '@irvinebroque/http-rfc-utils';

const templates = parseLinkTemplateHeader('"/widgets/{widget_id}"; rel="item"; var-base="/vars/"');
if (templates && templates[0]) {
    const expanded = expandLinkTemplate(templates[0], { widget_id: '42' }, 'https://api.example.test/');
    // expanded.href => https://api.example.test/widgets/42
    // expanded.variableUris.widget_id => https://api.example.test/vars/widget_id
}
```

### Well-known path and URI helpers

```ts
import {
    buildWellKnownPath,
    buildWellKnownUri,
    parseWellKnownPath,
} from '@irvinebroque/http-rfc-utils';

const path = buildWellKnownPath('security.txt');
// path => /.well-known/security.txt

const uri = buildWellKnownUri('https://example.com/api', 'security.txt');
// uri => https://example.com/.well-known/security.txt

const parsed = parseWellKnownPath(path);
// parsed => { prefix: '/.well-known/', suffix: 'security.txt', path }
```

## API Summary

- `etag`: generate/parse/compare validators; async uses `crypto.subtle` for hashing.
- `conditional`: RFC 9110 precondition evaluation with correct precedence.
- `datetime`: RFC 3339 timestamps and RFC 9110 HTTP dates.
- `cache`: Cache-Control builder/parser plus combined cache headers.
- `targeted-cache-control`: RFC 9213 targeted cache-control and `CDN-Cache-Control` parser/formatter with target-list selection helper.
- `cache-groups`: RFC 9875 `Cache-Groups` and `Cache-Group-Invalidation` parser/formatter helpers plus same-origin group-sharing checks.
- `compression-dictionary`: RFC 9842 `Use-As-Dictionary`, `Available-Dictionary`, and `Dictionary-ID` parser/formatter helpers, request matching, deterministic best-match selection, and `Vary` merge support.
- `link`: RFC 8288 Link formatter/parser; handles quoted commas and escapes.
- `link-template`: RFC 9652 Link-Template parser/formatter and URI Template expansion with `var-base` variable URI resolution.
- `linkset`: RFC 9264 linkset document parser/formatter; RFC 9727 API catalog creation/parsing.
- `negotiate`: Accept parsing + media type negotiation; `toCSV` helper.
- `patch`: RFC 5789 `Accept-Patch` parsing/formatting and PATCH capability checks.
- `language`: Accept-Language parsing + basic filtering negotiation.
- `encoding`: Accept-Encoding parsing + negotiation.
- `range`: Range parsing + evaluation helpers.
- `prefer`: Prefer parsing + Preference-Applied formatting.
- `forwarded`: Forwarded header parsing + formatting.
- `content-disposition`: Content-Disposition parsing + formatting with RFC 8187 ext-value utilities.
- `cookie`: Cookie/Set-Cookie parsing, matching helpers, and Cookie header generation.
- `auth`: Basic, Bearer, and Digest Authorization + WWW-Authenticate parsing/formatting; Digest response computation (SHA-256 default, explicit MD5 opt-in).
- `hsts`: Strict-Transport-Security parsing/formatting.
- `headers`: Retry-After parsing/formatting, Vary merging, and Sunset header.
- `early-data`: RFC 8470 `Early-Data` parse/format, server-side replay signal detection, and `425 Too Early` eligibility gating.
- `alt-svc`: RFC 7838 `Alt-Svc` and `Alt-Used` parse/format helpers with ordered alternative preservation and tolerant malformed-member skipping.
- `fetch-metadata`: W3C Fetch Metadata `Sec-Fetch-*` parse/format helpers, strict/permissive policy evaluation, and `Vary` merge helper.
- `structured-fields`: Structured Field Values parsing + serialization with RFC 9651 Date and Display String types.
- `deprecation`: RFC 9745 Deprecation header parsing/formatting; deprecation/sunset validation.
- `client-hints`: Accept-CH parsing and Vary helper for Client Hints.
- `cache-status`: Cache-Status parsing and formatting.
- `priority`: RFC 9218 Priority header parse/format plus explicit defaulting and merge helpers.
- `trace-context`: W3C Trace Context `traceparent`/`tracestate` parse/format/validate and propagation helpers.
- `proxy-status`: Proxy-Status parsing and formatting; error type validation.
- `digest`: RFC 9530 Content-Digest and Repr-Digest parsing/formatting; Want-* preferences; SHA-256/SHA-512 generation and verification.
- `ni`: RFC 6920 NI URI parse/format and identity comparison; `.well-known/ni` URL mapping; SHA-256 and SHA-256 truncation suite digest computation and verification.
- `well-known`: RFC 8615 helpers for strict top-level `/.well-known/{suffix}` path and URI validation/building.
- `response`: opinionated helpers for API responses with CORS + caching, including optional OPTIONS `Accept-Patch` header emission.
- `pagination`: cursor/limit parsing and Link header pagination.
- `problem`: RFC 9457 Problem Details responses.
- `json-pointer`: RFC 6901 JSON Pointer parsing, formatting, and evaluation.
- `jsonpath`: RFC 9535 JSONPath query parsing and execution with filters, slices, built-in functions, and bounded traversal/regex safeguards for untrusted inputs.
- `uri`: RFC 3986 URI percent-encoding, normalization, and comparison.
- `uri-template`: RFC 6570 URI Template parsing and expansion; all Level 4 operators and modifiers.
- `http-signatures`: RFC 9421 HTTP Message Signatures; Signature-Input/Signature field parsing; signature base creation.
- `robots`: RFC 9309 robots.txt parsing/formatting; user-agent matching and path access checking.
- `security-txt`: RFC 9116 security.txt parsing/formatting (CRLF); validation and expiry checking.
- `webfinger`: RFC 7033 JRD parsing/formatting; resource matching and rel filtering; includes `tryParseJrd` for non-throwing JSON parsing.
- `host-meta`: RFC 6415 host-meta XRD XML and JSON parsing/formatting; includes `tryParseHostMetaJson` for non-throwing JSON parsing.
- `cors`: permissive defaults plus origin-aware header builder, with `buildStrictCorsHeadersForOrigin` for production allowlist policies.

## Notes

- `jsonResponse` returns `{ data, meta }`; use `simpleJsonResponse` for raw payloads.
- `csvResponse` only serializes data rows; pagination metadata remains in headers.
- `generateETagAsync` accepts `ArrayBuffer`/`ArrayBufferView` and hashes bytes directly.
- `generateETag` and `generateETagAsync` rely on `JSON.stringify` for non-binary objects; property order affects the resulting ETag.
- Digest helpers default to `SHA-256`; pass `algorithm: 'MD5'` only when interoperating with legacy endpoints.
- For permissive local/dev defaults, use `defaultCorsHeaders`; for production, prefer `buildStrictCorsHeadersForOrigin`.
- For multiple CORS origins, use `buildCorsHeadersForOrigin(requestOrigin, options)` and include `Vary: Origin`.
- For untrusted JSON discovery payloads, prefer `tryParseJrd` and `tryParseHostMetaJson` over throwing parse helpers.

## Testing

```bash
pnpm test
```

## Security review and fuzzing

```bash
pnpm security:review
pnpm fuzz:quick
pnpm fuzz:full
pnpm security:ci
```

- `pnpm security:review` validates security-doc scaffolding, writes a baseline snapshot, validates the findings register, and runs `pnpm audit --audit-level=high`.
- `pnpm fuzz:quick` runs deterministic fast-check campaigns for high-risk parser/formatter targets plus tier-2 modules (`cookie`, `response`, `cors`, `security-txt`, `host-meta`, `webfinger`).
- `pnpm fuzz:full` runs the same campaign with 10x iterations for nightly stress.
- Fuzz failures emit replayable artifacts under `temp/fuzz-artifacts/`.

```bash
pnpm exec node scripts/fuzz/replay-fast-check.mjs --artifact temp/fuzz-artifacts/<artifact>.json
```

## Typechecking

```bash
pnpm typecheck
pnpm typecheck:test
pnpm typecheck:strict
pnpm typecheck:lib
pnpm typecheck:all
```

- `pnpm typecheck` is the fast default (`src/**/*.ts`, `skipLibCheck: true`).
- `pnpm typecheck:test` extends coverage to `test/**/*.ts`.
- `pnpm typecheck:strict` enables `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- `pnpm typecheck:lib` runs with `skipLibCheck: false` for dependency declaration checks.
- `pnpm typecheck:all` runs both source and test typechecks.

## Coverage

```bash
pnpm test:coverage
```

```bash
pnpm test:coverage:check
```

- `pnpm test:coverage` runs the full suite with Node's experimental coverage reporter.
- `pnpm test:coverage:check` enforces global CI thresholds (line >= 96, branch >= 81, funcs >= 95).
- Coverage totals exclude `src/types/*.ts` compatibility/type facades to keep runtime thresholds focused on executable modules.
- Hotspot module thresholds are reported as warnings by default; set `COVERAGE_ENFORCE_HOTSPOTS=true` to make them blocking.

## Structure checks

```bash
pnpm check:structure
```

- `pnpm check:structure` verifies that root public modules in `src/` are exported by `src/index.ts`, with explicit utility exclusions and automatic exclusion for modules prefixed `internal-`.

## API docs generation

```bash
pnpm docs
```

## Benchmarking

```bash
pnpm bench
```
