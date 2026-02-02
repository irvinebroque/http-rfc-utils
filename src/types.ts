// Pagination types
export interface PaginationParams {
    limit: number;
    offset: number;
    sort?: string;
}

export interface PaginationError {
    error: string;
}

export type PaginationResult = PaginationParams | PaginationError;

export interface DecodedCursor {
    offset: number;
}

export interface PaginationLinks {
    self: string;
    first: string;
    next?: string;
    prev?: string;
    last: string;
}

export interface PaginatedMeta {
    totalCount: number;
    pageSize: number;
    timestamp: string;
}

// Problem Details (RFC 9457)
export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
    [key: string]: unknown;  // Extension members
}

// Link Header (RFC 8288)
export interface LinkDefinition {
    href: string;
    rel: string;
    type?: string;
    title?: string;
    titleLang?: string;              // Language from title* (RFC 8288 §3.4.1)
    hreflang?: string | string[];    // May appear multiple times (RFC 8288 §3.4.1)
    media?: string;
    anchor?: string;
    rev?: string;                    // Deprecated but parsed (RFC 8288 §3.3)
    [key: string]: string | string[] | undefined;  // Extension attributes
}

// ETag (RFC 9110)
export interface ETag {
    weak: boolean;
    value: string;
}

// Cache Control (RFC 9111)
export interface CacheOptions {
    public?: boolean;
    private?: boolean;
    privateFields?: string[];
    maxAge?: number;
    sMaxAge?: number;
    noCache?: boolean;
    noCacheFields?: string[];
    noStore?: boolean;
    mustRevalidate?: boolean;
    proxyRevalidate?: boolean;
    immutable?: boolean;
    staleWhileRevalidate?: number;
    staleIfError?: number;
}

// Content Negotiation (RFC 7231)
export interface AcceptEntry {
    type: string;
    subtype: string;
    q: number;
    params: Map<string, string>;
}

export type MediaType = 'json' | 'csv' | 'html' | 'text' | 'xml';

// CORS
export interface CorsOptions {
    origin?: string | string[] | '*';
    methods?: string[];
    allowHeaders?: string[];
    exposeHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}

// Conditional Requests (RFC 9110)
export interface ConditionalResult {
    proceed: boolean;
    status?: 304 | 412;
    headers?: Record<string, string>;
}

// Range Requests (RFC 9110)
export interface ByteRange {
    start: number;
    end: number;
}

export interface RangeSpec {
    unit: 'bytes';
    ranges: ByteRange[];
}

export interface ContentRange {
    unit: 'bytes';
    range?: ByteRange;
    size: number | '*';
    unsatisfied?: boolean;
}

export interface RangeDecision {
    type: 'none' | 'partial' | 'unsatisfiable' | 'ignored';
    ranges?: ByteRange[];
    headers?: Record<string, string>;
}

// Prefer / Preference-Applied (RFC 7240)
export interface PreferParam {
    key: string;
    value?: string;
}

export interface PreferToken {
    token: string;
    value?: string;
    params: PreferParam[];
}

export type PreferMap = Map<string, PreferToken>;

// Forwarded (RFC 7239)
export interface ForwardedElement {
    for?: string;
    by?: string;
    host?: string;
    proto?: string;
    extensions?: Record<string, string>;
}

// Content-Disposition (RFC 6266 + RFC 8187)
export interface ContentDisposition {
    type: string;
    params: Record<string, string>;
}

export interface DispositionParams {
    filename?: string;
    filenameStar?: { value: string; language?: string };
    [key: string]: string | { value: string; language?: string } | undefined;
}

export interface ParamOptions {
    extended?: boolean;
    language?: string;
}

// Extended parameter value (RFC 8187)
export interface ExtValue {
    charset: string;
    language?: string;
    value: string;
}

export interface ExtValueOptions {
    language?: string;
}

// Accept-Language (RFC 9110 + RFC 4647)
export interface LanguageRange {
    tag: string;
    q: number;
}

// Accept-Encoding (RFC 9110)
export interface EncodingRange {
    encoding: string;
    q: number;
}

