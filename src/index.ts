/**
 * Public package entrypoint.
 * Re-exports stable APIs grouped by RFC/topic area while preserving
 * compatibility facades and canonical import paths.
 * @see https://github.com/irvinebroque/http-rfc-utils/blob/main/docs/reference/imports-by-task.md
 */

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
    LinkTemplate,
    ExpandedLinkTemplate,
    ETag,
    CacheOptions,
    TargetedCacheControl,
    TargetedSelection,
    AcceptEntry,
    AcceptPatchParameter,
    AcceptPatchMediaType,
    MediaType,
    OptionsResponseOptions,
    OpenApiParameterLocation,
    OpenApiParameterStyle,
    OpenApiParameterPrimitive,
    OpenApiParameterValue,
    OpenApiParameterValueType,
    OpenApiSchemaParameterSpec,
    NormalizedOpenApiSchemaParameterSpec,
    OpenApiQueryEntry,
    OpenApiCookiePair,
    OpenApiRuntimeEvaluationContext,
    OpenApiRuntimeExpressionType,
    OpenApiRuntimeExpression,
    OpenApiRuntimeExpressionEvaluationOptions,
    OpenApiRuntimeResolutionMode,
    OpenApiRuntimeResolutionOptions,
    OpenApiRuntimeResolutionIssueCode,
    OpenApiRuntimeResolutionIssue,
    OpenApiLinkObjectLike,
    OpenApiLinkMaterializationResult,
    OpenApiCallbackUrlResolutionResult,
    OpenApiSecuritySchemeType,
    OpenApiApiKeyLocation,
    OpenApiSecurityRequirement,
    OpenApiSecurityRequirements,
    OpenApiApiKeySecurityScheme,
    OpenApiHttpSecurityScheme,
    OpenApiOAuthScopes,
    OpenApiOAuthImplicitFlowObject,
    OpenApiOAuthPasswordFlowObject,
    OpenApiOAuthClientCredentialsFlowObject,
    OpenApiOAuthAuthorizationCodeFlowObject,
    OpenApiOAuthFlowsObject,
    OpenApiOAuth2SecurityScheme,
    OpenApiOpenIdConnectSecurityScheme,
    OpenApiMutualTlsSecurityScheme,
    OpenApiSecuritySchemeMetadata,
    OpenApiSecuritySchemeRegistry,
    OpenApiUnknownSchemeHandling,
    OpenApiSecurityValidationMode,
    OpenApiSecurityValidationOptions,
    OpenApiSecurityCredentialObject,
    OpenApiSecurityCredential,
    OpenApiSecurityCredentials,
    OpenApiSecurityEvaluationSchemeCode,
    OpenApiSecuritySchemeEvaluationResult,
    OpenApiSecurityRequirementEvaluationResult,
    OpenApiSecurityEvaluationResult,
    OpenApiDiagnosticSeverity,
    OpenApiDiagnostic,
    OpenApiLintRuleCode,
    OpenApiLintOptions,
    OpenApiPathPatternKind,
    OpenApiPathTemplateLiteralSegment,
    OpenApiPathTemplateParamSegment,
    OpenApiPathMatcherTemplateSegment,
    OpenApiPathVariableMap,
    OpenApiPathItemHttpMethod,
    OpenApiServerVariableObject,
    OpenApiServerObject,
    OpenApiOperationObjectLike,
    OpenApiPathItemObjectLike,
    OpenApiDocumentLike,
    OpenApiPathTemplateMatchOptions,
    OpenApiPathMatcherOptions,
    OpenApiPathMatch,
    OpenApiPathMatchCandidate,
    OpenApiPathMatcherExplainResult,
    OpenApiPathMatcher,
    OpenApiServerCandidateLevel,
    OpenApiServerCandidate,
    OpenApiServerVariableValue,
    OpenApiServerVariableMap,
    OpenApiServerVariableOverridesByLevel,
    OpenApiPathServerResolverOverrides,
    OpenApiPathServerResolverOptions,
    OpenApiServerResolutionInput,
    OpenApiServerResolutionResult,
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
    UseAsDictionary,
    StoredDictionary,
    DictionaryMatchOptions,
    RetryAfterValue,
    Rfc6585StatusCode,
    Rfc6585StatusInfo,
    Rfc6585HeadersOptions,
    JsonPatchPrimitive,
    JsonPatchArray,
    JsonPatchValue,
    JsonPatchObject,
    JsonPatchOperationType,
    JsonPatchBaseOperation,
    JsonPatchAddOperation,
    JsonPatchRemoveOperation,
    JsonPatchReplaceOperation,
    JsonPatchMoveOperation,
    JsonPatchCopyOperation,
    JsonPatchTestOperation,
    JsonPatchOperation,
    JsonPatchDocument,
    JsonMergePatchPrimitive,
    JsonMergePatchArray,
    JsonMergePatchValue,
    JsonMergePatchObject,
    JsonMergePatchDocument,
    CanonicalJsonPrimitive,
    CanonicalJsonArray,
    CanonicalJsonObject,
    CanonicalJsonValue,
    AltSvcAlternative,
    AltSvcRecord,
    AltUsed,
    EarlyDataValue,
    EarlyData425Options,
    FetchMetadata,
    FetchMetadataPolicy,
    FetchMetadataPolicyDecision,
    ClearSiteDataType,
    ClearSiteDataDirective,
    ReferrerPolicyToken,
    ReferrerPolicy,
    CspDirectiveName,
    CspSourceKeyword,
    CspHashAlgorithm,
    CspSourceExpression,
    ContentSecurityPolicy,
    ReportingEndpoint,
    ReportingEndpointDefinition,
    ProcessReportingEndpointsOptions,
    ReportingReportBody,
    ReportingReport,
    ReportingSerializedReport,
    ReportingSerializationOptions,
    Traceparent,
    TracestateEntry,
    ParsedTraceContext,
    TraceContextValidationResult,
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
    PriorityField,
    RequiredPriority,
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
    AuthorizationDetailsJsonPrimitive,
    AuthorizationDetailsJsonValue,
    AuthorizationDetailsJsonObject,
    AuthorizationDetailsEntry,
    AuthorizationDetails,
    AuthorizationDetailsTypeDefinition,
    AuthorizationDetailsValidationOptions,
    PkceCodeChallengeMethod,
    PkceCodeVerifierGenerationOptions,
    PkceAuthorizationRequestParams,
    PkceAuthorizationRequestInput,
    PkceTokenRequestParams,
    WebauthnAuthenticatorAttachment,
    WebauthnResidentKeyRequirement,
    WebauthnUserVerificationRequirement,
    WebauthnAttestationConveyancePreference,
    WebauthnPublicKeyCredentialRpEntity,
    WebauthnPublicKeyCredentialRpEntityJson,
    WebauthnPublicKeyCredentialUserEntity,
    WebauthnPublicKeyCredentialUserEntityJson,
    WebauthnPublicKeyCredentialParameters,
    WebauthnPublicKeyCredentialDescriptor,
    WebauthnPublicKeyCredentialDescriptorJson,
    WebauthnAuthenticatorSelectionCriteria,
    WebauthnPublicKeyCredentialCreationOptions,
    WebauthnPublicKeyCredentialCreationOptionsJson,
    WebauthnPublicKeyCredentialRequestOptions,
    WebauthnPublicKeyCredentialRequestOptionsJson,
    WebauthnCreationOptionsValidationOptions,
    WebauthnRequestOptionsValidationOptions,
    WebauthnClientData,
    WebauthnClientDataFormatOptions,
    WebauthnClientDataValidationOptions,
    WebauthnAuthenticatorFlags,
    WebauthnAttestedCredentialData,
    WebauthnAuthenticatorData,
    WebauthnAuthenticatorDataValidationOptions,
    UriComponent,
    DigestAlgorithm,
    DigestAlgorithmAny,
    Digest,
    DigestPreference,
    NiHashAlgorithm,
    NiQueryParams,
    NiUri,
    NiComparisonResult,
    WellKnownPathParts,
} from './types.js';

