/**
 * Proxy-Status utilities per RFC 9209.
 * RFC 9209 §2-§2.4.
 * @see https://www.rfc-editor.org/rfc/rfc9209.html#section-2
 */

import { Buffer } from 'node:buffer';

import type { ProxyStatusEntry, ProxyStatusParams, ProxyErrorType, SfBareItem, SfItem, SfList } from './types.js';
import { SfToken } from './types.js';
import { isEmptyHeader } from './header-utils.js';
import { expectSfItem, isSfTokenText } from './structured-field-helpers.js';
import { parseSfList, serializeSfList } from './structured-fields.js';
import { isSfInteger } from './structured-field-params.js';
import {
    buildSfParamsBySchema,
    createSfParamSchemaEntry,
    parseSfParamsBySchema,
    type SfParamSchemaEntry,
} from './structured-field-schema.js';

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

function decodeProxyStatusBinaryValue(value: Uint8Array): string {
    return Buffer.from(value).toString('latin1');
}

function encodeProxyStatusBinaryValue(value: string): Uint8Array {
    for (let index = 0; index < value.length; index++) {
        const codePoint = value.charCodeAt(index);
        if (codePoint > 0xFF) {
            throw new Error(
                `Proxy-Status param "next-protocol" must contain only Latin-1 bytes; found code point U+${codePoint.toString(16).toUpperCase().padStart(4, '0')} at index ${index}`,
            );
        }
    }
    return new Uint8Array(Buffer.from(value, 'latin1'));
}

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
                return value as unknown as SfBareItem;
            }
            return isSfTokenText(value) ? new SfToken(value) : value;
        },
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'nextProtocol'>({
        key: 'next-protocol',
        property: 'nextProtocol',
        parse: (value) => {
            if (value instanceof SfToken) {
                return value.value;
            }
            if (value instanceof Uint8Array) {
                return decodeProxyStatusBinaryValue(value);
            }
            return undefined;
        },
        format: (value) => {
            if (typeof value !== 'string') {
                throw new Error(
                    `Proxy-Status param "next-protocol" must be a string; received type ${typeof value}`,
                );
            }
            if (isSfTokenText(value)) {
                return new SfToken(value);
            }
            return encodeProxyStatusBinaryValue(value);
        },
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'receivedStatus'>({
        key: 'received-status',
        property: 'receivedStatus',
        parse: (value) => typeof value === 'number' && isSfInteger(value) ? value : undefined,
        format: (value) => {
            if (typeof value !== 'number') {
                throw new Error(
                    `Proxy-Status param "received-status" must be a number; received type ${typeof value}`,
                );
            }
            if (!isSfInteger(value)) {
                throw new Error(
                    `Proxy-Status param "received-status" must be an RFC 8941 integer; received ${String(value)}`,
                );
            }
            return value;
        },
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'details'>({
        key: 'details',
        property: 'details',
        parse: (value) => typeof value === 'string' ? value : undefined,
        format: (value) => {
            if (typeof value !== 'string') {
                throw new Error(`Proxy-Status param "details" must be a string; received type ${typeof value}`);
            }
            return value;
        },
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
            if (typeof value !== 'number') {
                throw new Error(`Proxy-Status param "info-code" must be a number; received type ${typeof value}`);
            }
            if (!isSfInteger(value)) {
                throw new Error(
                    `Proxy-Status param "info-code" must be an RFC 8941 integer; received ${String(value)}`,
                );
            }
            return value;
        },
    }),
    createSfParamSchemaEntry<ProxyStatusParams, 'alertId'>({
        key: 'alert-id',
        property: 'alertId',
        parse: (value) => typeof value === 'number' && isSfInteger(value) ? value : undefined,
        format: (value) => {
            if (typeof value !== 'number') {
                throw new Error(`Proxy-Status param "alert-id" must be a number; received type ${typeof value}`);
            }
            if (!isSfInteger(value)) {
                throw new Error(
                    `Proxy-Status param "alert-id" must be an RFC 8941 integer; received ${String(value)}`,
                );
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
        const item = expectSfItem(member);
        if (!item) {
            return null;
        }
        if (!(typeof item.value === 'string' || item.value instanceof SfToken)) {
            return null;
        }

        const proxy = item.value instanceof SfToken ? item.value.value : item.value;

        entries.push({
            proxy,
            params: parseProxyStatusParams(item.params),
        });
    }

    return entries;
}

/**
 * Format Proxy-Status header value from entries.
 * RFC 9209 §2: Proxy-Status Structured Field serialization.
 */
export function formatProxyStatus(entries: ProxyStatusEntry[]): string {
    const list: SfList = new Array(entries.length);
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index]!;
        const params = buildProxyStatusParams(entry.params ?? {});
        const proxyToken = new SfToken(entry.proxy);
        list[index] = params ? { value: proxyToken, params } : { value: proxyToken };
    }

    return serializeSfList(list);
}
