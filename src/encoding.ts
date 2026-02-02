/**
 * Accept-Encoding utilities per RFC 9110.
 * RFC 9110 §12.4.2, §12.4.3, §12.5.3.
 */

import type { EncodingRange } from './types.js';
import { isEmptyHeader, splitListValue, parseQValue } from './header-utils.js';

/**
 * Parse an Accept-Encoding header into ranges.
 */
// RFC 9110 §12.5.3: Accept-Encoding field-value parsing.
export function parseAcceptEncoding(header: string): EncodingRange[] {
    if (isEmptyHeader(header)) {
        return [];
    }

    const ranges: EncodingRange[] = [];
    const parts = splitListValue(header);

    for (const part of parts) {
        const segments = part.split(';').map(segment => segment.trim());
        const encoding = segments[0]?.toLowerCase();
        if (!encoding) continue;

        let q = 1.0;
        let invalidQ = false;
        for (let i = 1; i < segments.length; i++) {
            const segment = segments[i]!;
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

        ranges.push({ encoding, q });
    }

    ranges.sort((a, b) => b.q - a.q);
    return ranges;
}

function getQForEncoding(ranges: EncodingRange[], encoding: string): number | null {
    for (const range of ranges) {
        if (range.encoding === encoding) {
            return range.q;
        }
    }
    return null;
}

/**
 * Negotiate encoding based on Accept-Encoding.
 */
// RFC 9110 §12.4.2, §12.4.3, §12.5.3: Content-coding selection.
export function negotiateEncoding(ranges: EncodingRange[], supported: string[]): string | null {
    if (supported.length === 0) {
        return null;
    }

    if (ranges.length === 0) {
        return supported[0] ?? null;
    }

    const wildcard = ranges.find(range => range.encoding === '*');
    let best: string | null = null;
    let bestQ = 0;

    for (const encoding of supported) {
        const normalized = encoding.toLowerCase();
        const explicitQ = getQForEncoding(ranges, normalized);
        const q = explicitQ !== null
            ? explicitQ
            : (normalized === 'identity'
                ? (wildcard ? wildcard.q : 1.0)
                : (wildcard ? wildcard.q : 0));

        if (q > bestQ) {
            best = encoding;
            bestQ = q;
        }
    }

    if (bestQ === 0) {
        return null;
    }

    return best;
}
