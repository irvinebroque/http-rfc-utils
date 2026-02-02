/**
 * Pagination helpers with RFC 8288 Link header usage.
 * RFC 8288 §3, §3.3.
 */

import type { 
    PaginationParams, 
    PaginationError, 
    PaginationResult, 
    DecodedCursor, 
    PaginationLinks 
} from './types.js';
import { isPaginationError } from './types.js';

/** Default number of items per page */
export const DEFAULT_LIMIT = 50;

/** Maximum allowed items per page */
export const MAX_LIMIT = 100;

/**
 * Decode a cursor string to get the offset.
 * Cursor format: base64(JSON({ offset: number }))
 * 
 * @param cursor - The cursor string
 * @returns DecodedCursor or null if invalid
 */
// Non-RFC: Cursor decoding helper.
export function decodeCursor(cursor: string): DecodedCursor | null {
    try {
        const decoded = atob(cursor);
        const parsed = JSON.parse(decoded);
        
        if (typeof parsed.offset !== 'number') {
            return null;
        }
        
        if (parsed.offset < 0) {
            return null;
        }
        
        if (!Number.isInteger(parsed.offset)) {
            return null;
        }
        
        return { offset: parsed.offset };
    } catch {
        return null;
    }
}

/**
 * Encode an offset into a cursor string.
 * 
 * @param offset - The offset to encode
 * @returns Base64-encoded cursor
 */
// Non-RFC: Cursor encoding helper.
export function encodeCursor(offset: number): string {
    return btoa(JSON.stringify({ offset }));
}

/**
 * Parse pagination parameters from URL query string.
 * 
 * Supports two modes:
 * 1. Cursor-based: ?cursor=<base64>
 * 2. Offset-based: ?limit=N&offset=N
 * 
 * Also extracts sort parameter if present.
 * 
 * @param url - The URL to parse
 * @param options - Configuration options
 * @returns PaginationParams on success, PaginationError on failure
 * 
 * Error cases:
 * - Invalid cursor format
 * - Invalid cursor payload (not JSON, missing offset, negative offset)
 * - Non-numeric limit/offset
 * - Negative offset
 */
// Non-RFC: Pagination query parsing.
export function parsePaginationParams(
    url: URL,
    options?: { 
        defaultLimit?: number; 
        maxLimit?: number;
    }
): PaginationResult {
    const defaultLimit = options?.defaultLimit ?? DEFAULT_LIMIT;
    const maxLimit = options?.maxLimit ?? MAX_LIMIT;
    
    const cursorParam = url.searchParams.get('cursor');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    const sortParam = url.searchParams.get('sort');
    
    let offset: number;
    let limit: number;
    
    // Cursor takes precedence over limit/offset
    if (cursorParam !== null) {
        const decoded = decodeCursor(cursorParam);
        if (decoded === null) {
            return { error: 'invalid_cursor' };
        }
        offset = decoded.offset;
    } else if (offsetParam !== null) {
        const parsedOffset = Number(offsetParam);
        if (Number.isNaN(parsedOffset)) {
            return { error: 'invalid_offset' };
        }
        if (parsedOffset < 0) {
            return { error: 'invalid_offset' };
        }
        offset = Math.floor(parsedOffset);
    } else {
        offset = 0;
    }
    
    if (limitParam !== null) {
        const parsedLimit = Number(limitParam);
        if (Number.isNaN(parsedLimit)) {
            return { error: 'invalid_limit' };
        }
        limit = Math.min(Math.max(1, Math.floor(parsedLimit)), maxLimit);
    } else {
        limit = defaultLimit;
    }
    
    const result: PaginationParams = { limit, offset };
    
    if (sortParam !== null) {
        result.sort = sortParam;
    }
    
    return result;
}

/**
 * Calculate the last page offset given total count and limit.
 */
// Non-RFC: Pagination helper.
export function lastPageOffset(totalCount: number, limit: number): number {
    if (totalCount <= 0) {
        return 0;
    }
    return Math.floor((totalCount - 1) / limit) * limit;
}

/**
 * Check if we're on the first page.
 */
// Non-RFC: Pagination helper.
export function isFirstPage(offset: number): boolean {
    return offset === 0;
}

/**
 * Check if we're on the last page.
 */
// Non-RFC: Pagination helper.
export function isLastPage(offset: number, limit: number, totalCount: number): boolean {
    if (totalCount === 0) {
        return true;
    }
    return offset + limit >= totalCount;
}

/**
 * Build pagination links for a result set.
 * 
 * @param baseUrl - The base URL (without pagination params)
 * @param totalCount - Total number of items
 * @param limit - Items per page
 * @param currentOffset - Current offset
 * @param extraParams - Additional URL params to preserve
 * @returns PaginationLinks object
 * 
 * Links:
 * - self: Current page
 * - first: First page (offset=0)
 * - last: Last page
 * - next: Next page (omitted on last page)
 * - prev: Previous page (omitted on first page)
 * 
 * All links use cursor-based pagination for consistency.
 */
// RFC 8288 §3, §3.3: Link relations for pagination.
export function buildPaginationLinks(
    baseUrl: string,
    totalCount: number,
    limit: number,
    currentOffset: number,
    extraParams?: URLSearchParams
): PaginationLinks {
    const buildUrl = (offset: number): string => {
        const url = new URL(baseUrl);
        url.searchParams.set('cursor', encodeCursor(offset));
        url.searchParams.set('limit', String(limit));
        
        if (extraParams) {
            extraParams.forEach((value, key) => {
                if (key !== 'cursor' && key !== 'limit' && key !== 'offset') {
                    url.searchParams.set(key, value);
                }
            });
        }
        
        return url.toString();
    };
    
    const lastOffset = lastPageOffset(totalCount, limit);
    
    const links: PaginationLinks = {
        self: buildUrl(currentOffset),
        first: buildUrl(0),
        last: buildUrl(lastOffset)
    };
    
    if (!isLastPage(currentOffset, limit, totalCount)) {
        links.next = buildUrl(currentOffset + limit);
    }
    
    if (!isFirstPage(currentOffset)) {
        const prevOffset = Math.max(0, currentOffset - limit);
        links.prev = buildUrl(prevOffset);
    }
    
    return links;
}
