// =============================================================================
// Types
// =============================================================================
export type {
    PaginationParams,
    PaginationError,
    PaginationResult,
    DecodedCursor,
    PaginationLinks,
    PaginatedMeta,
    ProblemDetails,
    ProblemOptions,
    LinkDefinition,
    ETag,
    CacheOptions,
    AcceptEntry,
    MediaType,
    CorsOptions,
    ConditionalResult,
    ByteRange,
    RangeSpec,
    ContentRange,
    RangeDecision,
    PreferParam,
    PreferToken,
    PreferMap,
    ForwardedElement,
    ContentDisposition,
    DispositionParams,
    ParamOptions,
    ExtValue,
    ExtValueOptions,
    LanguageRange,
    EncodingRange,
    RetryAfterValue,
    SfBareItem,
    SfItem,
    SfInnerList,
    SfList,
    SfDictionary,
    CookieAttributes,
    SetCookie,
    StoredCookie,
    CookieHeaderOptions,
    StrictTransportSecurityOptions,
    ClientHintToken,
    ClientHintList,
    CacheStatusParams,
    CacheStatusEntry,
    ProxyErrorType,
    ProxyStatusParams,
    ProxyStatusEntry,
    AuthParam,
    AuthChallenge,
    AuthCredentials,
    BasicCredentials,
    BasicChallenge,
    BearerChallenge,
    BearerError,
    DigestAuthAlgorithm,
    DigestAuthQop,
    DigestChallenge,
    DigestCredentials,
    DigestAuthenticationInfo,
    DigestComputeOptions,
    UriComponent,
    DigestAlgorithm,
    DigestAlgorithmAny,
    Digest,
    DigestPreference,
} from './types.js';

export { isPaginationError, isPaginationParams, SfDate } from './types.js';

// =============================================================================
// ETag (RFC 9110)
// =============================================================================
export {
    generateETag,
    generateETagAsync,
    parseETag,
    formatETag,
    compareETags,
    compareETagStrings,
} from './etag.js';

// =============================================================================
// Date/Time
// =============================================================================
export {
    toRFC3339,
    parseRFC3339,
    formatHTTPDate,
    parseHTTPDate,
    isExpired,
    secondsUntil,
} from './datetime.js';

// =============================================================================
// CORS
// =============================================================================
export {
    defaultCorsHeaders,
    buildCorsHeaders,
    buildCorsHeadersForOrigin,
    buildPreflightHeaders,
    isOriginAllowed,
    corsHeaders,
} from './cors.js';

// =============================================================================
// Cache Control (RFC 9111)
// =============================================================================
export {
    cacheControl,
    getCacheHeaders,
    parseCacheControl,
    CachePresets,
} from './cache.js';

// =============================================================================
// Problem Details (RFC 9457)
// =============================================================================
export {
    createProblem,
    problemResponse,
    Problems,
} from './problem.js';

// =============================================================================
// Pagination
// =============================================================================
export {
    DEFAULT_LIMIT,
    MAX_LIMIT,
    parsePaginationParams,
    decodeCursor,
    encodeCursor,
    buildPaginationLinks,
    lastPageOffset,
    isFirstPage,
    isLastPage,
} from './pagination.js';

// =============================================================================
// Content Negotiation (RFC 7231)
// =============================================================================
export {
    parseAccept,
    negotiate,
    getResponseFormat,
    toCSV,
    MEDIA_TYPES,
    MIME_TO_FORMAT,
} from './negotiate.js';

// =============================================================================
// Accept-Language (RFC 9110 + RFC 4647)
// =============================================================================
export {
    parseAcceptLanguage,
    negotiateLanguage,
} from './language.js';

// =============================================================================
// Accept-Encoding (RFC 9110)
// =============================================================================
export {
    parseAcceptEncoding,
    negotiateEncoding,
} from './encoding.js';

// =============================================================================
// Sorting
// =============================================================================
export type { SortDirection, SortField } from './sorting.js';
export {
    parseSortString,
    applySorting,
    compareValues,
    validateSortFields,
    buildSortString,
} from './sorting.js';

// =============================================================================
// Link Headers (RFC 8288)
// =============================================================================
export {
    LinkRelation,
    formatLink,
    formatLinkHeader,
    buildLinkHeader,
    parseLinkHeader,
    quoteIfNeeded,
    unquote,
} from './link.js';

// =============================================================================
// Linkset (RFC 9264) + API Catalog (RFC 9727)
// =============================================================================
export type {
    InternationalizedValue,
    LinksetTarget,
    LinksetContext,
    Linkset,
    LinksetJsonOptions,
    ApiCatalogLink,
    ApiCatalogApi,
    ApiCatalogOptions,
    ApiCatalog,
} from './types.js';

