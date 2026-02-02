/**
 * CORS helpers aligned with Fetch/CORS specs.
 */

import type { CorsOptions } from './types.js';

/**
 * Default CORS headers for permissive API access.
 * Used when no specific options are provided.
 */
export const defaultCorsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers': 'ETag, Last-Modified, Link, X-Total-Count',
    'Access-Control-Max-Age': '86400',
};

/**
 * Validate CORS options and throw if invalid.
 * Called internally by buildCorsHeaders.
 */
function validateCorsOptions(options: CorsOptions): void {
    if (options.credentials && (options.origin === '*' || options.origin === undefined)) {
        throw new Error(
            'CORS error: Cannot use wildcard or undefined origin with credentials. ' +
            'Specify explicit origin(s) when credentials is true.'
        );
    }
}

function validateSingleOrigin(options: CorsOptions): asserts options is CorsOptions & { origin?: string | '*' } {
    if (Array.isArray(options.origin)) {
        throw new Error(
            'CORS error: Multiple origins are not valid in Access-Control-Allow-Origin. ' +
            'Use buildCorsHeadersForOrigin(requestOrigin, options) with an allowlist.'
        );
    }
}

/**
 * Build CORS headers from options.
 *
 * @param options - CORS configuration
 * @returns Headers object
 *
 * Behavior:
 * - origin: '*' | string - sets Access-Control-Allow-Origin
 *   - For multiple origins, use buildCorsHeadersForOrigin(requestOrigin, options)
 * - methods: string[] - sets Access-Control-Allow-Methods
 * - allowHeaders: string[] - sets Access-Control-Allow-Headers
 * - exposeHeaders: string[] - sets Access-Control-Expose-Headers
 * - credentials: boolean - if true, sets Access-Control-Allow-Credentials: true
 *   - WARNING: Cannot use '*' for origin when credentials is true
 * - maxAge: number - sets Access-Control-Max-Age in seconds
 */
export function buildCorsHeaders(options?: CorsOptions): Record<string, string> {
    if (!options) {
        return { ...defaultCorsHeaders };
    }

    validateCorsOptions(options);
    validateSingleOrigin(options);

    const headers: Record<string, string> = {};

    // Handle origin
    if (options.origin !== undefined) {
        headers['Access-Control-Allow-Origin'] = options.origin;
    } else {
        headers['Access-Control-Allow-Origin'] = '*';
    }

    // Handle methods
    if (options.methods !== undefined) {
        headers['Access-Control-Allow-Methods'] = options.methods.join(', ');
    } else {
        headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
    }

    // Handle allowHeaders
    if (options.allowHeaders !== undefined) {
        headers['Access-Control-Allow-Headers'] = options.allowHeaders.join(', ');
    } else {
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept, If-None-Match, If-Modified-Since';
    }

    // Handle exposeHeaders
    if (options.exposeHeaders !== undefined) {
        headers['Access-Control-Expose-Headers'] = options.exposeHeaders.join(', ');
    } else {
        headers['Access-Control-Expose-Headers'] = 'ETag, Last-Modified, Link, X-Total-Count';
    }

    // Handle credentials
    if (options.credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Handle maxAge
    if (options.maxAge !== undefined) {
        headers['Access-Control-Max-Age'] = String(options.maxAge);
    } else {
        headers['Access-Control-Max-Age'] = '86400';
    }

    return headers;
}

/**
 * Build CORS headers for a preflight response (OPTIONS request).
 * Same as buildCorsHeaders but always includes max-age.
 */
export function buildPreflightHeaders(options?: CorsOptions): Record<string, string> {
    const headers = buildCorsHeaders(options);

    // Ensure max-age is always present for preflight
    if (!headers['Access-Control-Max-Age']) {
        headers['Access-Control-Max-Age'] = '86400';
    }

    return headers;
}

/**
 * Build CORS headers for a specific request origin.
 *
 * Use this when you support multiple origins. It echoes the request origin
 * and adds Vary: Origin for correct caching behavior.
 */
export function buildCorsHeadersForOrigin(
    requestOrigin: string | null,
    options?: CorsOptions
): Record<string, string> {
    if (!options) {
        return { ...defaultCorsHeaders };
    }

    validateCorsOptions(options);

    if (options.origin === undefined || options.origin === '*') {
        return buildCorsHeaders(options);
    }

    if (!requestOrigin) {
        return {};
    }

    if (!isOriginAllowed(requestOrigin, options)) {
        return {};
    }

    const headers = buildCorsHeaders({
        ...options,
        origin: requestOrigin,
    });

    if (headers['Vary']) {
        const existing = headers['Vary']
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
        if (!existing.includes('Origin')) {
            existing.push('Origin');
        }
        headers['Vary'] = existing.join(', ');
    } else {
        headers['Vary'] = 'Origin';
    }

    return headers;
}

/**
 * Check if an origin is allowed based on CorsOptions.
 * Useful for dynamic origin validation.
 *
 * @param requestOrigin - The Origin header from the request
 * @param options - CORS configuration
 * @returns true if origin is allowed
 */
export function isOriginAllowed(requestOrigin: string, options?: CorsOptions): boolean {
    if (!options || options.origin === undefined || options.origin === '*') {
        return true;
    }

    if (Array.isArray(options.origin)) {
        return options.origin.includes(requestOrigin);
    }

    return options.origin === requestOrigin;
}

/**
 * Legacy alias for backward compatibility.
 * Returns defaultCorsHeaders.
 */
export function corsHeaders(): Record<string, string> {
    return { ...defaultCorsHeaders };
}
