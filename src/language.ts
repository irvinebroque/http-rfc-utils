/**
 * Accept-Language utilities per RFC 9110 + RFC 4647 (basic filtering).
 * RFC 9110 §12.4.2, §12.5.4; RFC 4647 §3.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html
 */

import type { LanguageRange } from './types.js';
import { parseWeightedTokenList } from './header-utils.js';

function languageSpecificity(tag: string): number {
    if (tag === '*') {
        return 0;
    }

    let count = 1;
    for (let i = 0; i < tag.length; i++) {
        if (tag[i] === '-') {
            count++;
        }
    }

    return count;
}

/**
 * Parse an Accept-Language header into ranges.
 */
// RFC 9110 §12.5.4: Accept-Language field-value parsing.
export function parseAcceptLanguage(header: string): LanguageRange[] {
    const ranges = parseWeightedTokenList(header, {
        tokenNormalizer: tag => tag.toLowerCase(),
        sort: 'q-then-specificity',
        specificity: languageSpecificity,
    });

    return ranges.map(({ token, q }) => ({ tag: token, q }));
}

// RFC 4647 §3: Basic filtering.
function basicMatch(range: string, tag: string): boolean {
    if (range === '*') {
        return true;
    }

    if (range === tag) {
        return true;
    }

    if (tag.startsWith(range + '-')) {
        return true;
    }

    return false;
}

/**
 * Negotiate language using RFC 4647 basic filtering.
 */
// RFC 4647 §3, RFC 9110 §12.5.4: Language selection.
export function negotiateLanguage(ranges: LanguageRange[], supported: string[]): string | null {
    if (supported.length === 0) {
        return null;
    }

    if (ranges.length === 0) {
        return supported[0] ?? null;
    }

    const normalizedSupported = supported.map(tag => tag.toLowerCase());

    for (const range of ranges) {
        if (range.q === 0) {
            continue;
        }

        for (let i = 0; i < normalizedSupported.length; i++) {
            const supportedTag = normalizedSupported[i]!;
            if (basicMatch(range.tag, supportedTag)) {
                return supported[i] ?? supportedTag;
            }
        }
    }

    return null;
}
