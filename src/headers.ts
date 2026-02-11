/**
 * Misc header utilities per RFC 9110, RFC 8594.
 * RFC 9110 §10.2.3, §12.5.5.
 * RFC 8594 §3 (Sunset header).
 * @see https://www.rfc-editor.org/rfc/rfc8594.html#section-3
 */

import type { RetryAfterValue } from './types.js';
import { parseHTTPDate, formatHTTPDate } from './datetime.js';
import { TOKEN_CHARS } from './header-utils.js';

function parseVaryFieldNames(input: string | string[], context: string): string[] {
    const rawValues = Array.isArray(input) ? input : input.split(',');
    const values: string[] = [];

    for (let i = 0; i < rawValues.length; i++) {
        const rawValue = rawValues[i];
        const value = rawValue?.trim() ?? '';
        if (!value) {
            throw new Error(`Invalid Vary field-name at ${context} index ${i}: empty value`);
        }
        if (value !== '*' && !TOKEN_CHARS.test(value)) {
            throw new Error(`Invalid Vary field-name at ${context} index ${i}: ${rawValue}`);
        }
        values.push(value);
    }

    if (values.includes('*') && values.length > 1) {
        throw new Error(`Invalid Vary value at ${context}: '*' must be the only entry`);
    }

    return values;
}

/**
 * Parse Retry-After header value.
 */
// RFC 9110 §10.2.3: Retry-After parsing.
export function parseRetryAfter(value: string): RetryAfterValue | null {
    if (!value || !value.trim()) {
        return null;
    }

    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
        const seconds = parseInt(trimmed, 10);
        return { delaySeconds: Math.max(0, seconds) };
    }

    const date = parseHTTPDate(trimmed);
    if (date) {
        return { date };
    }

    return null;
}

/**
 * Format Retry-After header value.
 */
// RFC 9110 §10.2.3: Retry-After formatting.
export function formatRetryAfter(value: Date | number): string {
    if (typeof value === 'number') {
        const seconds = Math.max(0, Math.floor(value));
        return String(seconds);
    }

    return formatHTTPDate(value);
}

/**
 * Merge Vary header values, preserving order and handling '*'.
 */
// RFC 9110 §12.5.5: Vary field-value combination.
export function mergeVary(existing: string | null, add: string | string[]): string {
    const existingValues = existing === null ? [] : parseVaryFieldNames(existing, 'existing');
    const addValues = parseVaryFieldNames(add, 'add');

    if (existingValues.includes('*') || addValues.includes('*')) {
        return '*';
    }

    const seen = new Set<string>();
    const combined: string[] = [];

    for (const value of existingValues) {
        const key = value.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            combined.push(value);
        }
    }

    for (const value of addValues) {
        const key = value.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            combined.push(value);
        }
    }

    return combined.join(', ');
}

/**
 * Parse Sunset header value.
 *
 * The Sunset header indicates when a resource is expected to become
 * unresponsive. Returns null for invalid or missing values.
 *
 * Per RFC 8594 Section 3, timestamps in the past mean the resource
 * is expected to become unavailable at any time.
 *
 * @example
 * ```ts
 * const sunset = parseSunset('Wed, 11 Nov 2026 11:11:11 GMT');
 * if (sunset && sunset < new Date()) {
 *     console.warn('Resource sunset has passed');
 * }
 * ```
 */
// RFC 8594 §3: Sunset = HTTP-date.
export function parseSunset(value: string): Date | null {
    if (!value || !value.trim()) {
        return null;
    }

    return parseHTTPDate(value.trim());
}

/**
 * Format a Date as a Sunset header value.
 *
 * Uses IMF-fixdate format per RFC 9110 Section 5.6.7.
 *
 * @example
 * ```ts
 * const header = formatSunset(new Date('2026-12-31T23:59:59Z'));
 * // "Thu, 31 Dec 2026 23:59:59 GMT"
 * ```
 */
// RFC 8594 §3: Sunset header uses HTTP-date format.
export function formatSunset(date: Date): string {
    return formatHTTPDate(date);
}

/**
 * Check if a sunset date is imminent (approaching or past).
 *
 * Per RFC 8594 Section 3, timestamps in the past mean the resource
 * is expected to become unavailable at any time. This helper checks
 * if the sunset is within a given threshold of the current time.
 *
 * @param sunset - Parsed sunset date (null if no Sunset header)
 * @param thresholdMs - Threshold in milliseconds (default: 0, meaning only past dates)
 * @returns true if sunset is null-safe past or within threshold
 *
 * @example
 * ```ts
 * const sunset = parseSunset(response.headers.get('Sunset') ?? '');
 * // Check if sunset is within 7 days
 * if (isSunsetImminent(sunset, 7 * 24 * 60 * 60 * 1000)) {
 *     console.warn('Resource will sunset within 7 days');
 * }
 * ```
 */
// RFC 8594 §3: Past timestamps mean "now"; helper for threshold checks.
export function isSunsetImminent(sunset: Date | null, thresholdMs: number = 0): boolean {
    if (!sunset) {
        return false;
    }

    return sunset.getTime() <= Date.now() + thresholdMs;
}
