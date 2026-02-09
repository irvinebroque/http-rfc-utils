/**
 * Conditional Requests per RFC 9110.
 * RFC 9110 §13.1.1-§13.1.4, §13.2.2.
 * @see https://httpwg.org/specs/rfc9110.html#conditional.requests
 */

import type { ETag, ConditionalResult } from './types.js';
import { parseETag, formatETag, compareETags } from './etag.js';
import { parseHTTPDate, formatHTTPDate } from './datetime.js';
import { defaultCorsHeaders } from './cors.js';

/**
 * Check if request method is safe (GET or HEAD).
 */
function isSafeMethod(method: string): boolean {
    const upper = method.toUpperCase();
    return upper === 'GET' || upper === 'HEAD';
}

function buildConditionalHeaders(currentETag: ETag | null, lastModified: Date | null): Record<string, string> {
    const headers: Record<string, string> = { ...defaultCorsHeaders };

    if (currentETag) {
        headers['ETag'] = formatETag(currentETag);
    }

    if (lastModified) {
        headers['Last-Modified'] = formatHTTPDate(lastModified);
    }

    return headers;
}

function toWholeSecondPrecision(date: Date): number {
    const ms = date.getTime();
    return Math.floor(ms / 1000) * 1000;
}

/**
 * Parse If-None-Match header into ETags or wildcard.
 *
 * Format: "etag1", "etag2" OR *
 *
 * @param header - If-None-Match header value
 * @returns Array of ETags or '*' for wildcard
 */
// RFC 9110 §13.1.2: If-None-Match field value.
export function parseIfNoneMatch(header: string): ETag[] | '*' {
    const trimmed = header.trim();

    if (trimmed === '*') {
        return '*';
    }

    if (trimmed.includes('*')) {
        return [];
    }

    const etags: ETag[] = [];

    // ETags are in format: "value" or W/"value"
    const regex = /(?:W\/)?\"[^\"]*\"/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(trimmed)) !== null) {
        const value = match[0]?.trim();
        const index = match.index;
        if (!value) {
            continue;
        }

        if (value.startsWith('"') && index >= 2) {
            const prefix = trimmed.slice(index - 2, index);
            if (prefix === 'w/') {
                continue;
            }
        }

        const parsed = parseETag(value);
        if (parsed) {
            etags.push(parsed);
        }
    }

    return etags;
}

/**
 * Parse If-Match header into ETags or wildcard.
 *
 * @param header - If-Match header value
 * @returns Array of ETags or '*' for wildcard
 */
// RFC 9110 §13.1.1: If-Match field value.
export function parseIfMatch(header: string): ETag[] | '*' {
    // Same format as If-None-Match
    return parseIfNoneMatch(header);
}

/**
 * Evaluate If-Match precondition.
 * Uses STRONG comparison.
 *
 * @param header - If-Match header value
 * @param current - Current resource ETag
 * @returns true if precondition passes, false if should return 412
 */
// RFC 9110 §13.1.1, §8.8.3: Strong comparison for If-Match.
export function evaluateIfMatch(header: string, current: ETag | null): boolean {
    const parsed = parseIfMatch(header);

    // Wildcard: passes if resource exists
    if (parsed === '*') {
        return current !== null;
    }

    // If resource doesn't exist, If-Match always fails
    if (current === null) {
        return false;
    }

    // If-Match passes if ANY ETag matches (strong comparison)
    for (const etag of parsed) {
        if (compareETags(etag, current, true)) {
            return true;
        }
    }

    return false;
}

/**
 * Evaluate If-None-Match precondition.
 * Uses WEAK comparison.
 *
 * @param header - If-None-Match header value
 * @param current - Current resource ETag
 * @returns true if any ETag matches (should return 304 or 412)
 */
// RFC 9110 §13.1.2, §8.8.3: Weak comparison for If-None-Match.
export function evaluateIfNoneMatch(header: string, current: ETag | null): boolean {
    const parsed = parseIfNoneMatch(header);

    // If resource doesn't exist, nothing can match
    if (current === null) {
        return false;
    }

    // Wildcard: matches any existing resource
    if (parsed === '*') {
        return true;
    }

    // If-None-Match triggers if ANY ETag matches (weak comparison)
    for (const etag of parsed) {
        if (compareETags(etag, current, false)) {
            return true;
        }
    }

    return false;
}

/**
 * Evaluate If-Modified-Since precondition.
 *
 * @param header - If-Modified-Since header value (HTTP-date)
 * @param lastModified - Current resource modification date
 * @returns true if NOT modified (should return 304), false otherwise
 */
// RFC 9110 §13.1.3: If-Modified-Since evaluation.
export function evaluateIfModifiedSince(header: string, lastModified: Date | null): boolean {
    if (lastModified === null) {
        return false;
    }

    const sinceDate = parseHTTPDate(header);
    if (sinceDate === null) {
        return false;
    }

    // RFC 9110 §5.6.7: HTTP-date has one-second granularity.
    // RFC 9110 §13.1.3: evaluate using HTTP-date precision.
    return toWholeSecondPrecision(lastModified) <= toWholeSecondPrecision(sinceDate);
}

/**
 * Evaluate If-Unmodified-Since precondition.
 *
 * @param header - If-Unmodified-Since header value (HTTP-date)
 * @param lastModified - Current resource modification date
 * @returns true if precondition passes, false if should return 412
 */