// Retry-After + Vary (RFC 9110)
export interface RetryAfterValue {
    date?: Date;
    delaySeconds?: number;
}

// Structured Field Values (RFC 8941)
export type SfBareItem = number | string | boolean | Uint8Array;

export interface SfItem {
    value: SfBareItem;
    params?: Record<string, SfBareItem>;
}

export type SfInnerList = { items: SfItem[]; params?: Record<string, SfBareItem> };
export type SfList = Array<SfItem | SfInnerList>;
export type SfDictionary = Record<string, SfItem | SfInnerList>;

// Cookies (RFC 6265)
export interface CookieAttributes {
    expires?: Date;
    maxAge?: number;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    extensions?: Record<string, string | undefined>;
}

export interface SetCookie {
    name: string;
    value: string;
    attributes?: CookieAttributes;
}

export interface StoredCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    creationTime: Date;
    lastAccessTime?: Date;
    expires?: Date;
    secureOnly?: boolean;
    httpOnly?: boolean;
    hostOnly?: boolean;
}

export interface CookieHeaderOptions {
    now?: Date;
    includeHttpOnly?: boolean;
    isSecure?: boolean;
}

// Strict-Transport-Security (RFC 6797)
export interface StrictTransportSecurityOptions {
    maxAge: number;
    includeSubDomains?: boolean;
}

// Client Hints (RFC 8942)
export type ClientHintToken = string;
export type ClientHintList = string[];

// Cache-Status (RFC 9211)
export interface CacheStatusParams {
    hit?: boolean;
    fwd?: string;
    fwdStatus?: number;
    ttl?: number;
    stored?: boolean;
    collapsed?: boolean;
    key?: string;
    detail?: string;
    extensions?: Record<string, SfBareItem>;
}

export interface CacheStatusEntry {
    cache: string;
    params: CacheStatusParams;
}

// Proxy-Status (RFC 9209)

/**
 * All 32 proxy error types defined in RFC 9209 §2.3.
 */
export type ProxyErrorType =
    | 'dns_timeout'
    | 'dns_error'
    | 'destination_not_found'
    | 'destination_unavailable'
    | 'destination_ip_prohibited'
    | 'destination_ip_unroutable'
    | 'connection_refused'
    | 'connection_terminated'
    | 'connection_timeout'
    | 'connection_read_timeout'
    | 'connection_write_timeout'
    | 'connection_limit_reached'
    | 'tls_protocol_error'
    | 'tls_certificate_error'
    | 'tls_alert_received'
    | 'http_request_error'
    | 'http_request_denied'
    | 'http_response_incomplete'
    | 'http_response_header_section_size'
    | 'http_response_header_size'
    | 'http_response_body_size'
    | 'http_response_trailer_section_size'
    | 'http_response_trailer_size'
    | 'http_response_transfer_coding'
    | 'http_response_content_coding'
    | 'http_response_timeout'
    | 'http_upgrade_failed'
    | 'http_protocol_error'
    | 'proxy_internal_response'
    | 'proxy_internal_error'
    | 'proxy_configuration_error'
    | 'proxy_loop_detected';

/**
 * Parameters for Proxy-Status entries.
 * RFC 9209 §2.1.
 */
export interface ProxyStatusParams {
    /** RFC 9209 §2.1.1: Proxy error type token. */
    error?: string;
    /** RFC 9209 §2.1.2: Next hop identifier (hostname, IP, or alias). */
    nextHop?: string;
    /** RFC 9209 §2.1.3: ALPN protocol identifier. */
    nextProtocol?: string;
    /** RFC 9209 §2.1.4: HTTP status code received from next hop. */
    receivedStatus?: number;
    /** RFC 9209 §2.1.5: Additional implementation-specific details. */
    details?: string;
    /** RFC 9209 §2.3.2: DNS RCODE for dns_error. */
    rcode?: string;
    /** RFC 9209 §2.3.2: Extended DNS Error Code INFO-CODE. */
    infoCode?: number;
    /** RFC 9209 §2.3.15: TLS alert ID for tls_alert_received. */
    alertId?: number;
    /** RFC 9209 §2.3.15: TLS alert message for tls_alert_received. */
    alertMessage?: string;
    /** Extension parameters not defined in RFC 9209. */
    extensions?: Record<string, SfBareItem>;
}