export { isPaginationError, isPaginationParams, SfDate, SfDisplayString, SfToken } from './types.js';

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
    buildStrictCorsHeadersForOrigin,
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
// Targeted Cache-Control (RFC 9213)
// =============================================================================
export {
    parseTargetedCacheControl,
    formatTargetedCacheControl,
    parseCdnCacheControl,
    formatCdnCacheControl,
    selectTargetedCacheControl,
} from './targeted-cache-control.js';

// =============================================================================
// Cache Groups (RFC 9875)
// =============================================================================
export {
    parseCacheGroups,
    formatCacheGroups,
    parseCacheGroupInvalidation,
    formatCacheGroupInvalidation,
    sharesCacheGroup,
} from './cache-groups.js';

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
// Accept-Patch (RFC 5789)
// =============================================================================
export {
    parseAcceptPatch,
    formatAcceptPatch,
    supportsPatch,
} from './patch.js';

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
// Compression Dictionary Transport (RFC 9842)
// =============================================================================
export {
    parseUseAsDictionary,
    formatUseAsDictionary,
    validateUseAsDictionary,
    parseAvailableDictionary,
    formatAvailableDictionary,
    parseDictionaryId,
    formatDictionaryId,
    matchesDictionary,
    selectBestDictionary,
    mergeDictionaryVary,
} from './compression-dictionary.js';

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
// Link-Template Header (RFC 9652)
// =============================================================================
export {
    parseLinkTemplateHeader,
    formatLinkTemplateHeader,
    expandLinkTemplate,
    resolveTemplateVariableUri,
} from './link-template.js';

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
// Authorization (RFC 7617 + RFC 6750 + RFC 7616 + RFC 7636 + W3C WebAuthn)
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
    // PKCE (RFC 7636)
    generatePkceCodeVerifier,
    derivePkceCodeChallenge,
    verifyPkceCodeVerifier,
    validatePkceCodeVerifier,
    validatePkceCodeChallenge,
    parsePkceAuthorizationRequestParams,
    formatPkceAuthorizationRequestParams,
    parsePkceTokenRequestParams,
    formatPkceTokenRequestParams,
    // OAuth Rich Authorization Requests (RFC 9396)
    parseAuthorizationDetails,
    parseAuthorizationDetailsObject,
    formatAuthorizationDetails,
    validateAuthorizationDetails,
    // WebAuthn (W3C WebAuthn Level 3)
    parseWebauthnBase64url,
    formatWebauthnBase64url,
    validateWebauthnBase64url,
    parseWebauthnCreationOptionsFromJson,
    formatWebauthnCreationOptionsToJson,
    validateWebauthnCreationOptions,
    parseWebauthnRequestOptionsFromJson,
    formatWebauthnRequestOptionsToJson,
    validateWebauthnRequestOptions,
    parseWebauthnClientDataJson,
    formatWebauthnClientDataJson,
    validateWebauthnClientData,
    parseWebauthnAuthenticatorData,
    validateWebauthnAuthenticatorData,
    validateWebauthnCoseAlgorithm,
    WEBAUTHN_COSE_ALGORITHM_IDS,
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
// Priority (RFC 9218)
// =============================================================================
export {
    parsePriority,
    formatPriority,
    applyPriorityDefaults,
    mergePriority,
} from './priority.js';

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
// Additional Status Codes (RFC 6585)
// =============================================================================
export {
    parseRfc6585StatusCode,
    formatRfc6585StatusCode,
    validateRfc6585StatusCode,
    getRfc6585StatusInfo,
    formatRfc6585Headers,
} from './additional-status.js';

