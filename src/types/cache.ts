/**
 * Caching and validator-related types.
 * RFC 9110, RFC 9111, RFC 9211, RFC 9209.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html
 */

import type { SfBareItem, SfDictionary } from './structured-fields.js';

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

// Targeted Cache-Control (RFC 9213)
export interface TargetedCacheControl {
    public?: boolean;
    private?: boolean;
    noCache?: boolean;
    noStore?: boolean;
    maxAge?: number;
    sMaxAge?: number;
    mustRevalidate?: boolean;
    proxyRevalidate?: boolean;
    immutable?: boolean;
    staleWhileRevalidate?: number;
    staleIfError?: number;
    extensions?: SfDictionary;
}

export interface TargetedSelection {
    source: 'targeted' | 'fallback' | 'none';
    fieldName: string | null;
    targeted: TargetedCacheControl | null;
    fallback: string | null;
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

// Retry-After + Vary (RFC 9110)
export interface RetryAfterValue {
    date?: Date;
    delaySeconds?: number;
}

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

export interface ProxyStatusParams {
    error?: string;
    nextHop?: string;
    nextProtocol?: string;
    receivedStatus?: number;
    details?: string;
    rcode?: string;
    infoCode?: number;
    alertId?: number;
    alertMessage?: string;
    extensions?: Record<string, SfBareItem>;
}

export interface ProxyStatusEntry {
    proxy: string;
    params: ProxyStatusParams;
}
