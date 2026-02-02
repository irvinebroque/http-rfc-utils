/**
 * Proxy-Status utilities per RFC 9209.
 * RFC 9209 §2-§2.4.
 * @see https://www.rfc-editor.org/rfc/rfc9209.html#section-2
 */

import type { ProxyStatusEntry, ProxyStatusParams, ProxyErrorType, SfBareItem, SfItem, SfList } from './types.js';
import { parseSfList, serializeSfList } from './structured-fields.js';

/**
 * All 32 proxy error types defined in RFC 9209 §2.3.
 */
export const PROXY_ERROR_TYPES: readonly ProxyErrorType[] = [
    'dns_timeout',
    'dns_error',
    'destination_not_found',
    'destination_unavailable',
    'destination_ip_prohibited',
    'destination_ip_unroutable',
    'connection_refused',
    'connection_terminated',
    'connection_timeout',
    'connection_read_timeout',
    'connection_write_timeout',
    'connection_limit_reached',
    'tls_protocol_error',
    'tls_certificate_error',
    'tls_alert_received',
    'http_request_error',
    'http_request_denied',
    'http_response_incomplete',
    'http_response_header_section_size',
    'http_response_header_size',
    'http_response_body_size',
    'http_response_trailer_section_size',
    'http_response_trailer_size',
    'http_response_transfer_coding',
    'http_response_content_coding',
    'http_response_timeout',
    'http_upgrade_failed',
    'http_protocol_error',
    'proxy_internal_response',
    'proxy_internal_error',
    'proxy_configuration_error',
    'proxy_loop_detected',
] as const;

const PROXY_ERROR_TYPE_SET = new Set<string>(PROXY_ERROR_TYPES);

/**
 * Type guard to check if a value is a known proxy error type.
 * RFC 9209 §2.3.
 */
export function isProxyErrorType(value: string): value is ProxyErrorType {
    return PROXY_ERROR_TYPE_SET.has(value);
}

function isInteger(value: number): boolean {
    return Number.isInteger(value) && Number.isFinite(value);
}

// RFC 9209 §2.1: Parse parameters from SF item params.
function parseProxyStatusParams(params?: Record<string, SfBareItem>): ProxyStatusParams {
    const result: ProxyStatusParams = {};
    if (!params) {
        return result;
    }

    const extensions: Record<string, SfBareItem> = {};

    for (const [key, value] of Object.entries(params)) {
        switch (key) {
            // RFC 9209 §2.1.1: error parameter is a Token.
            case 'error':
                if (typeof value === 'string') {
                    result.error = value;
                }
                break;
            // RFC 9209 §2.1.2: next-hop is a String or Token.
            case 'next-hop':
                if (typeof value === 'string') {
                    result.nextHop = value;
                }
                break;
            // RFC 9209 §2.1.3: next-protocol is a Token or Byte Sequence.
            case 'next-protocol':
                if (typeof value === 'string') {
                    result.nextProtocol = value;
                }
                break;
            // RFC 9209 §2.1.4: received-status is an Integer.
            case 'received-status':
                if (typeof value === 'number' && isInteger(value)) {
                    result.receivedStatus = value;
                }
                break;
            // RFC 9209 §2.1.5: details is a String.
            case 'details':
                if (typeof value === 'string') {
                    result.details = value;
                }
                break;
            // RFC 9209 §2.3.2: rcode extra parameter for dns_error.
            case 'rcode':
                if (typeof value === 'string') {
                    result.rcode = value;
                }
                break;
            // RFC 9209 §2.3.2: info-code extra parameter for dns_error.
            case 'info-code':
                if (typeof value === 'number' && isInteger(value)) {
                    result.infoCode = value;
                }
                break;
            // RFC 9209 §2.3.15: alert-id extra parameter for tls_alert_received.
            case 'alert-id':
                if (typeof value === 'number' && isInteger(value)) {
                    result.alertId = value;
                }
                break;
            // RFC 9209 §2.3.15: alert-message extra parameter for tls_alert_received.
            case 'alert-message':
                if (typeof value === 'string') {
                    result.alertMessage = value;
                }
                break;
            default:
                // RFC 9209 §2.1: Unrecognized parameters MUST be ignored, but preserve for extensibility.
                extensions[key] = value;
                break;
        }
    }

    if (Object.keys(extensions).length > 0) {
        result.extensions = extensions;
    }

    return result;
}

// RFC 9209 §2: Build SF item params from typed interface.
function buildProxyStatusParams(params: ProxyStatusParams): Record<string, SfBareItem> | undefined {
    const result: Record<string, SfBareItem> = {};

    if (params.error !== undefined) {
        result.error = params.error;
    }
    if (params.nextHop !== undefined) {
        result['next-hop'] = params.nextHop;
    }
    if (params.nextProtocol !== undefined) {
        result['next-protocol'] = params.nextProtocol;
    }
    if (params.receivedStatus !== undefined) {
        if (!isInteger(params.receivedStatus)) {
            throw new Error('Invalid Proxy-Status received-status value');
        }
        result['received-status'] = params.receivedStatus;
    }
    if (params.details !== undefined) {
        result.details = params.details;
    }
    if (params.rcode !== undefined) {
        result.rcode = params.rcode;
    }
    if (params.infoCode !== undefined) {
        if (!isInteger(params.infoCode)) {
            throw new Error('Invalid Proxy-Status info-code value');
        }
        result['info-code'] = params.infoCode;
    }
    if (params.alertId !== undefined) {
        if (!isInteger(params.alertId)) {
            throw new Error('Invalid Proxy-Status alert-id value');
        }
        result['alert-id'] = params.alertId;
    }
    if (params.alertMessage !== undefined) {
        result['alert-message'] = params.alertMessage;
    }

    if (params.extensions) {
        for (const [key, value] of Object.entries(params.extensions)) {
            if (!(key in result)) {
                result[key] = value as SfBareItem;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parse Proxy-Status header value into entries.
 * RFC 9209 §2: Proxy-Status is a Structured Field List.
 * Each member MUST be a String or Token (not Inner List).
 * First member = closest to origin; last = closest to user agent.
 */
export function parseProxyStatus(header: string): ProxyStatusEntry[] | null {
    if (!header || !header.trim()) {
        return [];
    }

    const list = parseSfList(header);
    if (!list) {
        return null;
    }

    const entries: ProxyStatusEntry[] = [];
    for (const member of list) {
        // RFC 9209 §2: Each member MUST have a type of either String or Token.
        // Inner lists are not allowed.
        if ('items' in member) {
            return null;
        }
        if (typeof member.value !== 'string') {
            return null;
        }

        entries.push({
            proxy: member.value,
            params: parseProxyStatusParams(member.params),
        });
    }

    return entries;
}

/**
 * Format Proxy-Status header value from entries.
 * RFC 9209 §2: Proxy-Status Structured Field serialization.
 */
export function formatProxyStatus(entries: ProxyStatusEntry[]): string {
    const list: SfList = entries.map((entry) => {
        const params = buildProxyStatusParams(entry.params ?? {});
        const item: SfItem = params ? { value: entry.proxy, params } : { value: entry.proxy };
        return item;
    });

    return serializeSfList(list);
}