/**
 * A single Proxy-Status entry representing one intermediary.
 * RFC 9209 §2.
 */
export interface ProxyStatusEntry {
    /** Proxy identifier (service name, hostname, IP, or generated string). */
    proxy: string;
    /** Parameters describing this proxy's handling of the response. */
    params: ProxyStatusParams;
}

// Authorization (RFC 7617 + RFC 6750)
export interface AuthParam {
    name: string;
    value: string;
}

export interface AuthChallenge {
    scheme: string;
    token68?: string;
    params?: AuthParam[];
}

export interface AuthCredentials {
    scheme: string;
    token68?: string;
    params?: AuthParam[];
}

export interface BasicCredentials {
    username: string;
    password: string;
    encoding: 'utf-8' | 'latin1';
}

export interface BasicChallenge {
    scheme: 'Basic';
    realm: string;
    charset?: 'UTF-8';
}

export type BearerError = 'invalid_request' | 'invalid_token' | 'insufficient_scope';

export interface BearerChallenge {
    realm?: string;
    scope?: string;
    error?: BearerError;
    errorDescription?: string;
    errorUri?: string;
    params?: Record<string, string>;
}

// Digest Authentication (RFC 7616)

/**
 * Digest authentication algorithm identifiers.
 * RFC 7616 §3.3: Algorithms for computing hash functions.
 * MD5 included for backward compatibility; SHA-256 MUST be supported.
 */
export type DigestAuthAlgorithm =
    | 'MD5'
    | 'MD5-sess'
    | 'SHA-256'
    | 'SHA-256-sess'
    | 'SHA-512-256'
    | 'SHA-512-256-sess';

/**
 * Quality of protection values.
 * RFC 7616 §3.5: qop-options in challenges, qop in credentials.
 */
export type DigestAuthQop = 'auth' | 'auth-int';

/**
 * Parsed Digest WWW-Authenticate challenge.
 * RFC 7616 §3.3.
 */
export interface DigestChallenge {
    scheme: 'Digest';
    realm: string;
    domain?: string[];
    nonce: string;
    opaque?: string;
    stale?: boolean;
    algorithm?: DigestAuthAlgorithm;
    qop?: DigestAuthQop[];
    charset?: 'UTF-8';
    userhash?: boolean;
}

/**
 * Parsed Digest Authorization credentials.
 * RFC 7616 §3.4.
 */
export interface DigestCredentials {
    scheme: 'Digest';
    username: string;
    usernameEncoded?: boolean;  // true if username* was used
    realm: string;
    uri: string;
    response: string;
    algorithm?: DigestAuthAlgorithm;
    cnonce?: string;
    opaque?: string;
    qop?: DigestAuthQop;
    nc?: string;
    userhash?: boolean;
}

/**
 * Authentication-Info header values.
 * RFC 7616 §3.5.
 */
export interface DigestAuthenticationInfo {
    nextnonce?: string;
    qop?: DigestAuthQop;
    rspauth?: string;
    cnonce?: string;
    nc?: string;
}

/**
 * Options for computing digest response.
 * RFC 7616 §3.4.1.
 */
export interface DigestComputeOptions {
    username: string;
    password: string;
    realm: string;
    method: string;
    uri: string;
    nonce: string;
    cnonce?: string;
    nc?: string;
    qop?: DigestAuthQop;
    algorithm?: DigestAuthAlgorithm;
    entityBody?: Uint8Array;
}

// Problem Response options
export interface ProblemOptions {
    type?: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
    extensions?: Record<string, unknown>;
}

// URI (RFC 3986)
export type UriComponent = 'path' | 'query' | 'fragment' | 'userinfo';

// Linkset (RFC 9264)

