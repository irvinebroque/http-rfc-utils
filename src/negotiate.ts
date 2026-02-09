/**
 * Content negotiation utilities per RFC 7231.
 * RFC 7231 §5.3.1, §5.3.2.
 */

import type { AcceptEntry, MediaType } from './types.js';
import { isEmptyHeader, splitQuotedValue, unquote, parseQValue, TOKEN_CHARS } from './header-utils.js';

/**
 * Media type constants mapping format names to MIME types.
 */
export const MEDIA_TYPES: Record<MediaType, string> = {
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    text: 'text/plain',
    xml: 'application/xml',
};

/**
 * Reverse mapping from MIME type to format name.
 */
export const MIME_TO_FORMAT: Record<string, MediaType> = Object.fromEntries(
    Object.entries(MEDIA_TYPES).map(([format, mime]) => [mime, format as MediaType])
) as Record<string, MediaType>;

/**
 * Parse an Accept header into a list of entries sorted by preference.
 *
 * RFC 7231 Section 5.3.2 defines Accept header format.
 *
 * @param header - The Accept header value
 * @returns Sorted array of AcceptEntry (highest preference first)
 *
 * Sorting rules:
 * 1. Higher q value first
 * 2. More specific type beats wildcard (text/html > text/star > star/star)
 * 3. More parameters beats fewer
 *
 * Invalid q-values are rejected and the entry is skipped.
 *
 * @example
 * parseAccept("text/html, application/json;q=0.9, text/star;q=0.8")
 * // Returns: [text/html q=1], [application/json q=0.9], [text/star q=0.8]
 */
// RFC 7231 §5.3.2: Accept header parsing and sorting.
export function parseAccept(header: string): AcceptEntry[] {
    if (isEmptyHeader(header)) {
        return [];
    }

    const entries: AcceptEntry[] = [];
    const parts = splitQuotedValue(header, ',');

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const entry = parseMediaRange(trimmed);
        if (entry) {
            entries.push(entry);
        }
    }

    // Sort by preference
    entries.sort((a, b) => {
        // 1. Higher q value first
        if (a.q !== b.q) {
            return b.q - a.q;
        }

        // 2. More specific type beats wildcard
        const specA = getSpecificity(a);
        const specB = getSpecificity(b);
        if (specA !== specB) {
            return specB - specA;
        }

        // 3. More parameters beats fewer
        return b.params.size - a.params.size;
    });

    return entries;
}

/**
 * Parse a single media range with optional parameters.
 */
function parseMediaRange(range: string): AcceptEntry | null {
    const parts = splitQuotedValue(range, ';').map(p => p.trim());
    const mediaType = parts[0];

    const parsed = parseTypeAndSubtype(mediaType);
    if (!parsed) {
        return null;
    }

    const { type, subtype } = parsed;

    let q = 1.0;
    const params = new Map<string, string>();
    let seenQ = false;

    for (let i = 1; i < parts.length; i++) {
        const param = parts[i];
        if (!param) continue;
        const eqIndex = param.indexOf('=');
        if (eqIndex === -1) continue;

        const key = param.slice(0, eqIndex).trim().toLowerCase();
        const value = unquote(param.slice(eqIndex + 1).trim());

        if (key === 'q') {
            const parsed = parseQValue(value);
            if (parsed === null) {
                return null;
            }
            q = parsed;
            seenQ = true;
        } else {
            if (!seenQ) {
                params.set(key, value);
            }
        }
    }

    return {
        type: type.toLowerCase(),
        subtype: subtype.toLowerCase(),
        q,
        params,
    };
}

/**
 * Get specificity score for sorting.
 * - exact match with params: 4
 * - exact match no params: 3
 * - type wildcard (text/star): 2
 * - full wildcard (star/star): 1
 */
function getSpecificity(entry: AcceptEntry): number {
    if (entry.type === '*' && entry.subtype === '*') {
        return 1;
    }
    if (entry.subtype === '*') {
        return 2;
    }
    // Exact match
    return entry.params.size > 0 ? 4 : 3;
}

/**
 * Check if an Accept entry matches a media type.
 * Returns specificity score if match, 0 if no match.
 */