export {
    // RFC 9264: Linkset
    parseLinkset,
    parseLinksetJson,
    formatLinkset,
    formatLinksetJson,
    linksetToJson,
    jsonToLinkset,
    isValidLinkset,
    linksetToLinks,
    linksToLinkset,
    // RFC 9727: API Catalog
    LINKSET_MEDIA_TYPE,
    API_CATALOG_PROFILE,
    API_CATALOG_PATH,
    createApiCatalog,
    parseApiCatalog,
    isApiCatalog,
} from './linkset.js';

// =============================================================================
// Range Requests (RFC 9110)
// =============================================================================
export {
    parseRange,
    formatContentRange,
    parseContentRange,
    acceptRanges,
    evaluateRange,
} from './range.js';

// =============================================================================
// Prefer (RFC 7240)
// =============================================================================
export {
    parsePrefer,
    formatPrefer,
    formatPreferenceApplied,
} from './prefer.js';

// =============================================================================
// Forwarded (RFC 7239)
// =============================================================================
export {
    parseForwarded,
    formatForwarded,
} from './forwarded.js';

// =============================================================================
// Extended Parameter Encoding (RFC 8187)
// =============================================================================
export {
    decodeExtValue,
    encodeExtValue,
    needsExtendedEncoding,
    isAttrChar,
} from './ext-value.js';

// =============================================================================
// Content-Disposition (RFC 6266 + RFC 8187)
// =============================================================================
export {
    parseContentDisposition,
    formatContentDisposition,
    formatHeaderParam,
} from './content-disposition.js';

// =============================================================================
// Cookies (RFC 6265)
// =============================================================================
export {
    parseCookie,
    formatCookie,
    parseSetCookie,
    formatSetCookie,
    parseCookieDate,
    domainMatches,
    defaultPath,
    pathMatches,
    buildCookieHeader,
} from './cookie.js';

// =============================================================================
// Authorization (RFC 7617 + RFC 6750 + RFC 7616)
// =============================================================================
export {
    parseAuthorization,
    formatAuthorization,
    parseWWWAuthenticate,
    formatWWWAuthenticate,
    parseBasicAuthorization,
    formatBasicAuthorization,
    parseBasicChallenge,
    formatBasicChallenge,
    parseBearerAuthorization,
    formatBearerAuthorization,
    parseBearerChallenge,
    formatBearerChallenge,
    // Digest (RFC 7616)
    DIGEST_AUTH_ALGORITHMS,
    parseDigestChallenge,
    formatDigestChallenge,
    parseDigestAuthorization,
    formatDigestAuthorization,
    parseDigestAuthenticationInfo,
    formatDigestAuthenticationInfo,
    computeDigestResponse,
    computeA1,
    computeA2,
    hashDigestUsername,
} from './auth.js';

// =============================================================================
// Strict-Transport-Security (RFC 6797)
// =============================================================================
export {
    parseStrictTransportSecurity,
    formatStrictTransportSecurity,
} from './hsts.js';

// =============================================================================
// Client Hints (RFC 8942)
// =============================================================================
export {
    parseAcceptCH,
    formatAcceptCH,
    filterClientHints,
    mergeClientHintsVary,
} from './client-hints.js';

// =============================================================================
// Cache-Status (RFC 9211)
// =============================================================================
export {
    parseCacheStatus,
    formatCacheStatus,
} from './cache-status.js';

// =============================================================================
// Proxy-Status (RFC 9209)
// =============================================================================
export {
    parseProxyStatus,
    formatProxyStatus,
    isProxyErrorType,
    PROXY_ERROR_TYPES,
} from './proxy-status.js';

// =============================================================================
// Conditional Requests (RFC 9110)
// =============================================================================
export {
    handleConditionalRequest,
    evaluatePreconditions,
    parseIfNoneMatch,
    parseIfMatch,
    evaluateIfMatch,
    evaluateIfNoneMatch,
    evaluateIfModifiedSince,
    evaluateIfUnmodifiedSince,
} from './conditional.js';

// =============================================================================
// Retry-After + Vary (RFC 9110) + Sunset (RFC 8594)
// =============================================================================
export {
    parseRetryAfter,
    formatRetryAfter,
    mergeVary,
    parseSunset,
    formatSunset,
    isSunsetImminent,
} from './headers.js';

// =============================================================================
// Structured Field Values (RFC 8941 + RFC 9651)
// =============================================================================
export {
    parseSfList,
    parseSfDict,
    parseSfItem,
    serializeSfList,
    serializeSfDict,
    serializeSfItem,
} from './structured-fields.js';

