# Imports by task

Use this reference when you need exact public imports for a specific task.
All symbols are exported from `@irvinebroque/http-rfc-utils`.

| Task | Exact imports |
| --- | --- |
| ETag generation and comparison | `generateETag`, `generateETagAsync`, `parseETag`, `compareETags` |
| Conditional preconditions (`304`/`412`) | `evaluatePreconditions`, `handleConditionalRequest` |
| HTTP date and timestamp handling | `formatHTTPDate`, `parseHTTPDate`, `toRFC3339`, `parseRFC3339` |
| Cache-Control creation and parsing | `cacheControl`, `getCacheHeaders`, `parseCacheControl`, `CachePresets` |
| RFC 6585 status helpers (`428/429/431/511`) | `parseRfc6585StatusCode`, `formatRfc6585StatusCode`, `validateRfc6585StatusCode`, `getRfc6585StatusInfo`, `formatRfc6585Headers` |
| Targeted cache policy fields (`CDN-Cache-Control`) | `parseTargetedCacheControl`, `formatTargetedCacheControl`, `parseCdnCacheControl`, `formatCdnCacheControl`, `selectTargetedCacheControl` |
| Cache groups (`Cache-Groups`, `Cache-Group-Invalidation`) | `parseCacheGroups`, `formatCacheGroups`, `parseCacheGroupInvalidation`, `formatCacheGroupInvalidation`, `sharesCacheGroup` |
| Compression dictionary negotiation (`Use-As-Dictionary`, `Available-Dictionary`, `Dictionary-ID`) | `parseUseAsDictionary`, `formatUseAsDictionary`, `validateUseAsDictionary`, `parseAvailableDictionary`, `formatAvailableDictionary`, `parseDictionaryId`, `formatDictionaryId`, `matchesDictionary`, `selectBestDictionary`, `mergeDictionaryVary` |
| Problem Details responses | `createProblem`, `problemResponse`, `Problems` |
| Common response builders | `jsonResponse`, `simpleJsonResponse`, `csvResponse`, `noContentResponse` |
| Accept negotiation and CSV output | `parseAccept`, `negotiate`, `getResponseFormat`, `toCSV` |
| PATCH capability advertisement (`Accept-Patch`) | `parseAcceptPatch`, `formatAcceptPatch`, `supportsPatch` |
| JSON Patch document parse/validate/apply | `JSON_PATCH_MEDIA_TYPE`, `parseJsonPatch`, `tryParseJsonPatch`, `validateJsonPatch`, `formatJsonPatch`, `applyJsonPatch` |
| JSON Merge Patch parse/validate/apply | `MERGE_PATCH_CONTENT_TYPE`, `parseJsonMergePatch`, `validateJsonMergePatch`, `formatJsonMergePatch`, `applyJsonMergePatch` |
| JSON canonicalization (RFC 8785) | `formatCanonicalJson`, `formatCanonicalJsonUtf8`, `validateCanonicalJson`, `parseCanonicalJson` |
| Language and encoding negotiation | `parseAcceptLanguage`, `negotiateLanguage`, `parseAcceptEncoding`, `negotiateEncoding` |
| Link header parsing and formatting | `parseLinkHeader`, `formatLinkHeader`, `buildLinkHeader` |
| Webmention endpoint discovery and source/target request handling | `WEBMENTION_REL`, `WEBMENTION_CONTENT_TYPE`, `discoverWebmentionEndpoint`, `parseWebmentionRequest`, `validateWebmentionRequest`, `formatWebmentionRequest`, `isWebmentionSuccessStatus` |
| Early Hints (`103`) Link batching and preload extraction | `EARLY_HINTS_STATUS`, `parseEarlyHintsLinks`, `formatEarlyHintsLinks`, `validateEarlyHintsLinks`, `extractPreloadLinks`, `mergeEarlyHintsLinks` |
| Link-Template parsing, formatting, and expansion | `parseLinkTemplateHeader`, `formatLinkTemplateHeader`, `expandLinkTemplate`, `resolveTemplateVariableUri` |
| Linkset and API catalog documents | `parseLinksetJson`, `formatLinksetJson`, `createApiCatalog`, `parseApiCatalog` |
| Pagination helpers | `parsePaginationParams`, `encodeCursor`, `decodeCursor`, `buildPaginationLinks` |
| CORS policies and preflight headers | `buildCorsHeaders`, `buildCorsHeadersForOrigin`, `buildStrictCorsHeadersForOrigin`, `buildPreflightHeaders`, `isOriginAllowed`, `corsHeaders` |
| Content-Disposition with RFC 8187 params | `parseContentDisposition`, `formatContentDisposition`, `formatHeaderParam` |
| OAuth PKCE verifier/challenge and request params | `generatePkceCodeVerifier`, `derivePkceCodeChallenge`, `verifyPkceCodeVerifier`, `validatePkceCodeVerifier`, `validatePkceCodeChallenge`, `parsePkceAuthorizationRequestParams`, `formatPkceAuthorizationRequestParams`, `parsePkceTokenRequestParams`, `formatPkceTokenRequestParams` |
| OAuth resource indicator parameters | `validateResourceIndicatorUri`, `parseResourceIndicatorAuthorizationRequestParams`, `formatResourceIndicatorAuthorizationRequestParams`, `parseResourceIndicatorTokenRequestParams`, `formatResourceIndicatorTokenRequestParams` |
| WebAuthn creation/request/clientData/authenticatorData codecs and validators | `parseWebauthnBase64url`, `formatWebauthnBase64url`, `validateWebauthnBase64url`, `parseWebauthnCreationOptionsFromJson`, `formatWebauthnCreationOptionsToJson`, `validateWebauthnCreationOptions`, `parseWebauthnRequestOptionsFromJson`, `formatWebauthnRequestOptionsToJson`, `validateWebauthnRequestOptions`, `parseWebauthnClientDataJson`, `formatWebauthnClientDataJson`, `validateWebauthnClientData`, `parseWebauthnAuthenticatorData`, `validateWebauthnAuthenticatorData`, `validateWebauthnCoseAlgorithm`, `WEBAUTHN_COSE_ALGORITHM_IDS` |
| OAuth authorization server metadata discovery (RFC 8414) | `OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX`, `parseAuthorizationServerMetadata`, `parseAuthorizationServerMetadataObject`, `formatAuthorizationServerMetadata`, `validateAuthorizationServerMetadata`, `buildAuthorizationServerMetadataUrl`, `mergeSignedAuthorizationServerMetadata` |
| Prefer and Forwarded headers | `parsePrefer`, `formatPrefer`, `formatPreferenceApplied`, `parseForwarded`, `formatForwarded` |
| Retry-After, Vary, and Sunset | `parseRetryAfter`, `formatRetryAfter`, `mergeVary`, `parseSunset`, `formatSunset` |
| Early-Data parsing and `425 Too Early` gating | `parseEarlyData`, `formatEarlyData`, `hasEarlyDataSignal`, `canSend425` |
| Alternative Services (`Alt-Svc`, `Alt-Used`) | `parseAltSvc`, `formatAltSvc`, `parseAltUsed`, `formatAltUsed` |
| Fetch Metadata request filtering | `parseFetchMetadata`, `evaluateFetchMetadataPolicy`, `fetchMetadataVary` |
| Clear-Site-Data response header parsing and formatting | `parseClearSiteData`, `formatClearSiteData`, `validateClearSiteData` |
| Referrer-Policy parsing, formatting, and effective selection | `parseReferrerPolicy`, `parseReferrerPolicyHeader`, `formatReferrerPolicy`, `validateReferrerPolicy`, `selectEffectiveReferrerPolicy` |
| Reporting API endpoint configuration and report JSON payload helpers | `REPORTS_MEDIA_TYPE`, `parseReportingEndpoints`, `formatReportingEndpoints`, `processReportingEndpointsForResponse`, `stripUrlForReport`, `serializeReports`, `formatReportsJson`, `parseReportsJson` |
| Content-Security-Policy subset parse/format/validation | `parseContentSecurityPolicy`, `formatContentSecurityPolicy`, `parseContentSecurityPolicyReportOnly`, `formatContentSecurityPolicyReportOnly`, `parseContentSecurityPolicies`, `validateContentSecurityPolicy`, `parseCspSourceList`, `formatCspSourceList`, `validateCspSourceList` |
| Structured Field Values | `parseSfList`, `parseSfDict`, `parseSfItem`, `serializeSfList`, `serializeSfDict`, `serializeSfItem`, `SfDate`, `SfDisplayString` |
| Priority header parsing and merge behavior | `parsePriority`, `formatPriority`, `applyPriorityDefaults`, `mergePriority` |
| Trace Context parsing and propagation | `parseTraceparent`, `formatTraceparent`, `validateTraceparent`, `parseTracestate`, `formatTracestate`, `validateTracestate`, `updateTraceparentParent`, `restartTraceparent`, `addOrUpdateTracestate`, `removeTracestateKey`, `truncateTracestate` |
| OpenAPI 3.1.1 parameter/runtime expression/security/path/server/lint helpers | `normalizeOpenApiParameterSpec`, `formatQueryParameter`, `parseQueryParameter`, `formatPathParameter`, `parsePathParameter`, `formatHeaderParameter`, `parseHeaderParameter`, `formatCookieParameter`, `parseCookieParameter`, `parseOpenApiRuntimeExpression`, `formatOpenApiRuntimeExpression`, `isOpenApiRuntimeExpression`, `evaluateOpenApiRuntimeExpression`, `materializeOpenApiLinkValues`, `resolveOpenApiCallbackUrl`, `parseOpenApiSecurityRequirements`, `tryParseOpenApiSecurityRequirements`, `validateOpenApiSecurityRequirements`, `normalizeOpenApiSecurityRequirements`, `resolveEffectiveOpenApiSecurity`, `evaluateOpenApiSecurity`, `compileOpenApiPathMatcher`, `extractOpenApiPathParams`, `listOpenApiServerCandidates`, `resolveOpenApiServerUrl`, `lintOpenApiDocument` |
| JSON Pointer and JSONPath queries | `parseJsonPointer`, `evaluateJsonPointer`, `parseJsonPath`, `queryJsonPath`, `queryJsonPathNodes` |
| URI and URI Template utilities | `normalizeUri`, `compareUris`, `parseUriTemplate`, `expandUriTemplate` |
| Named Information (NI) URIs and digest checks | `parseNiUri`, `formatNiUri`, `compareNiUris`, `parseNiUrlSegment`, `formatNiUrlSegment`, `toWellKnownNiUrl`, `fromWellKnownNiUrl`, `computeNiDigest`, `verifyNiDigest` |
| Well-known path and URI validation/building | `WELL_KNOWN_PREFIX`, `isWellKnownPath`, `isWellKnownUri`, `validateWellKnownSuffix`, `buildWellKnownPath`, `buildWellKnownUri`, `parseWellKnownPath` |
| HTTP message signatures | `parseSignatureInput`, `formatSignatureInput`, `parseSignature`, `createSignatureBase` |
| Robots.txt parsing and matching | `parseRobotsTxt`, `formatRobotsTxt`, `matchUserAgent`, `isAllowed` |
| security.txt handling | `parseSecurityTxt`, `formatSecurityTxt`, `isSecurityTxtExpired`, `validateSecurityTxt` |
| WebFinger (JRD) | `parseJrd`, `tryParseJrd`, `formatJrd`, `validateJrd`, `matchResource`, `filterByRel`, `JRD_CONTENT_TYPE` |
| Host metadata (XRD/JSON) | `parseHostMeta`, `formatHostMeta`, `parseHostMetaJson`, `tryParseHostMetaJson`, `formatHostMetaJson` |
