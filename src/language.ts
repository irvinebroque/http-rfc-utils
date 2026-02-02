/**
 * Accept-Language utilities per RFC 9110 + RFC 4647 (basic filtering).
 * RFC 9110 §12.4.2, §12.5.4; RFC 4647 §3.
 */

import type { LanguageRange } from './types.js';
import { isEmptyHeader, splitListValue, parseQValue } from './header-utils.js';

/**
 * Parse an Accept-Language header into ranges.
 */
// RFC 9110 §12.5.4: Accept-Language field-value parsing.
export function parseAcceptLanguage(header: string): LanguageRange[] {
    if (isEmptyHeader(header)) {
        return [];
    }

    const ranges: LanguageRange[] = [];
    const parts = splitListValue(header);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const segments = part.split(';').map(segment => segment.trim());
        const tag = segments[0]?.toLowerCase();
        if (!tag) continue;

        let q = 1.0;
        let invalidQ = false;
        for (let j = 1; j < segments.length; j++) {
            const segment = segments[j]!;
            const eqIndex = segment.indexOf('=');
            if (eqIndex === -1) continue;
            const key = segment.slice(0, eqIndex).trim().toLowerCase();
            if (key !== 'q') continue;
            const parsed = parseQValue(segment.slice(eqIndex + 1).trim());
            if (parsed === null) {
                invalidQ = true;
                break;
            }
            q = parsed;
        }

        if (invalidQ) {
            continue;
        }

        ranges.push({ tag, q });
    }

    ranges.sort((a, b) => {
        if (a.q !== b.q) {
            return b.q - a.q;
        }

        const specA = a.tag === '*' ? 0 : a.tag.split('-').length;
        const specB = b.tag === '*' ? 0 : b.tag.split('-').length;
        if (specA !== specB) {
            return specB - specA;
        }

        return 0;
    });

    return ranges;
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