function matchesMediaType(entry: AcceptEntry, mediaType: MediaType): number {
    const mimeType = MEDIA_TYPES[mediaType];
    return matchesMimeType(entry, mimeType);
}

interface ParsedMimeType {
    type: string;
    subtype: string;
    params: Map<string, string>;
}

function matchesParsedMimeType(entry: AcceptEntry, parsed: ParsedMimeType): number {
    const { type, subtype, params } = parsed;

    if (!paramsMatch(entry.params, params)) {
        return 0;
    }

    // Full wildcard matches anything
    if (entry.type === '*' && entry.subtype === '*') {
        return 1;
    }

    // Type must match for type wildcard
    if (entry.type === type && entry.subtype === '*') {
        return 2;
    }

    // Exact match
    if (entry.type === type && entry.subtype === subtype) {
        return entry.params.size > 0 ? 4 : 3;
    }

    return 0;
}

/**
 * Check if an Accept entry matches a MIME type string.
 * Returns specificity score if match, 0 if no match.
 */
function matchesMimeType(entry: AcceptEntry, mimeType: string): number {
    const parsed = parseMimeTypeWithParams(mimeType);

    if (!parsed) {
        return 0;
    }

    return matchesParsedMimeType(entry, parsed);
}

function parseMimeTypeWithParams(mimeType: string): ParsedMimeType | null {
    const parts = splitQuotedValue(mimeType, ';').map(p => p.trim());
    const mediaType = parts[0];

    const parsed = parseTypeAndSubtype(mediaType);
    if (!parsed) {
        return null;
    }

    const { type, subtype } = parsed;

    const params = new Map<string, string>();

    for (let i = 1; i < parts.length; i++) {
        const param = parts[i];
        if (!param) continue;
        const eqIndex = param.indexOf('=');
        if (eqIndex === -1) continue;

        const key = param.slice(0, eqIndex).trim().toLowerCase();
        const value = unquote(param.slice(eqIndex + 1).trim());

        if (key) {
            params.set(key, value);
        }
    }

    return {
        type,
        subtype,
        params,
    };
}

function parseTypeAndSubtype(mediaType: string | undefined): { type: string; subtype: string } | null {
    if (!mediaType) {
        return null;
    }

    const typeSubtype = mediaType.trim();
    if (!typeSubtype) {
        return null;
    }

    const slashIndex = typeSubtype.indexOf('/');
    if (slashIndex === -1 || slashIndex !== typeSubtype.lastIndexOf('/')) {
        return null;
    }

    const type = typeSubtype.slice(0, slashIndex).trim().toLowerCase();
    const subtype = typeSubtype.slice(slashIndex + 1).trim().toLowerCase();

    if (!type || !subtype) {
        return null;
    }

    const validType = type === '*' || TOKEN_CHARS.test(type);
    const validSubtype = subtype === '*' || TOKEN_CHARS.test(subtype);
    if (!validType || !validSubtype) {
        return null;
    }

    // RFC 7231 §5.3.2: wildcard media-range is only "*/*".
    if (type === '*' && subtype !== '*') {
        return null;
    }

    return { type, subtype };
}

function negotiateWithEntries(entries: AcceptEntry[], supported: string[]): string | null {
    // RFC 7231 §5.3.2: each candidate's quality comes from its highest-precedence matching media-range.
    let bestMatch: string | null = null;
    let bestSpecificity = 0;
    let bestQ = 0;

    const parsedSupported = supported.map((mimeType) => ({
        mimeType,
        parsed: parseMimeTypeWithParams(mimeType),
    }));

    for (const candidate of parsedSupported) {
        if (!candidate.parsed) {
            continue;
        }

        let candidateSpecificity = -1;
        let candidateQ = 0;

        for (const entry of entries) {
            const specificity = matchesParsedMimeType(entry, candidate.parsed);
            if (specificity === 0) {
                continue;
            }

            if (specificity > candidateSpecificity || (specificity === candidateSpecificity && entry.q > candidateQ)) {
                candidateSpecificity = specificity;
                candidateQ = entry.q;
            }
        }

        if (candidateSpecificity < 0 || candidateQ === 0) {
            continue;
        }

        // Prefer higher q, then higher precedence specificity.
        if (candidateQ > bestQ || (candidateQ === bestQ && candidateSpecificity > bestSpecificity)) {
            bestMatch = candidate.mimeType;
            bestSpecificity = candidateSpecificity;
            bestQ = candidateQ;
        }
    }

    return bestMatch;
}

