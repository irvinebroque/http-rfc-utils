# Imports by task

Use this reference when you need exact public imports for a specific task.
All symbols are exported from `@irvinebroque/http-rfc-utils`.

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
