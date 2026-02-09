/**
 * Security-related types.
 *
 * References: RFC 6797 (HSTS), W3C Fetch Metadata, W3C Trace Context.
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
