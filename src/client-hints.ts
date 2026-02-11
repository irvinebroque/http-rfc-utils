/**
 * Client Hints utilities per RFC 8942.
 * RFC 8942 §2.2, §3.1, §3.2, §4.2.
 * @see https://www.rfc-editor.org/rfc/rfc8942.html#section-3.1
 */

import type { ClientHintList } from './types.js';
import { SfToken } from './types.js';
import { mergeVary } from './headers.js';
import { expectSfItem, hasNoSfParams, isSfKeyText } from './structured-field-helpers.js';
import { parseSfList, serializeSfList } from './structured-fields.js';

/**
 * Parse Accept-CH header value into a list of client hints.
 */
// RFC 8942 §3.1: Accept-CH is an sf-list of sf-token values.
export function parseAcceptCH(value: string | string[]): ClientHintList | null {
    const values = Array.isArray(value) ? value : [value];
    const hints: string[] = [];

    for (const header of values) {
        if (!header || !header.trim()) {
            return null;
        }

        const list = parseSfList(header);
        if (!list) {
            return null;
        }

        for (const member of list) {
            const item = expectSfItem(member);
            if (!item) {
                return null;
            }
            if (!hasNoSfParams(item)) {
                return null;
            }
            if (!(item.value instanceof SfToken)) {
                return null;
            }
            if (!isSfKeyText(item.value.value)) {
                return null;
            }
            hints.push(item.value.value.toLowerCase());
        }
    }

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const hint of hints) {
        if (!seen.has(hint)) {
            seen.add(hint);
            unique.push(hint);
        }
    }

    return unique;
}

/**
 * Format Accept-CH header value from a list of client hints.
 */
// RFC 8942 §3.1, §4.2: Accept-CH list serialization and token validation.
export function formatAcceptCH(hints: ClientHintList): string {
    const list = hints.map((hint) => {
        const token = hint.toLowerCase();
        if (!isSfKeyText(token)) {
            throw new Error('Invalid client hint token');
        }
        return { value: new SfToken(token) };
    });

    return serializeSfList(list);
}

/**
 * Filter client hints to supported values.
 */
// RFC 8942 §2.2: servers ignore hints they do not understand.
export function filterClientHints(hints: ClientHintList, supported: ClientHintList): ClientHintList {
    const supportedSet = new Set(supported.map((hint: string) => hint.toLowerCase()));
    return hints
        .map((hint: string) => hint.toLowerCase())
        .filter((hint: string) => supportedSet.has(hint));
}

/**
 * Merge client hints into Vary header value.
 */
// RFC 8942 §2.2, §3.2: add negotiated hints to Vary.
export function mergeClientHintsVary(existing: string | null, hints: string[] | string): string {
    return mergeVary(existing, hints);
}