/**
 * Internationalized string value with optional language tag.
 * RFC 9264 §4.2.4.2, RFC 8187.
 */
export interface InternationalizedValue {
    value: string;
    language?: string;
}

/**
 * Link target object in JSON linkset format.
 * RFC 9264 §4.2.3, §4.2.4.
 */
export interface LinksetTarget {
    href: string;
    type?: string;
    hreflang?: string[];
    title?: string;
    'title*'?: InternationalizedValue[];
    media?: string;
    // Extension attributes (always arrays)
    [key: string]: string | string[] | InternationalizedValue[] | undefined;
}

/**
 * Link context object grouping targets by relation type.
 * RFC 9264 §4.2.2.
 */
export interface LinksetContext {
    anchor?: string;
    // Relation types map to arrays of targets
    [relationType: string]: LinksetTarget[] | string | undefined;
}

/**
 * Top-level linkset document structure.
 * RFC 9264 §4.2.1.
 */
export interface Linkset {
    linkset: LinksetContext[];
}

/**
 * Options for JSON linkset formatting.
 */
export interface LinksetJsonOptions {
    /** Group links by anchor (default: true) */
    groupByAnchor?: boolean;
}

// API Catalog (RFC 9727)

/**
 * Simple link for API catalog items.
 * RFC 9727 §3.1, §4.1.
 */
export interface ApiCatalogLink {
    href: string;
    type?: string;
    title?: string;
    hreflang?: string;
}

/**
 * Full API entry with service relations.
 * RFC 9727 §4.1, RFC 8631.
 */
export interface ApiCatalogApi {
    anchor: string;
    'service-desc'?: LinksetTarget[];
    'service-doc'?: LinksetTarget[];
    'service-meta'?: LinksetTarget[];
    status?: LinksetTarget[];
}

/**
 * Options for creating an API catalog document.
 * RFC 9727 §4.
 */
export interface ApiCatalogOptions {
    /** Context URI for the catalog (usually the well-known URL) */
    anchor: string;
    /** Full API entries with service relations */
    apis?: ApiCatalogApi[];
    /** Simple item links to API endpoints */
    items?: ApiCatalogLink[];
    /** Nested api-catalog links for scalability */
    nested?: string[];
    /** Include RFC 9727 profile parameter (default: true) */
    profile?: boolean;
}

/**
 * API catalog document with optional profile.
 * RFC 9727 §4.2, §7.3.
 */
export interface ApiCatalog extends Linkset {
    profile?: string;
}

// JSONPath (RFC 9535)

/**
 * A node in the result nodelist: value and its normalized path.
 * RFC 9535 §2.7.
 */
export interface JsonPathNode {
    /** The JSON value at this location */
    value: unknown;
    /** Normalized path to this node (e.g., "$['foo'][0]") */
    path: string;
}

/**
 * Options for JSONPath query execution.
 */
export interface JsonPathOptions {
    /** Throw on invalid query instead of returning null (default: false) */
    throwOnError?: boolean;
}

/**
 * JSONPath AST: root query node.
 * RFC 9535 §2.1.
 */
export interface JsonPathQuery {
    type: 'query';
    root: '$' | '@';
    segments: JsonPathSegment[];
}

/**
 * JSONPath segment types.
 * RFC 9535 §2.5.
 */
export type JsonPathSegment = JsonPathChildSegment | JsonPathDescendantSegment;

export interface JsonPathChildSegment {
    type: 'child';
    selectors: JsonPathSelector[];
}

export interface JsonPathDescendantSegment {
    type: 'descendant';
    selectors: JsonPathSelector[];
}

/**
 * JSONPath selector types.
 * RFC 9535 §2.3.
 */
export type JsonPathSelector =
    | JsonPathNameSelector
    | JsonPathWildcardSelector
    | JsonPathIndexSelector
    | JsonPathSliceSelector
    | JsonPathFilterSelector;

export interface JsonPathNameSelector {
    type: 'name';
    name: string;
}

export interface JsonPathWildcardSelector {
    type: 'wildcard';
}

