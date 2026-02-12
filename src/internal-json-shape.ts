/**
 * Internal JSON shape coercion helpers for tolerant parsers.
 *
 * These helpers normalize unknown JSON-ish values into predictable record
 * shapes while preserving null-prototype maps for safer key handling.
 * @internal
 */

import { createObjectMap } from './object-map.js';

/**
 * Return the input as a record when it is object-like, otherwise an empty
 * null-prototype record.
 */
export function toRecordOrEmpty(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object') {
        return value as Record<string, unknown>;
    }
    return createObjectMap<unknown>();
}

/**
 * Return a non-array record view when the input is a plain object-like value.
 */
export function toNonArrayRecord(value: unknown): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

/**
 * Extract string-valued entries from an unknown record.
 * Returns null when no string entries are present.
 */
export function toStringMap(value: unknown): Record<string, string> | null {
    const record = toNonArrayRecord(value);
    if (!record) {
        return null;
    }

    const result = createObjectMap<string>();
    for (const [key, entryValue] of Object.entries(record)) {
        if (typeof entryValue === 'string') {
            result[key] = entryValue;
        }
    }

    return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract string-or-null entries from an unknown record.
 * Returns null when no matching entries are present.
 */
export function toStringOrNullMap(value: unknown): Record<string, string | null> | null {
    const record = toNonArrayRecord(value);
    if (!record) {
        return null;
    }

    const result = createObjectMap<string | null>();
    for (const [key, entryValue] of Object.entries(record)) {
        if (typeof entryValue === 'string' || entryValue === null) {
            result[key] = entryValue;
        }
    }

    return Object.keys(result).length > 0 ? result : null;
}
