/**
 * Response builders for common HTTP patterns.
 * RFC 9110 §8.8.2/§8.8.3, RFC 9111 §5.2.2, RFC 8288 §3, RFC 6266 §4, RFC 5789 §3.1.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html
 */

import type { PaginatedMeta, PaginationLinks, CacheOptions, OptionsResponseOptions } from './types.js';
import { formatHTTPDate } from './datetime.js';
import { defaultCorsHeaders } from './cors.js';
import { cacheControl, CachePresets } from './cache.js';
import { buildLinkHeader } from './link.js';
import { toCSV } from './negotiate.js';
import { formatAcceptPatch } from './patch.js';
import { assertHeaderToken, assertNoCtl } from './header-utils.js';

function sanitizeHeaderRecord(headers: Record<string, string>, context: string): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers)) {
        assertHeaderToken(name, `${context} header name "${name}"`);
        assertNoCtl(value, `${context} header "${name}" value`);
        sanitized[name] = value;
    }
    return sanitized;
}

/**
 * Create an OPTIONS response for preflight requests.
 * 
 * @param allowedMethods - Array of allowed HTTP methods (default: ['GET', 'HEAD', 'OPTIONS'])
 * @param options - Optional OPTIONS metadata headers
 * @returns Response with 204 No Content and appropriate headers
 */
// RFC 5789 §3.1: when provided, Accept-Patch advertises PATCH document formats.
export function optionsResponse(
    allowedMethods: string[] = ['GET', 'HEAD', 'OPTIONS'],
    options: OptionsResponseOptions = {}
): Response {
    const methodSet = new Set(allowedMethods);
    if (options.acceptPatch && options.acceptPatch.length > 0) {
        methodSet.add('PATCH');
    }

    for (const method of methodSet) {
        assertHeaderToken(method, `Allow method "${method}"`);
    }

    const methods = Array.from(methodSet).join(', ');
    const headers: Record<string, string> = {
        ...defaultCorsHeaders,
        'Allow': methods,
        'Access-Control-Allow-Methods': methods,
    };

    if (options.acceptPatch && options.acceptPatch.length > 0) {
        headers['Accept-Patch'] = formatAcceptPatch(options.acceptPatch);
    }

    const sanitizedHeaders = sanitizeHeaderRecord(headers, 'optionsResponse');

    return new Response(null, {
        status: 204,
        headers: sanitizedHeaders,
    });
}

/**
 * Create a HEAD response with headers but no body.
 * 
 * @param headers - Headers to include
 * @returns Response with 200 OK and headers, empty body
 */
export function headResponse(headers: Record<string, string>): Response {
    const sanitizedHeaders = sanitizeHeaderRecord({
        ...defaultCorsHeaders,
        ...headers,
    }, 'headResponse');

    return new Response(null, {
        status: 200,
        headers: sanitizedHeaders,
    });
}

/**
 * Create a JSON response with all standard API headers.
 * 
 * @param data - Data to serialize as JSON
 * @param meta - Pagination metadata (included in response body)
 * @param links - Pagination links
 * @param etag - ETag value (already formatted with quotes)
 * @param lastModified - Last-Modified date
 * @param totalCount - Total count for X-Total-Count header
 * @param cacheOptions - Optional Cache-Control options (default: revalidate)
 * @returns Response with JSON body and all standard headers
 * 
 * Headers included:
 * - Content-Type: application/json
 * - ETag
 * - Last-Modified
 * - Cache-Control
 * - Link (pagination)
 * - X-Total-Count
 * - All CORS headers
 *
 * Response body shape:
 * `{ data, meta }`
*/
// RFC 9110 §8.8.2/§8.8.3, RFC 9111 §5.2.2, RFC 8288 §3: Validators, Cache-Control, Link.
export function jsonResponse<T>(
    data: T,
    meta: PaginatedMeta,
    links: PaginationLinks,
    etag: string,
    lastModified: Date,
    totalCount: number,
    cacheOptions: CacheOptions = CachePresets.revalidate
): Response {
    const headers: Record<string, string> = {
        ...defaultCorsHeaders,
        'Content-Type': 'application/json',
        'ETag': etag,
        'Last-Modified': formatHTTPDate(lastModified),
        'X-Total-Count': String(totalCount),
        'Cache-Control': cacheControl(cacheOptions),
    };

    const linkHeader = buildLinkHeader(links);
    if (linkHeader) {
        headers['Link'] = linkHeader;
    }

    const sanitizedHeaders = sanitizeHeaderRecord(headers, 'jsonResponse');

    return new Response(JSON.stringify({ data, meta }), {
        status: 200,
        headers: sanitizedHeaders,
    });
}

