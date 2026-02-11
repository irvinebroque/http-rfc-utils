/**
 * Targeted Cache-Control utilities per RFC 9213.
 * RFC 9213 §2, §2.1, §2.2, §3.1.
 * @see https://www.rfc-editor.org/rfc/rfc9213.html#section-2
 */

import type { SfDictionary, TargetedCacheControl, TargetedSelection } from './types.js';
import {
    appendTargetedCacheDirectives,
    isKnownTargetedCacheDirective,
    parseTargetedCacheDirectives,
} from './internal-cache-control-schema.js';
import { parseSfDict, serializeSfDict } from './structured-fields.js';
import {
    getNormalizedHeaderValue,
    normalizeOptionalHeaderValue,
    type HeaderLookup,
} from './structured-field-helpers.js';

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

    const parsed = parseTargetedCacheDirectives(dict);

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
    appendTargetedCacheDirectives(dict, cacheControl);

    if (cacheControl.extensions) {
        for (const [key, value] of Object.entries(cacheControl.extensions)) {
            if (!isKnownTargetedCacheDirective(key)) {
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
