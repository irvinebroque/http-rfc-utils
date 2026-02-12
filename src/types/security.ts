/**
 * Security-related types.
 *
 * References: RFC 6797 (HSTS), W3C Fetch Metadata, W3C Clear Site Data, W3C Referrer Policy, W3C CSP3, W3C Trace Context.
 * @see https://www.rfc-editor.org/rfc/rfc6797.html
 */

// Strict-Transport-Security (RFC 6797)
export interface StrictTransportSecurityOptions {
    maxAge: number;
    includeSubDomains?: boolean;
}

// W3C Fetch Metadata
export interface FetchMetadata {
    dest?:
        | 'audio'
        | 'audioworklet'
        | 'document'
        | 'embed'
        | 'empty'
        | 'font'
        | 'frame'
        | 'iframe'
        | 'image'
        | 'manifest'
        | 'object'
        | 'paintworklet'
        | 'report'
        | 'script'
        | 'serviceworker'
        | 'sharedworker'
        | 'style'
        | 'track'
        | 'video'
        | 'webidentity'
        | 'worker'
        | 'xslt';
    mode?: 'cors' | 'navigate' | 'no-cors' | 'same-origin' | 'websocket';
    site?: 'cross-site' | 'same-origin' | 'same-site' | 'none';
    user?: boolean;
}

export interface FetchMetadataPolicy {
    strict?: boolean;
    allowSameOrigin?: boolean;
    allowSameSite?: boolean;
    allowNone?: boolean;
    allowCrossSite?: boolean;
    allowTopLevelNavigation?: boolean;
    requireUserActivationForCrossSiteNavigation?: boolean;
}

export interface FetchMetadataPolicyDecision {
    allow: boolean;
    reason:
        | 'permissive-default'
        | 'missing-site'
        | 'same-origin'
        | 'same-site'
        | 'none'
        | 'cross-site'
        | 'cross-site-top-level-navigation'
        | 'cross-site-blocked'
        | 'site-blocked';
}

// W3C Clear Site Data
export type ClearSiteDataType = 'cache' | 'cookies' | 'storage' | 'executionContexts';

export type ClearSiteDataDirective = ClearSiteDataType | '*';

// W3C Referrer Policy
export type ReferrerPolicyToken =
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'same-origin'
    | 'origin'
    | 'strict-origin'
    | 'origin-when-cross-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';

export type ReferrerPolicy = ReferrerPolicyToken | '';

// W3C Trace Context
export interface Traceparent {
    version: string;
    traceId: string;
    parentId: string;
    traceFlags: string;
}

export interface TracestateEntry {
    key: string;
    value: string;
}

export interface ParsedTraceContext {
    traceparent: Traceparent | null;
    tracestate: TracestateEntry[];
}

export interface TraceContextValidationResult {
    valid: boolean;
    errors: string[];
}

// W3C Content Security Policy Level 3 subset
export type CspDirectiveName =
    | 'default-src'
    | 'script-src'
    | 'style-src'
    | 'img-src'
    | 'connect-src'
    | 'object-src'
    | 'base-uri'
    | 'form-action'
    | 'frame-ancestors'
    | 'report-uri'
    | 'report-to';

export type CspSourceKeyword =
    | "'self'"
    | "'none'"
    | "'unsafe-inline'"
    | "'unsafe-eval'";

export type CspHashAlgorithm = 'sha256' | 'sha384' | 'sha512';

export type CspSourceExpression = string;

export interface ContentSecurityPolicy {
    defaultSrc?: CspSourceExpression[];
    scriptSrc?: CspSourceExpression[];
    styleSrc?: CspSourceExpression[];
    imgSrc?: CspSourceExpression[];
    connectSrc?: CspSourceExpression[];
    objectSrc?: CspSourceExpression[];
    baseUri?: CspSourceExpression[];
    formAction?: CspSourceExpression[];
    frameAncestors?: CspSourceExpression[];
    reportUri?: string[];
    reportTo?: string;
}