/**
 * Create a CSV response with appropriate headers.
 * 
 * @param data - Array of objects to convert to CSV
 * @param etag - ETag value
 * @param lastModified - Last-Modified date
 * @param links - Pagination links
 * @param totalCount - Total count
 * @param cacheOptions - Optional Cache-Control options
 * @returns Response with CSV body and headers
 * 
 * Headers included:
 * - Content-Type: text/csv; charset=utf-8
 * - Content-Disposition: attachment; filename="data.csv"
 * - ETag
 * - Last-Modified
 * - Cache-Control
 * - Link
 * - X-Total-Count
 * - All CORS headers
 */
// RFC 9110 §8.8.2/§8.8.3, RFC 9111 §5.2.2, RFC 8288 §3, RFC 6266 §4.
export function csvResponse<T extends Record<string, unknown>>(
    data: T[],
    etag: string,
    lastModified: Date,
    links: PaginationLinks,
    totalCount: number,
    cacheOptions: CacheOptions = CachePresets.revalidate
): Response {
    const headers: Record<string, string> = {
        ...defaultCorsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="data.csv"',
        'ETag': etag,
        'Last-Modified': formatHTTPDate(lastModified),
        'X-Total-Count': String(totalCount),
        'Cache-Control': cacheControl(cacheOptions),
    };

    const linkHeader = buildLinkHeader(links);
    if (linkHeader) {
        headers['Link'] = linkHeader;
    }

    const sanitizedHeaders = sanitizeHeaderRecord(headers, 'csvResponse');

    return new Response(toCSV(data), {
        status: 200,
        headers: sanitizedHeaders,
    });
}

/**
 * Create a redirect response.
 * 
 * @param url - Target URL
 * @param status - Status code (301, 302, 303, 307, 308)
 * @returns Redirect response
 */
export function redirectResponse(url: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
    assertNoCtl(url, 'Location header value');

    const headers = sanitizeHeaderRecord({
        ...defaultCorsHeaders,
        'Location': url,
    }, 'redirectResponse');

    return new Response(null, {
        status,
        headers,
    });
}

/**
 * Create a simple JSON response without pagination headers.
 * Useful for single-resource endpoints.
 * 
 * @param data - Data to serialize
 * @param etag - Optional ETag
 * @param lastModified - Optional Last-Modified date
 * @param cacheOptions - Optional cache options
 * @returns Response with JSON body
 */
// RFC 9110 §8.8.2/§8.8.3, RFC 9111 §5.2.2: Validators and Cache-Control.
export function simpleJsonResponse<T>(
    data: T,
    etag?: string,
    lastModified?: Date,
    cacheOptions: CacheOptions = CachePresets.revalidate
): Response {
    const headers: Record<string, string> = {
        ...defaultCorsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': cacheControl(cacheOptions),
    };

    if (etag) {
        headers['ETag'] = etag;
    }

    if (lastModified) {
        headers['Last-Modified'] = formatHTTPDate(lastModified);
    }

    const sanitizedHeaders = sanitizeHeaderRecord(headers, 'simpleJsonResponse');

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: sanitizedHeaders,
    });
}

/**
 * Create an empty success response.
 * 
 * @param status - Status code (default: 204)
 * @returns Response with no body
 */
export function noContentResponse(status: 200 | 201 | 204 = 204): Response {
    const headers = sanitizeHeaderRecord({
        ...defaultCorsHeaders,
    }, 'noContentResponse');

    return new Response(null, {
        status,
        headers,
    });
}

/**
 * Create a text response.
 * 
 * @param text - Text content
 * @param contentType - Content type (default: text/plain)
 * @returns Response with text body
 */
export function textResponse(text: string, contentType: string = 'text/plain; charset=utf-8'): Response {
    const headers = sanitizeHeaderRecord({
        ...defaultCorsHeaders,
        'Content-Type': contentType,
    }, 'textResponse');

    return new Response(text, {
        status: 200,
        headers,
    });
}