// =============================================================================
// Early-Data + 425 Too Early (RFC 8470)
// =============================================================================
export {
    parseEarlyData,
    formatEarlyData,
    hasEarlyDataSignal,
    canSend425,
} from './early-data.js';

// =============================================================================
// Early Hints 103 (RFC 8297)
// =============================================================================
export {
    EARLY_HINTS_STATUS,
    parseEarlyHintsLinks,
    formatEarlyHintsLinks,
    validateEarlyHintsLinks,
    extractPreloadLinks,
    mergeEarlyHintsLinks,
} from './early-hints.js';

// =============================================================================
// Alt-Svc + Alt-Used (RFC 7838)
// =============================================================================
export {
    parseAltSvc,
    formatAltSvc,
    parseAltUsed,
    formatAltUsed,
} from './alt-svc.js';

// =============================================================================
// W3C Fetch Metadata
// =============================================================================
export {
    parseSecFetchDest,
    formatSecFetchDest,
    parseSecFetchMode,
    formatSecFetchMode,
    parseSecFetchSite,
    formatSecFetchSite,
    parseSecFetchUser,
    formatSecFetchUser,
    parseFetchMetadata,
    evaluateFetchMetadataPolicy,
    fetchMetadataVary,
} from './fetch-metadata.js';

// =============================================================================
// W3C Clear Site Data
// =============================================================================
export {
    parseClearSiteData,
    formatClearSiteData,
    validateClearSiteData,
} from './clear-site-data.js';

// =============================================================================
// W3C Referrer Policy
// =============================================================================
export {
    parseReferrerPolicy,
    parseReferrerPolicyHeader,
    formatReferrerPolicy,
    validateReferrerPolicy,
    selectEffectiveReferrerPolicy,
} from './referrer-policy.js';

// =============================================================================
// W3C Reporting API
// =============================================================================
export {
    REPORTS_MEDIA_TYPE,
    parseReportingEndpoints,
    formatReportingEndpoints,
    processReportingEndpointsForResponse,
    stripUrlForReport,
    serializeReports,
    formatReportsJson,
    parseReportsJson,
} from './reporting.js';

// =============================================================================
// W3C Content Security Policy Level 3 (subset)
// =============================================================================
export {
    parseContentSecurityPolicy,
    formatContentSecurityPolicy,
    parseContentSecurityPolicyReportOnly,
    formatContentSecurityPolicyReportOnly,
    parseContentSecurityPolicies,
    validateContentSecurityPolicy,
    parseCspSourceList,
    formatCspSourceList,
    validateCspSourceList,
} from './csp.js';

