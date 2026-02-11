/**
 * Additional HTTP status code helpers per RFC 6585.
 * RFC 6585 §3, §4, §5, §6.
 * @see https://www.rfc-editor.org/rfc/rfc6585.html
 */

import { formatRetryAfter } from './headers.js';
import type { Rfc6585HeadersOptions, Rfc6585StatusCode, Rfc6585StatusInfo } from './types.js';

const RFC_6585_STATUS_CODES = [428, 429, 431, 511] as const;
const RFC_6585_STATUS_CODE_SET = new Set<number>(RFC_6585_STATUS_CODES);

const RFC_6585_STATUS_INFO: Record<Rfc6585StatusCode, Rfc6585StatusInfo> = {
    428: {
        code: 428,
        reasonPhrase: 'Precondition Required',
        section: '3',
        cacheControl: 'no-store',
    },
    429: {
        code: 429,
        reasonPhrase: 'Too Many Requests',
        section: '4',
        cacheControl: 'no-store',
    },
    431: {
        code: 431,
        reasonPhrase: 'Request Header Fields Too Large',
        section: '5',
        cacheControl: 'no-store',
    },
    511: {
        code: 511,
        reasonPhrase: 'Network Authentication Required',
        section: '6',
        cacheControl: 'no-store',
    },
};

function parseStatusNumber(value: number | string): number | null {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
            return null;
        }

        return value;
    }

    if (!/^\d{3}$/.test(value)) {
        return null;
    }

    return Number.parseInt(value, 10);
}

function isRfc6585StatusCode(value: number): value is Rfc6585StatusCode {
    return RFC_6585_STATUS_CODE_SET.has(value);
}

/**
 * Parse an RFC 6585 status code from a number or numeric string.
 */
export function parseRfc6585StatusCode(value: number | string): Rfc6585StatusCode | null {
    const parsedNumber = parseStatusNumber(value);
    if (parsedNumber === null) {
        return null;
    }

    if (isRfc6585StatusCode(parsedNumber)) {
        return parsedNumber;
    }

    return null;
}

/**
 * Validate an RFC 6585 status code.
 */
export function validateRfc6585StatusCode(value: number | string): Rfc6585StatusCode {
    const code = parseRfc6585StatusCode(value);
    if (code === null) {
        throw new Error(`Invalid RFC 6585 status code: ${String(value)}`);
    }

    return code;
}

/**
 * Format an RFC 6585 status code as a header/status-line token.
 */
export function formatRfc6585StatusCode(value: number | string): string {
    return String(validateRfc6585StatusCode(value));
}

/**
 * Return RFC 6585 metadata for a supported status code.
 */
export function getRfc6585StatusInfo(value: number | string): Rfc6585StatusInfo {
    const code = validateRfc6585StatusCode(value);
    return RFC_6585_STATUS_INFO[code];
}

/**
 * Format deterministic response headers for RFC 6585 status codes.
 */
// RFC 6585 §3-§6: responses with 428/429/431/511 MUST NOT be stored by caches.
export function formatRfc6585Headers(
    statusCode: number | string,
    options: Rfc6585HeadersOptions = {},
): Record<string, string> {
    const code = validateRfc6585StatusCode(statusCode);
    const headers: Record<string, string> = {
        'Cache-Control': 'no-store',
    };

    if (options.retryAfter !== undefined) {
        if (code !== 429) {
            throw new Error('Retry-After is only valid for status 429 Too Many Requests');
        }

        headers['Retry-After'] = formatRetryAfter(options.retryAfter);
    }

    return headers;
}
