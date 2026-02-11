/**
 * JSON Canonicalization Scheme (JCS) utilities.
 * RFC 8785 Sections 3.1 and 3.2.1-3.2.4.
 * @see https://www.rfc-editor.org/rfc/rfc8785.html
 */

import type { CanonicalJsonObject, CanonicalJsonValue } from './types.js';
import { encodeUtf8, hasLoneSurrogate } from './internal-unicode.js';

export type {
    CanonicalJsonPrimitive,
    CanonicalJsonArray,
    CanonicalJsonObject,
    CanonicalJsonValue,
} from './types.js';

/**
 * Format a JSON value into RFC 8785 canonical JSON text.
 * Throws Error when semantic constraints are violated.
 */
export function formatCanonicalJson(value: CanonicalJsonValue): string {
    validateCanonicalJson(value);
    return serializeCanonicalJson(value);
}

/**
 * Format a JSON value into RFC 8785 canonical UTF-8 bytes.
 * Throws Error when semantic constraints are violated.
 */
export function formatCanonicalJsonUtf8(value: CanonicalJsonValue): Uint8Array {
    return encodeUtf8(formatCanonicalJson(value));
}

/**
 * Validate semantic requirements for RFC 8785 canonical JSON input.
 * Throws Error when the value is not compliant.
 */
export function validateCanonicalJson(value: CanonicalJsonValue): void {
    const validationError = getValidationError(value, '$');
    if (validationError !== null) {
        throw new Error(validationError);
    }
}

/**
 * Parse JSON text only if it is already in canonical RFC 8785 form.
 * Returns null for invalid JSON or non-canonical JSON text.
 */
export function parseCanonicalJson(text: string): CanonicalJsonValue | null {
    try {
        const parsed = JSON.parse(text) as CanonicalJsonValue;
        const validationError = getValidationError(parsed, '$');
        if (validationError !== null) {
            return null;
        }
        if (text !== serializeCanonicalJson(parsed)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function serializeCanonicalJson(value: CanonicalJsonValue): string {
    if (value === null) {
        return 'null';
    }

    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        const items: string[] = [];
        for (const item of value) {
            items.push(serializeCanonicalJson(item));
        }
        return `[${items.join(',')}]`;
    }

    const objectValue = value as CanonicalJsonObject;
    const sortedKeys = Object.keys(objectValue).sort(compareUtf16CodeUnitOrder);
    const members: string[] = [];
    for (const key of sortedKeys) {
        members.push(`${JSON.stringify(key)}:${serializeCanonicalJson(objectValue[key])}`);
    }
    return `{${members.join(',')}}`;
}

function compareUtf16CodeUnitOrder(left: string, right: string): number {
    if (left < right) {
        return -1;
    }
    if (left > right) {
        return 1;
    }
    return 0;
}

function getValidationError(value: unknown, path: string): string | null {
    if (value === null) {
        return null;
    }

    switch (typeof value) {
        case 'boolean':
            return null;
        case 'number':
            if (!Number.isFinite(value)) {
                return `${path} must contain only finite JSON numbers`;
            }
            return null;
        case 'string':
            if (hasLoneSurrogate(value)) {
                return `${path} contains a lone surrogate code unit`;
            }
            return null;
        case 'object':
            if (Array.isArray(value)) {
                for (let index = 0; index < value.length; index++) {
                    const itemError = getValidationError(value[index], `${path}[${index}]`);
                    if (itemError !== null) {
                        return itemError;
                    }
                }
                return null;
            }

            if (!isCanonicalJsonObject(value)) {
                return `${path} must be a plain JSON object`;
            }

            for (const [key, entryValue] of Object.entries(value)) {
                if (hasLoneSurrogate(key)) {
                    return `${path} has a property name with a lone surrogate code unit`;
                }
                const nextPath = `${path}.${JSON.stringify(key)}`;
                const entryError = getValidationError(entryValue, nextPath);
                if (entryError !== null) {
                    return entryError;
                }
            }
            return null;
        default:
            return `${path} must be a valid JSON value`;
    }
}

function isCanonicalJsonObject(value: unknown): value is CanonicalJsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