// =============================================================================
// W3C Trace Context
// =============================================================================
export {
    parseTraceparent,
    formatTraceparent,
    validateTraceparent,
    parseTracestate,
    formatTracestate,
    validateTracestate,
    updateTraceparentParent,
    restartTraceparent,
    addOrUpdateTracestate,
    removeTracestateKey,
    truncateTracestate,
} from './trace-context.js';

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
// JSON Patch (RFC 6902)
// =============================================================================
export {
    JSON_PATCH_MEDIA_TYPE,
    parseJsonPatch,
    tryParseJsonPatch,
    formatJsonPatch,
    validateJsonPatch,
    applyJsonPatch,
} from './json-patch.js';

// =============================================================================
// JSON Merge Patch (RFC 7396)
// =============================================================================
export {
    MERGE_PATCH_CONTENT_TYPE,
    parseJsonMergePatch,
    formatJsonMergePatch,
    validateJsonMergePatch,
    applyJsonMergePatch,
} from './json-merge-patch.js';

// =============================================================================
// JSON Canonicalization Scheme (RFC 8785)
// =============================================================================
export {
    formatCanonicalJson,
    formatCanonicalJsonUtf8,
    validateCanonicalJson,
    parseCanonicalJson,
} from './json-canonicalization.js';

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
// OpenAPI
// =============================================================================
export {
    normalizeOpenApiParameterSpec,
    formatQueryParameter,
    parseQueryParameter,
    formatPathParameter,
    parsePathParameter,
    formatHeaderParameter,
    parseHeaderParameter,
    formatCookieParameter,
    parseCookieParameter,
    parseOpenApiRuntimeExpression,
    formatOpenApiRuntimeExpression,
    isOpenApiRuntimeExpression,
    evaluateOpenApiRuntimeExpression,
    materializeOpenApiLinkValues,
    resolveOpenApiCallbackUrl,
    parseOpenApiSecurityRequirements,
    tryParseOpenApiSecurityRequirements,
    validateOpenApiSecurityRequirements,
    normalizeOpenApiSecurityRequirements,
    resolveEffectiveOpenApiSecurity,
    evaluateOpenApiSecurity,
    compileOpenApiPathMatcher,
    extractOpenApiPathParams,
    resolveOpenApiServerUrl,
    listOpenApiServerCandidates,
    lintOpenApiDocument,
} from './openapi.js';

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
// Named Information URI (RFC 6920)
// =============================================================================
export {
    parseNiUri,
    formatNiUri,
    compareNiUris,
    parseNiUrlSegment,
    formatNiUrlSegment,
    toWellKnownNiUrl,
    fromWellKnownNiUrl,
    computeNiDigest,
    verifyNiDigest,
} from './ni.js';

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
    tryParseJrd,
    formatJrd,
    validateJrd,
    matchResource,
    filterByRel,
} from './webfinger.js';

// =============================================================================
// W3C Webmention
// =============================================================================
export type {
    WebmentionDiscoverySource,
    WebmentionEndpointDiscoveryInput,
    WebmentionEndpointDiscoveryResult,
    WebmentionRequest,
    WebmentionValidationOptions,
} from './types.js';

export {
    WEBMENTION_REL,
    WEBMENTION_CONTENT_TYPE,
    discoverWebmentionEndpoint,
    parseWebmentionRequest,
    validateWebmentionRequest,
    formatWebmentionRequest,
    isWebmentionSuccessStatus,
} from './webmention.js';

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
    tryParseHostMetaJson,
    formatHostMetaJson,
} from './host-meta.js';

// =============================================================================
// RFC 8414 — OAuth 2.0 Authorization Server Metadata
// =============================================================================
export type {
    AuthorizationServerMetadata,
    AuthorizationServerMetadataParseOptions,
    AuthorizationServerMetadataValidationOptions,
    AuthorizationServerMetadataFormatOptions,
} from './types.js';

export {
    OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX,
    parseAuthorizationServerMetadata,
    parseAuthorizationServerMetadataObject,
    formatAuthorizationServerMetadata,
    validateAuthorizationServerMetadata,
    buildAuthorizationServerMetadataUrl,
    mergeSignedAuthorizationServerMetadata,
} from './oauth-authorization-server-metadata.js';

// =============================================================================
// RFC 8615 — Well-Known URIs
// =============================================================================
export {
    WELL_KNOWN_PREFIX,
    isWellKnownPath,
    isWellKnownUri,
    validateWellKnownSuffix,
    buildWellKnownPath,
    buildWellKnownUri,
    parseWellKnownPath,
} from './well-known.js';