export interface JsonPathIndexSelector {
    type: 'index';
    index: number;
}

export interface JsonPathSliceSelector {
    type: 'slice';
    start?: number;
    end?: number;
    step?: number;
}

export interface JsonPathFilterSelector {
    type: 'filter';
    expression: JsonPathLogicalExpr;
}

/**
 * JSONPath logical expression types for filter selectors.
 * RFC 9535 §2.3.5.
 */
export type JsonPathLogicalExpr =
    | JsonPathOrExpr
    | JsonPathAndExpr
    | JsonPathNotExpr
    | JsonPathComparisonExpr
    | JsonPathTestExpr
    | JsonPathFunctionExpr;

export interface JsonPathOrExpr {
    type: 'or';
    operands: JsonPathLogicalExpr[];
}

export interface JsonPathAndExpr {
    type: 'and';
    operands: JsonPathLogicalExpr[];
}

export interface JsonPathNotExpr {
    type: 'not';
    operand: JsonPathLogicalExpr;
}

export type JsonPathComparisonOp = '==' | '!=' | '<' | '<=' | '>' | '>=';

export interface JsonPathComparisonExpr {
    type: 'comparison';
    operator: JsonPathComparisonOp;
    left: JsonPathComparable;
    right: JsonPathComparable;
}

export interface JsonPathTestExpr {
    type: 'test';
    query: JsonPathQuery;
}

/**
 * JSONPath comparable types for comparisons.
 * RFC 9535 §2.3.5.2.
 */
export type JsonPathComparable =
    | JsonPathLiteral
    | JsonPathSingularQuery
    | JsonPathFunctionExpr;

export interface JsonPathLiteral {
    type: 'literal';
    value: string | number | boolean | null;
}

export interface JsonPathSingularQuery {
    type: 'singular-query';
    root: '$' | '@';
    segments: JsonPathSegment[];
}

/**
 * JSONPath function expression.
 * RFC 9535 §2.4.
 */
export type JsonPathFunctionName = 'length' | 'count' | 'match' | 'search' | 'value';

export interface JsonPathFunctionExpr {
    type: 'function';
    name: JsonPathFunctionName;
    args: JsonPathFunctionArg[];
}

export type JsonPathFunctionArg =
    | JsonPathLiteral
    | JsonPathQuery
    | JsonPathFunctionExpr;

// Digest Fields (RFC 9530)

/**
 * Active digest algorithms suitable for adversarial settings.
 * RFC 9530 §5, §7.2.
 */
export type DigestAlgorithm = 'sha-256' | 'sha-512';

/**
 * All recognized algorithms including deprecated ones.
 * RFC 9530 §5, §7.2.
 */
export type DigestAlgorithmAny =
    | DigestAlgorithm
    | 'md5'
    | 'sha'
    | 'unixsum'
    | 'unixcksum'
    | 'adler'
    | 'crc32c';

/**
 * A parsed digest value from Content-Digest or Repr-Digest fields.
 * RFC 9530 §2, §3.
 */
export interface Digest {
    /** Algorithm key (lowercase) */
    algorithm: string;
    /** Raw digest bytes */
    value: Uint8Array;
}

/**
 * A digest preference from Want-Content-Digest or Want-Repr-Digest fields.
 * RFC 9530 §4.
 */
export interface DigestPreference {
    /** Algorithm key (lowercase) */
    algorithm: string;
    /**
     * Preference weight (0-10).
     * 0 = not acceptable, 1 = least preferred, 10 = most preferred.
     */
    weight: number;
}

// HTTP Message Signatures (RFC 9421)

/**
 * Component identifier parameter flags.
 * RFC 9421 §2.1.
 */
export interface SignatureComponentParams {
    /** Strict Structured Field serialization */
    sf?: boolean;
    /** Dictionary member key */
    key?: string;
    /** Binary-wrapped */
    bs?: boolean;
    /** From request (response only) */
    req?: boolean;
    /** From trailers */
    tr?: boolean;
}

/**
 * A component identifier for signature base creation.
 * RFC 9421 §2.
 */
