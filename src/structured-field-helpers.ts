/**
 * Shared Structured Field utility helpers.
 * RFC 8941 dictionary member shape checks and header-value normalization.
 * @see https://www.rfc-editor.org/rfc/rfc8941.html
 */

import { SF_KEY_TEXT_RE, SF_TOKEN_TEXT_RE } from './structured-fields.js';
import type { SfDictionary, SfItem, SfList } from './types.js';
import { getHeaderValue, type HeaderLikeRecord } from './header-utils.js';

export type HeaderLookup = Headers | HeaderLikeRecord;

export function isSfItem(member: SfDictionary[string]): member is SfItem {
    return !('items' in member);
}

export function isSfTokenText(value: string): boolean {
    return SF_TOKEN_TEXT_RE.test(value);
}

export function isSfKeyText(value: string): boolean {
    return SF_KEY_TEXT_RE.test(value);
}

export function expectSfItem(member: SfList[number]): SfItem | null {
    return 'items' in member ? null : member;
}

export function hasNoSfParams(item: SfItem): boolean {
    if (!item.params) {
        return true;
    }

    for (const _key in item.params) {
        return false;
    }

    return true;
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