function paramsMatch(required: Map<string, string>, candidate: Map<string, string>): boolean {
    if (required.size === 0) {
        return true;
    }

    for (const [key, value] of required.entries()) {
        if (!candidate.has(key)) {
            return false;
        }
        if (candidate.get(key) !== value) {
            return false;
        }
    }

    return true;
}

/**
 * Negotiate the best media type from supported options.
 *
 * @param input - The Request object, Accept header string, or null/undefined
 * @param supported - Array of supported media types (MIME strings like 'application/json')
 * @returns Best matching media type or null if none acceptable
 *
 * Matching rules:
 * - Exact match: "application/json" matches 'application/json'
 * - Type wildcard: "text/\*" matches 'text/html', 'text/csv'
 * - Full wildcard: "\*\/\*" matches anything
 * - q=0 means explicitly not acceptable
 */
// RFC 7231 §5.3.2: Media type selection based on Accept.
export function negotiate(input: Request | string | undefined | null, supported: string[]): string | null {
    if (supported.length === 0) {
        return null;
    }

    let acceptHeader: string | null;
    
    if (input instanceof Request) {
        acceptHeader = input.headers.get('Accept');
    } else {
        acceptHeader = input ?? null;
    }

    // Empty or missing Accept header means accept anything
    if (!acceptHeader || !acceptHeader.trim()) {
        return supported[0] ?? null;
    }

    const entries = parseAccept(acceptHeader);

    // No valid entries means accept anything
    if (entries.length === 0) {
        return supported[0] ?? null;
    }

    return negotiateWithEntries(entries, supported);
}

/**
 * Get response format from request or Accept header string.
 * Only distinguishes between 'json' and 'csv'.
 * Defaults to 'json' if no preference or Accept missing.
 * 
 * @param input - The Request object or Accept header string
 * @returns 'json', 'csv', or null when neither is acceptable
 */
// RFC 7231 §5.3.2: Response format selection from Accept.
export function getResponseFormat(input: Request | string | undefined | null): 'json' | 'csv' | null {
    let acceptHeader: string | null;
    
    if (input instanceof Request) {
        acceptHeader = input.headers.get('Accept');
    } else {
        acceptHeader = input ?? null;
    }

    if (!acceptHeader) {
        return 'json';
    }

    if (!acceptHeader.trim()) {
        return 'json';
    }

    const entries = parseAccept(acceptHeader);
    if (entries.length === 0) {
        return 'json';
    }

    const best = negotiateWithEntries(entries, ['application/json', 'text/csv']);
    if (!best) {
        return null;
    }

    return best === 'text/csv' ? 'csv' : 'json';
}

/**
 * Escape a value for CSV output.
 */
function escapeCSVValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }

    let str: string;
    if (typeof value === 'object') {
        str = JSON.stringify(value);
    } else {
        str = String(value);
    }

    // Check if quoting is needed
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        // Escape quotes by doubling them
        return '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
}

/**
 * Convert an array of objects to CSV format.
 * 
 * @param data - Array of objects (all should have same keys)
 * @returns CSV string with headers
 * 
 * Rules:
 * - First row is headers (keys from first object)
 * - Values containing commas, quotes, or newlines are quoted
 * - Quotes in values are escaped as ""
 * - null/undefined become empty string
 * - Objects/arrays are JSON stringified
 */
// Non-RFC: CSV formatting helper.
export function toCSV<T extends Record<string, unknown>>(data: T[]): string {
    if (data.length === 0) {
        return '';
    }

    // Get headers from first object
    const firstRow = data[0]!;
    const headers = Object.keys(firstRow);

    // Build header row
    const headerRow = headers.map(h => escapeCSVValue(h)).join(',');

    // Build data rows
    const dataRows = data.map(row => {
        return headers.map(header => escapeCSVValue(row[header])).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
}
