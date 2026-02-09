import { createObjectMap } from './object-map.js';

export function toRecordOrEmpty(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object') {
        return value as Record<string, unknown>;
    }
    return createObjectMap<unknown>();
}

export function toNonArrayRecord(value: unknown): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

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
