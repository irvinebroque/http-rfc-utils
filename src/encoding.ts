/**
 * Accept-Encoding utilities per RFC 9110.
 * RFC 9110 §12.4.2, §12.4.3, §12.5.3.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html
 */

import type { EncodingRange } from './types.js';
import { parseWeightedTokenList } from './header-utils.js';

/**
 * Parse an Accept-Encoding header into ranges.
 */
// RFC 9110 §12.5.3: Accept-Encoding field-value parsing.
export function parseAcceptEncoding(header: string): EncodingRange[] {
    const ranges = parseWeightedTokenList(header, {
        tokenNormalizer: encoding => encoding.toLowerCase(),
        sort: 'q-only',
    });

    return ranges.map(({ token, q }) => ({ encoding: token, q }));
}

function buildQMap(ranges: EncodingRange[]): Map<string, number> {
    const qMap = new Map<string, number>();
    for (const range of ranges) {
        if (!qMap.has(range.encoding)) {
            qMap.set(range.encoding, range.q);
        }
    }
    return qMap;
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

    const qMap = buildQMap(ranges);
    const wildcardQ = qMap.get('*');
    let best: string | null = null;
    let bestQ = 0;

    for (const encoding of supported) {
        const normalized = encoding.toLowerCase();
        const explicitQ = qMap.get(normalized);
        const q = explicitQ !== undefined
            ? explicitQ
            : (normalized === 'identity'
                ? (wildcardQ ?? 1.0)
                : (wildcardQ ?? 0));

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