export interface SignatureComponent {
    /** Component name (field name or derived component) */
    name: string;
    /** Optional parameters */
    params?: SignatureComponentParams;
}

/**
 * Signature parameters.
 * RFC 9421 §2.3.
 */
export interface SignatureParams {
    /** Unix timestamp when signature was created */
    created?: number;
    /** Unix timestamp when signature expires */
    expires?: number;
    /** Unique nonce for replay protection */
    nonce?: string;
    /** Algorithm identifier */
    alg?: string;
    /** Key identifier */
    keyid?: string;
    /** Application-specific tag */
    tag?: string;
}

/**
 * Parsed Signature-Input entry.
 * RFC 9421 §4.1.
 */
export interface SignatureInput {
    /** Signature label */
    label: string;
    /** Covered components */
    components: SignatureComponent[];
    /** Signature parameters */
    params?: SignatureParams;
}

/**
 * Parsed Signature entry.
 * RFC 9421 §4.2.
 */
export interface Signature {
    /** Signature label (must match Signature-Input label) */
    label: string;
    /** Raw signature bytes */
    value: Uint8Array;
}

/**
 * Derived component names.
 * RFC 9421 §2.2.
 */
export type DerivedComponentName =
    | '@method'
    | '@target-uri'
    | '@authority'
    | '@scheme'
    | '@request-target'
    | '@path'
    | '@query'
    | '@query-param'
    | '@status';

/**
 * Message context for signature base creation.
 * RFC 9421 §2.
 */
export interface SignatureMessageContext {
    /** HTTP method (for requests) */
    method?: string;
    /** Full target URI */
    targetUri?: string;
    /** Authority (host + optional port) */
    authority?: string;
    /** Scheme (http/https) */
    scheme?: string;
    /** Absolute path */
    path?: string;
    /** Query string (with leading '?') */
    query?: string;
    /** HTTP status code (for responses) */
    status?: number;
    /** Header field values (field name -> values) */
    headers: Map<string, string[]>;
    /** Trailer field values (field name -> values) */
    trailers?: Map<string, string[]>;
    /** Request context (for response signatures) */
    request?: SignatureMessageContext;
}

/**
 * Result of signature base creation.
 * RFC 9421 §2.5.
 */
export interface SignatureBaseResult {
    /** The signature base string to sign */
    base: string;
    /** The formatted @signature-params value */
    signatureParams: string;
}

// URI Template (RFC 6570)

/**
 * A variable value for URI Template expansion.
 * RFC 6570 §2.3, §2.4.2.
 */
export type UriTemplateValue = string | string[] | Record<string, string> | undefined;

/**
 * Variable bindings for URI Template expansion.
 */
export type UriTemplateVariables = Record<string, UriTemplateValue>;

/**
 * Expression operators per RFC 6570 §2.2.
 */
export type UriTemplateOperator = '' | '+' | '#' | '.' | '/' | ';' | '?' | '&';

/**
 * Variable specification with optional modifiers.
 * RFC 6570 §2.3, §2.4.
 */
export interface UriTemplateVarSpec {
    name: string;
    prefix?: number;
    explode?: boolean;
}

/**
 * Parsed expression with operator and variables.
 * RFC 6570 §2.2.
 */
export interface UriTemplateExpression {
    operator: UriTemplateOperator;
    variables: UriTemplateVarSpec[];
}

/**
 * Part of a parsed URI Template: either a literal string or an expression.
 */
export type UriTemplatePart = string | UriTemplateExpression;

/**
 * Parsed URI Template structure.
 */
export interface UriTemplate {
    parts: UriTemplatePart[];
    variables: string[];
}

/**
 * Compiled template for efficient repeated expansion.
 */
export interface CompiledUriTemplate {
    expand: (variables: UriTemplateVariables) => string;
    variables: string[];
}

// Type guards
export function isPaginationError(result: PaginationResult): result is PaginationError {
    return 'error' in result;
}

export function isPaginationParams(result: PaginationResult): result is PaginationParams {
    return 'limit' in result && 'offset' in result;
}
