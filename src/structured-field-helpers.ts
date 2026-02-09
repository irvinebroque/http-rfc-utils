/**
 * Shared Structured Field utility helpers.
 * RFC 8941 dictionary member shape checks and header-value normalization.
 */

import type { SfDictionary, SfItem } from './types.js';
import { getHeaderValue, type HeaderLikeRecord } from './header-utils.js';

export type HeaderLookup = Headers | HeaderLikeRecord;

export function isSfItem(member: SfDictionary[string]): member is SfItem {
    return !('items' in member);
}

export function normalizeOptionalHeaderValue(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function getNormalizedHeaderValue(fields: HeaderLookup, fieldName: string): string | null {
    return normalizeOptionalHeaderValue(getHeaderValue(fields, fieldName));
}
