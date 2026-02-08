/**
 * Range request utilities per RFC 9110 (13.2.1, 14.2).
 */

import type { ByteRange, RangeSpec, ContentRange, RangeDecision } from './types.js';
import { parseETag, compareETags } from './etag.js';
import { parseHTTPDate } from './datetime.js';

const RANGE_PREFIX = /^bytes=/i;
const DIGITS_ONLY = /^\d+$/;

function isStrictDigits(value: string): boolean {
    return DIGITS_ONLY.test(value);
}

/**
 * Parse a Range header into raw byte ranges.
 *
 * NOTE: Open-ended ranges use end = Infinity.
 * Suffix ranges use start = -N and end = -1.
 */
export function parseRange(header: string): RangeSpec | null {
    if (!header || !header.trim()) {
        return null;
    }

    const trimmed = header.trim();
    if (!RANGE_PREFIX.test(trimmed)) {
        return null;
    }

    const value = trimmed.replace(RANGE_PREFIX, '');
    if (!value) {
        return null;
    }

    const rawRanges: ByteRange[] = [];
    const parts = value.split(',');

    for (const part of parts) {
        const rangePart = part.trim();
        if (!rangePart) {
            return null;
        }

        const dashIndex = rangePart.indexOf('-');
        if (dashIndex === -1) {
            return null;
        }

        const startStr = rangePart.slice(0, dashIndex).trim();
        const endStr = rangePart.slice(dashIndex + 1).trim();

        if (startStr === '') {
            if (!isStrictDigits(endStr)) {
                return null;
            }
            const suffixLength = parseInt(endStr, 10);
            if (isNaN(suffixLength) || suffixLength <= 0) {
                return null;
            }
            rawRanges.push({ start: -suffixLength, end: -1 });
            continue;
        }

        if (!isStrictDigits(startStr)) {
            return null;
        }
        const start = parseInt(startStr, 10);
        if (isNaN(start) || start < 0) {
            return null;
        }

        if (endStr === '') {
            rawRanges.push({ start, end: Number.POSITIVE_INFINITY });
            continue;
        }

        if (!isStrictDigits(endStr)) {
            return null;
        }
        const end = parseInt(endStr, 10);
        if (isNaN(end) || end < start) {
            return null;
        }

        rawRanges.push({ start, end });
    }

    if (rawRanges.length === 0) {
        return null;
    }

    return {
        unit: 'bytes',
        ranges: rawRanges,
    };
}

/**
 * Parse a Content-Range header.
 */
export function parseContentRange(header: string): ContentRange | null {
    if (!header || !header.trim()) {
        return null;
    }

    const trimmed = header.trim();
    if (!trimmed.toLowerCase().startsWith('bytes')) {
        return null;
    }

    const parts = trimmed.split(' ');
    if (parts.length < 2) {
        return null;
    }

    const rangeAndSize = parts.slice(1).join(' ').trim();
    const [rangePart, sizePart] = rangeAndSize.split('/');

    if (!rangePart || sizePart === undefined) {
        return null;
    }

    const sizeToken = sizePart.trim();
    if (sizeToken !== '*' && !isStrictDigits(sizeToken)) {
        return null;
    }

    const size = sizeToken === '*' ? '*' : parseInt(sizeToken, 10);
    if (size !== '*' && (isNaN(size) || size < 0)) {
        return null;
    }

    if (rangePart.trim() === '*') {
        return {
            unit: 'bytes',
            size,
            unsatisfied: true,
        };
    }

    const dashIndex = rangePart.indexOf('-');
    if (dashIndex === -1) {
        return null;
    }

    const startToken = rangePart.slice(0, dashIndex).trim();
    const endToken = rangePart.slice(dashIndex + 1).trim();

    if (!isStrictDigits(startToken) || !isStrictDigits(endToken)) {
        return null;
    }

    const start = parseInt(startToken, 10);
    const end = parseInt(endToken, 10);

    if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
        return null;
    }

    return {
        unit: 'bytes',
        range: { start, end },
        size,
    };
}

/**
 * Format a Content-Range header value.
 */
export function formatContentRange(range: ByteRange, size: number | '*'): string {
    const total = size === '*' ? '*' : String(size);
    return `bytes ${range.start}-${range.end}/${total}`;
}

/**
 * Build Accept-Ranges header value.
 */
export function acceptRanges(value: 'bytes' | 'none' = 'bytes'): string {
    return value;
}

function normalizeRanges(rawRanges: ByteRange[], size: number): ByteRange[] {
    const normalized: ByteRange[] = [];

    for (const range of rawRanges) {
        let start = range.start;
        let end = range.end;

        if (start < 0 && end === -1) {
            const suffixLength = Math.abs(start);
            if (suffixLength === 0) {
                continue;
            }
            start = Math.max(0, size - suffixLength);
            end = size - 1;
        } else if (end === Number.POSITIVE_INFINITY) {
            end = size - 1;
        }

        if (start >= size || start < 0) {
            continue;
        }

        if (end < start) {
            continue;
        }

        if (end >= size) {
            end = size - 1;
        }

        normalized.push({ start, end });
    }

    if (normalized.length === 0) {
        return [];
    }

    normalized.sort((a, b) => a.start - b.start);

    const merged: ByteRange[] = [normalized[0]!];
    for (let i = 1; i < normalized.length; i++) {
        const current = normalized[i]!;
        const last = merged[merged.length - 1]!;
        if (current.start <= last.end + 1) {
            last.end = Math.max(last.end, current.end);
        } else {
            merged.push({ ...current });
        }
    }

    return merged;
}

function ifRangeMatches(ifRange: string, currentETag?: string, lastModified?: Date): boolean {
    if (!ifRange.trim()) {
        return false;
    }

    const etag = parseETag(ifRange);
    if (etag && currentETag) {
        const current = parseETag(currentETag);
        if (!current) {
            return false;
        }
        return compareETags(etag, current, true);
    }

    const date = parseHTTPDate(ifRange);
    if (date && lastModified) {
        return lastModified.getTime() <= date.getTime();
    }

    return false;
}

/**
 * Evaluate a Range request and determine partial content handling.
 */
export function evaluateRange(
    request: Request,
    size: number,
    etag?: string,
    lastModified?: Date
): RangeDecision {
    const method = request.method.toUpperCase();
    const rangeHeader = request.headers.get('Range');
    if (!rangeHeader) {
        return { type: 'none' };
    }

    if (method !== 'GET' && method !== 'HEAD') {
        return { type: 'ignored' };
    }

    const parsed = parseRange(rangeHeader);
    if (!parsed) {
        return { type: 'ignored' };
    }

    const ifRange = request.headers.get('If-Range');
    if (ifRange) {
        const matches = ifRangeMatches(ifRange, etag, lastModified);
        if (!matches) {
            return { type: 'ignored' };
        }
    }

    if (size <= 0) {
        return {
            type: 'unsatisfiable',
            headers: {
                'Content-Range': 'bytes */0',
                'Accept-Ranges': acceptRanges(),
            },
        };
    }

    const ranges = normalizeRanges(parsed.ranges, size);
    if (ranges.length === 0) {
        return {
            type: 'unsatisfiable',
            headers: {
                'Content-Range': `bytes */${size}`,
                'Accept-Ranges': acceptRanges(),
            },
        };
    }

    const headers: Record<string, string> = {
        'Accept-Ranges': acceptRanges(),
    };

    if (ranges.length === 1) {
        headers['Content-Range'] = formatContentRange(ranges[0]!, size);
    }

    return {
        type: 'partial',
        ranges,
        headers,
    };
}
