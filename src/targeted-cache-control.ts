/**
 * Targeted Cache-Control utilities per RFC 9213.
 * RFC 9213 §2, §2.1, §2.2, §3.1.
 * @see https://www.rfc-editor.org/rfc/rfc9213.html#section-2
 */

import type { SfDictionary, TargetedCacheControl, TargetedSelection } from './types.js';
import { parseSfDict, serializeSfDict } from './structured-fields.js';
import {
    getNormalizedHeaderValue,
    isSfItem,
    normalizeOptionalHeaderValue,
    type HeaderLookup,
} from './structured-field-helpers.js';

const NUMERIC_DIRECTIVES = new Set([
    'max-age',
    's-maxage',
    'stale-while-revalidate',
    'stale-if-error',
]);

const BOOLEAN_DIRECTIVES = new Set([
    'public',
    'private',
    'no-cache',
    'no-store',
    'must-revalidate',
    'proxy-revalidate',
    'immutable',
]);

const KNOWN_DIRECTIVES = new Set([...BOOLEAN_DIRECTIVES, ...NUMERIC_DIRECTIVES]);

const DIRECTIVE_ORDER = [
    'public',
    'private',
    'no-cache',
    'no-store',
    'max-age',
    's-maxage',
    'must-revalidate',
    'proxy-revalidate',
    'immutable',
    'stale-while-revalidate',
    'stale-if-error',
] as const;

function isValidNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isInteger(value)
        && Number.isFinite(value)
        && value >= 0;
}

function appendKnownDirective(dict: SfDictionary, key: string, cacheControl: TargetedCacheControl): void {
    switch (key) {
        case 'public':
            if (cacheControl.public) {
                dict.public = { value: true };
            }
            break;
        case 'private':
            if (cacheControl.private) {
                dict.private = { value: true };
            }
            break;
        case 'no-cache':
            if (cacheControl.noCache) {
                dict['no-cache'] = { value: true };
            }
            break;
        case 'no-store':
            if (cacheControl.noStore) {
                dict['no-store'] = { value: true };
            }
            break;
        case 'max-age':
            if (cacheControl.maxAge !== undefined) {
                if (!isValidNonNegativeInteger(cacheControl.maxAge)) {
                    throw new Error('Invalid max-age value; expected non-negative integer');
                }
                dict['max-age'] = { value: cacheControl.maxAge };
            }
            break;
        case 's-maxage':
            if (cacheControl.sMaxAge !== undefined) {
                if (!isValidNonNegativeInteger(cacheControl.sMaxAge)) {
                    throw new Error('Invalid s-maxage value; expected non-negative integer');
                }
                dict['s-maxage'] = { value: cacheControl.sMaxAge };
            }
            break;
        case 'must-revalidate':
            if (cacheControl.mustRevalidate) {
                dict['must-revalidate'] = { value: true };
            }
            break;
        case 'proxy-revalidate':
            if (cacheControl.proxyRevalidate) {
                dict['proxy-revalidate'] = { value: true };
            }
            break;
        case 'immutable':
            if (cacheControl.immutable) {
                dict.immutable = { value: true };
            }
            break;
        case 'stale-while-revalidate':
            if (cacheControl.staleWhileRevalidate !== undefined) {
                if (!isValidNonNegativeInteger(cacheControl.staleWhileRevalidate)) {
                    throw new Error('Invalid stale-while-revalidate value; expected non-negative integer');
                }
                dict['stale-while-revalidate'] = { value: cacheControl.staleWhileRevalidate };
            }
            break;
        case 'stale-if-error':
            if (cacheControl.staleIfError !== undefined) {
                if (!isValidNonNegativeInteger(cacheControl.staleIfError)) {
                    throw new Error('Invalid stale-if-error value; expected non-negative integer');
                }
                dict['stale-if-error'] = { value: cacheControl.staleIfError };
            }
            break;
    }
}

/**
 * Parse a targeted cache-control field value as an SF dictionary.
 */
