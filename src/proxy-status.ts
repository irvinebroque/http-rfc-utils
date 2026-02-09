/**
 * Proxy-Status utilities per RFC 9209.
 * RFC 9209 §2-§2.4.
 * @see https://www.rfc-editor.org/rfc/rfc9209.html#section-2
 */

import type { ProxyStatusEntry, ProxyStatusParams, ProxyErrorType, SfBareItem, SfItem, SfList } from './types.js';
import { SfToken } from './types.js';
import { isEmptyHeader } from './header-utils.js';
import { parseSfList, serializeSfList } from './structured-fields.js';
import { isSfInteger } from './structured-field-params.js';
import {
    buildSfParamsBySchema,
    createSfParamSchemaEntry,
    parseSfParamsBySchema,
    type SfParamSchemaEntry,
} from './structured-field-schema.js';

const SF_TOKEN = /^[A-Za-z*][A-Za-z0-9!#$%&'*+\-.^_`|~:\/]*$/;

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

const PROXY_STATUS_PARAM_SCHEMA: readonly SfParamSchemaEntry<ProxyStatusParams>[] = [
    createSfParamSchemaEntry<ProxyStatusParams, 'error'>({
        key: 'error',
        property: 'error',
        parse: (value) => value instanceof SfToken ? value.value : undefined,
        format: (value) => new SfToken(value as string),
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'nextHop'>({
        key: 'next-hop',
        property: 'nextHop',
        parse: (value) => {
            if (typeof value === 'string') {
                return value;
            }
            if (value instanceof SfToken) {
                return value.value;
            }
            return undefined;
        },
        format: (value) => {
            if (typeof value !== 'string') {
                return value as SfBareItem;
            }
            return SF_TOKEN.test(value) ? new SfToken(value) : value;
        },
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'nextProtocol'>({
        key: 'next-protocol',
        property: 'nextProtocol',
        parse: (value) => value instanceof SfToken ? value.value : undefined,
        format: (value) => new SfToken(value as string),
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'receivedStatus'>({
        key: 'received-status',
        property: 'receivedStatus',
        parse: (value) => typeof value === 'number' && isSfInteger(value) ? value : undefined,
        format: (value) => {
            if (typeof value !== 'number' || !isSfInteger(value)) {
                throw new Error('Invalid Proxy-Status received-status value');
            }
            return value;
        },
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'details'>({
        key: 'details',
        property: 'details',
        parse: (value) => typeof value === 'string' ? value : undefined,
        format: (value) => value as SfBareItem,
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'rcode'>({
        key: 'rcode',
        property: 'rcode',
        parse: (value) => value instanceof SfToken ? value.value : undefined,
        format: (value) => new SfToken(value as string),
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'infoCode'>({
        key: 'info-code',
        property: 'infoCode',
        parse: (value) => typeof value === 'number' && isSfInteger(value) ? value : undefined,
        format: (value) => {
            if (typeof value !== 'number' || !isSfInteger(value)) {
                throw new Error('Invalid Proxy-Status info-code value');
            }
            return value;
        },
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'alertId'>({
        key: 'alert-id',
        property: 'alertId',
        parse: (value) => typeof value === 'number' && isSfInteger(value) ? value : undefined,
        format: (value) => {
            if (typeof value !== 'number' || !isSfInteger(value)) {
                throw new Error('Invalid Proxy-Status alert-id value');
            }
            return value;
        },
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'alertMessage'>({
        key: 'alert-message',
        property: 'alertMessage',
        parse: (value) => {
            if (typeof value === 'string') {
                return value;
            }
            if (value instanceof SfToken) {
                return value.value;
            }
            return undefined;
        },
        format: (value) => value as SfBareItem,
    }),
];

// RFC 9209 §2.1: Parse parameters from SF item params.
function parseProxyStatusParams(params?: Record<string, SfBareItem>): ProxyStatusParams {
    return parseSfParamsBySchema(params, PROXY_STATUS_PARAM_SCHEMA);
}

// RFC 9209 §2: Build SF item params from typed interface.
function buildProxyStatusParams(params: ProxyStatusParams): Record<string, SfBareItem> | undefined {
    return buildSfParamsBySchema(params, PROXY_STATUS_PARAM_SCHEMA, 'mapped-only');
}

/**
 * Parse Proxy-Status header value into entries.
 * RFC 9209 §2: Proxy-Status is a Structured Field List.
 * Each member MUST be a String or Token (not Inner List).
 * First member = closest to origin; last = closest to user agent.
 */
export function parseProxyStatus(header: string): ProxyStatusEntry[] | null {
    if (isEmptyHeader(header)) {
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
        if (!(typeof member.value === 'string' || member.value instanceof SfToken)) {
            return null;
        }

        const proxy = member.value instanceof SfToken ? member.value.value : member.value;

        entries.push({
            proxy,
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
        const proxyToken = new SfToken(entry.proxy);
        const item: SfItem = params ? { value: proxyToken, params } : { value: proxyToken };
        return item;
    });

    return serializeSfList(list);
}