// RFC 9110 §13.1.4: If-Unmodified-Since evaluation.
export function evaluateIfUnmodifiedSince(header: string, lastModified: Date | null): boolean {
    if (header.trim() === '') {
        return true;
    }

    const sinceDate = parseHTTPDate(header);
    if (sinceDate === null) {
        return true;
    }

    if (lastModified === null) {
        // If we don't know when resource was modified, we can't say it's been modified
        // RFC 9110 doesn't explicitly say, but logically precondition passes
        return true;
    }

    // RFC 9110 §5.6.7: HTTP-date has one-second granularity.
    // RFC 9110 §13.1.4: evaluate using HTTP-date precision.
    return toWholeSecondPrecision(lastModified) <= toWholeSecondPrecision(sinceDate);
}

/**
 * Full RFC 9110 precondition evaluation.
 *
 * Implements the precedence algorithm from RFC 9110 Section 13.2.2:
 *
 * 1. If If-Match present:
 *    - If NONE match (strong comparison), return 412 Precondition Failed.
 *    - If any match, continue.
 *
 * 2. If If-Match absent AND If-Unmodified-Since present:
 *    - If resource modified after date, return 412 Precondition Failed.
 *    - If not modified, continue.
 *
 * 3. If If-None-Match present:
 *    - If ANY match (weak comparison):
 *      - GET/HEAD returns 304 Not Modified.
 *      - Other methods return 412 Precondition Failed.
 *    - If none match, continue.
 *
 * 4. If If-None-Match absent AND If-Modified-Since present (GET/HEAD only):
 *    - If resource is NOT modified since date, return 304 Not Modified.
 *    - If modified, continue.
 *
 * 5. Otherwise, proceed with the request.
 *
 * @param request - The incoming request
 * @param currentETag - Current resource ETag (null if resource doesn't exist)
 * @param lastModified - Current resource modification date (null if unknown)
 * @returns ConditionalResult indicating whether to proceed
 */
// RFC 9110 §13.2.2: Precondition evaluation order.
export function evaluatePreconditions(
    request: Request,
    currentETag: ETag | null,
    lastModified: Date | null
): ConditionalResult {
    const method = request.method;
    const headers = request.headers;

    const ifMatch = headers.get('If-Match');
    const ifNoneMatch = headers.get('If-None-Match');
    const ifModifiedSince = headers.get('If-Modified-Since');
    const ifUnmodifiedSince = headers.get('If-Unmodified-Since');

    // Step 1: If-Match
    if (ifMatch !== null) {
        if (!evaluateIfMatch(ifMatch, currentETag)) {
            return {
                proceed: false,
                status: 412,
                headers: buildConditionalHeaders(currentETag, lastModified),
            };
        }
        // If-Match passed, continue to next steps
    }

    // Step 2: If-Match absent AND If-Unmodified-Since present
    if (ifMatch === null && ifUnmodifiedSince !== null) {
        if (!evaluateIfUnmodifiedSince(ifUnmodifiedSince, lastModified)) {
            return {
                proceed: false,
                status: 412,
                headers: buildConditionalHeaders(currentETag, lastModified),
            };
        }
        // If-Unmodified-Since passed, continue
    }

    // Step 3: If-None-Match
    if (ifNoneMatch !== null) {
        if (evaluateIfNoneMatch(ifNoneMatch, currentETag)) {
            // ETag matches - what response depends on method
            if (isSafeMethod(method)) {
                return {
                    proceed: false,
                    status: 304,
                    headers: buildConditionalHeaders(currentETag, lastModified),
                };
            } else {
                return {
                    proceed: false,
                    status: 412,
                    headers: buildConditionalHeaders(currentETag, lastModified),
                };
            }
        }
        // No match, continue
    }

    // Step 4: If-None-Match absent AND If-Modified-Since present (GET/HEAD only)
    if (ifNoneMatch === null && ifModifiedSince !== null && isSafeMethod(method)) {
        if (evaluateIfModifiedSince(ifModifiedSince, lastModified)) {
            return {
                proceed: false,
                status: 304,
                headers: buildConditionalHeaders(currentETag, lastModified),
            };
        }
        // Modified since, continue
    }

    // Step 5: All preconditions passed, proceed with request
    return { proceed: true };
}

/**
 * Handle a conditional request (backward-compatible function).
 *
 * @param request - The incoming request
 * @param etag - Current resource ETag (already formatted with quotes)
 * @param lastModified - Current resource Last-Modified date
 * @returns Response (304 or 412) if condition fails, null if request should proceed
 */
// RFC 9110 §13.2.2, §15.4.5, §15.5.13: Conditional request responses.
export function handleConditionalRequest(
    request: Request,
    etag: string,
    lastModified: Date
): Response | null {
    const parsedETag = parseETag(etag);
    const result = evaluatePreconditions(request, parsedETag, lastModified);

    if (result.proceed) {
        return null;
    }

    // Build response headers
    const responseHeaders: Record<string, string> = {
        ...result.headers,
    };

    if (!responseHeaders['ETag']) {
        responseHeaders['ETag'] = etag;
    }

    if (!responseHeaders['Last-Modified']) {
        responseHeaders['Last-Modified'] = formatHTTPDate(lastModified);
    }

    // Cache-Control and Vary should be set by the caller as they know the caching policy

    const responseInit: ResponseInit = {
        headers: responseHeaders,
    };

    if (result.status !== undefined) {
        responseInit.status = result.status;
    }

    return new Response(null, responseInit);
}