// =============================================================================
// Deprecation (RFC 9745)
// =============================================================================
export {
    parseDeprecation,
    formatDeprecation,
    isDeprecated,
    validateDeprecationSunsetOrder,
    buildDeprecationHeaders,
} from './deprecation.js';

// =============================================================================
// JSON Pointer (RFC 6901)
// =============================================================================
export {
    parseJsonPointer,
    formatJsonPointer,
    evaluateJsonPointer,
    toUriFragment,
    fromUriFragment,
    isValidJsonPointer,
} from './json-pointer.js';

// =============================================================================
// JSONPath (RFC 9535)
// =============================================================================
export type {
    JsonPathQuery,
    JsonPathSegment,
    JsonPathSelector,
    JsonPathNode,
    JsonPathOptions,
} from './jsonpath.js';

export {
    parseJsonPath,
    queryJsonPath,
    queryJsonPathNodes,
    isValidJsonPath,
    formatNormalizedPath,
    compileJsonPath,
} from './jsonpath.js';

// =============================================================================
// URI (RFC 3986)
// =============================================================================
export {
    percentEncode,
    percentDecode,
    isUnreserved,
    isReserved,
    normalizeUri,
    removeDotSegments,
    compareUris,
    UNRESERVED_CHARS,
    GEN_DELIMS,
    SUB_DELIMS,
} from './uri.js';

// =============================================================================
// URI Template (RFC 6570)
// =============================================================================
export type {
    UriTemplateValue,
    UriTemplateVariables,
    UriTemplateOperator,
    UriTemplateVarSpec,
    UriTemplateExpression,
    UriTemplatePart,
    UriTemplate,
    CompiledUriTemplate,
} from './uri-template.js';

export {
    parseUriTemplate,
    expandUriTemplate,
    isValidUriTemplate,
    getTemplateVariables,
    compileUriTemplate,
} from './uri-template.js';

// =============================================================================
// Digest Fields (RFC 9530)
// =============================================================================
export {
    parseContentDigest,
    parseReprDigest,
    parseWantContentDigest,
    parseWantReprDigest,
    formatContentDigest,
    formatReprDigest,
    formatWantContentDigest,
    formatWantReprDigest,
    generateDigest,
    verifyDigest,
    DIGEST_ALGORITHMS,
    isActiveAlgorithm,
    isDeprecatedAlgorithm,
} from './digest.js';

// =============================================================================
// HTTP Message Signatures (RFC 9421)
// =============================================================================
export type {
    SignatureComponentParams,
    SignatureComponent,
    SignatureParams,
    SignatureInput,
    Signature,
    DerivedComponentName,
    SignatureMessageContext,
    SignatureBaseResult,
} from './types.js';

export {
    DERIVED_COMPONENTS,
    isDerivedComponent,
    parseSignatureInput,
    formatSignatureInput,
    parseSignature,
    formatSignature,
    parseComponentIdentifier,
    formatComponentIdentifier,
    canonicalizeFieldValue,
    binaryWrapFieldValues,
    deriveComponentValue,
    createSignatureBase,
} from './http-signatures.js';

// =============================================================================
// Response Builders
// =============================================================================
export {
    optionsResponse,
    headResponse,
    jsonResponse,
    csvResponse,
    redirectResponse,
    simpleJsonResponse,
    noContentResponse,
    textResponse,
} from './response.js';

// =============================================================================
// RFC 9309 — Robots Exclusion Protocol
// =============================================================================
export type {
    RobotsGroup,
    RobotsConfig,
} from './types.js';

export {
    parseRobotsTxt,
    formatRobotsTxt,
    matchUserAgent,
    isAllowed,
} from './robots.js';

// =============================================================================
// RFC 9116 — security.txt
// =============================================================================
export type {
    SecurityTxt,
    SecurityTxtIssue,
} from './types.js';

export {
    parseSecurityTxt,
    formatSecurityTxt,
    isSecurityTxtExpired,
    validateSecurityTxt,
} from './security-txt.js';

// =============================================================================
// RFC 7033 — WebFinger
// =============================================================================
export type {
    WebFingerLink,
    WebFingerResponse,
} from './types.js';

export {
    JRD_CONTENT_TYPE,
    parseJrd,
    formatJrd,
    validateJrd,
    matchResource,
    filterByRel,
} from './webfinger.js';

// =============================================================================
// RFC 6415 — Host Metadata
// =============================================================================
export type {
    HostMetaLink,
    HostMeta,
} from './types.js';

export {
    parseHostMeta,
    formatHostMeta,
    parseHostMetaJson,
    formatHostMetaJson,
} from './host-meta.js';