// RFC 9213 §2.1: targeted cache-control fields are Structured Field Dictionaries.
// RFC 9213 §2.1: directive parameters are ignored unless explicitly defined.
export function parseTargetedCacheControl(header: string): TargetedCacheControl | null {
    const normalized = normalizeOptionalHeaderValue(header);
    if (!normalized) {
        return null;
    }

    const dict = parseSfDict(normalized);
    if (!dict) {
        return null;
    }

    const parsed: TargetedCacheControl = {};
    const extensions: SfDictionary = {};

    for (const [key, member] of Object.entries(dict)) {
        if (!isSfItem(member)) {
            if (!KNOWN_DIRECTIVES.has(key)) {
                extensions[key] = member;
            }
            continue;
        }

        if (BOOLEAN_DIRECTIVES.has(key)) {
            if (member.value === true) {
                switch (key) {
                    case 'public':
                        parsed.public = true;
                        break;
                    case 'private':
                        parsed.private = true;
                        break;
                    case 'no-cache':
                        parsed.noCache = true;
                        break;
                    case 'no-store':
                        parsed.noStore = true;
                        break;
                    case 'must-revalidate':
                        parsed.mustRevalidate = true;
                        break;
                    case 'proxy-revalidate':
                        parsed.proxyRevalidate = true;
                        break;
                    case 'immutable':
                        parsed.immutable = true;
                        break;
                }
            }
            continue;
        }

        if (NUMERIC_DIRECTIVES.has(key)) {
            if (isValidNonNegativeInteger(member.value)) {
                switch (key) {
                    case 'max-age':
                        parsed.maxAge = member.value;
                        break;
                    case 's-maxage':
                        parsed.sMaxAge = member.value;
                        break;
                    case 'stale-while-revalidate':
                        parsed.staleWhileRevalidate = member.value;
                        break;
                    case 'stale-if-error':
                        parsed.staleIfError = member.value;
                        break;
                }
            }
            continue;
        }

        extensions[key] = member;
    }

    if (Object.keys(extensions).length > 0) {
        parsed.extensions = extensions;
    }

    if (Object.keys(parsed).length === 0) {
        return null;
    }

    return parsed;
}

/**
 * Format a targeted cache-control field value as an SF dictionary.
 */
// RFC 9213 §2.1: serialize targeted cache controls as Structured Field Dictionary members.
export function formatTargetedCacheControl(cacheControl: TargetedCacheControl): string {
    const dict: SfDictionary = {};

    for (const key of DIRECTIVE_ORDER) {
        appendKnownDirective(dict, key, cacheControl);
    }

    if (cacheControl.extensions) {
        for (const [key, value] of Object.entries(cacheControl.extensions)) {
            if (!KNOWN_DIRECTIVES.has(key)) {
                dict[key] = value;
            }
        }
    }

    return serializeSfDict(dict);
}

/**
 * Parse a CDN-Cache-Control field value.
 */
// RFC 9213 §3.1: CDN-Cache-Control uses targeted cache-control field syntax.
export function parseCdnCacheControl(header: string): TargetedCacheControl | null {
    return parseTargetedCacheControl(header);
}

/**
 * Format a CDN-Cache-Control field value.
 */
// RFC 9213 §3.1: CDN-Cache-Control uses targeted cache-control field syntax.
export function formatCdnCacheControl(cacheControl: TargetedCacheControl): string {
    return formatTargetedCacheControl(cacheControl);
}

/**
 * Select effective targeted cache-control from a target-list ordered set of fields.
 */
// RFC 9213 §2.2: first valid non-empty targeted field in target-list order wins; else fallback.
export function selectTargetedCacheControl(
    targetList: readonly string[],
    fields: HeaderLookup,
    fallbackCacheControl?: string | null,
): TargetedSelection {
    for (const fieldName of targetList) {
        const value = getNormalizedHeaderValue(fields, fieldName);
        if (!value) {
            continue;
        }

        const parsed = parseTargetedCacheControl(value);
        if (!parsed) {
            continue;
        }

        return {
            source: 'targeted',
            fieldName,
            targeted: parsed,
            fallback: null,
        };
    }

    const resolvedFallback = normalizeOptionalHeaderValue(
        fallbackCacheControl ?? getNormalizedHeaderValue(fields, 'cache-control')
    );

    if (resolvedFallback) {
        return {
            source: 'fallback',
            fieldName: null,
            targeted: null,
            fallback: resolvedFallback,
        };
    }

    return {
        source: 'none',
        fieldName: null,
        targeted: null,
        fallback: null,
    };
}
