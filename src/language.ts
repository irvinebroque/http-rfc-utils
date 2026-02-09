/**
 * Accept-Language utilities per RFC 9110 + RFC 4647 (basic filtering).
 * RFC 9110 §12.4.2, §12.5.4; RFC 4647 §3.
 */

import type { LanguageRange } from './types.js';
import { isEmptyHeader, parseQSegments, splitListValue } from './header-utils.js';

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
    if (isEmptyHeader(header)) {
        return [];
    }

    const ranges: Array<LanguageRange & { specificity: number }> = [];
    const parts = splitListValue(header);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const segments = part.split(';').map(segment => segment.trim());
        const tag = segments[0]?.toLowerCase();
        if (!tag) continue;

        const qParts = parseQSegments(segments, 1);
        if (qParts.invalidQ) {
            continue;
        }

        ranges.push({ tag, q: qParts.q, specificity: languageSpecificity(tag) });
    }

    ranges.sort((a, b) => {
        if (a.q !== b.q) {
            return b.q - a.q;
        }

        if (a.specificity !== b.specificity) {
            return b.specificity - a.specificity;
        }

        return 0;
    });

    return ranges.map(({ tag, q }) => ({ tag, q }));
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
