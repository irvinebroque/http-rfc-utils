/**
 * CORS helpers aligned with Fetch/CORS specs.
 */

import type { CorsOptions } from './types.js';
import { assertHeaderToken, assertNoCtl } from './header-utils.js';
import { mergeVary } from './headers.js';

/**
 * Default CORS headers for permissive API access.
 * Used when no specific options are provided.
 *
 * WARNING: These defaults are intentionally permissive for local/dev use.
 * Prefer `buildStrictCorsHeadersForOrigin` for production APIs.
 */
export const defaultCorsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers': 'ETag, Last-Modified, Link, X-Total-Count',
    'Access-Control-Max-Age': '86400',
};

const STRICT_CORS_DEFAULT_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const STRICT_CORS_DEFAULT_ALLOW_HEADERS = ['Content-Type', 'Accept'];
const STRICT_CORS_DEFAULT_MAX_AGE = 600;

function validateTokenList(values: string[], context: string): void {
    for (const value of values) {
        assertHeaderToken(value, `${context} "${value}"`);
    }
}

function validateOriginValue(origin: string, context: string): void {
    assertNoCtl(origin, context);
}

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

    if (typeof options.origin === 'string') {
        validateOriginValue(options.origin, 'CORS origin');
    }

    if (Array.isArray(options.origin)) {
        for (const origin of options.origin) {
            if (origin === '*') {
                throw new Error(
                    'CORS error: Wildcard origin "*" is not allowed inside origin allowlists.'
                );
            }
            validateOriginValue(origin, 'CORS origin');
        }
    }

    if (options.methods !== undefined) {
        validateTokenList(options.methods, 'CORS method');
    }

    if (options.allowHeaders !== undefined) {
        validateTokenList(options.allowHeaders, 'CORS allow-header');
    }

    if (options.exposeHeaders !== undefined) {
        validateTokenList(options.exposeHeaders, 'CORS expose-header');
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

    // Preserve caller-provided Vary values when provided.
    if (options.vary !== undefined) {
        headers['Vary'] = options.vary;
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

    headers['Vary'] = mergeVary(headers['Vary'] ?? null, 'Origin');

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
    assertNoCtl(requestOrigin, 'CORS request origin');

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

/**
 * Build strict CORS headers for production-facing APIs.
 *
 * - Requires an explicit allowlist.
 * - Uses restrictive defaults unless overridden.
 * - Echoes the request origin and adds `Vary: Origin`.
 */
export function buildStrictCorsHeadersForOrigin(
    requestOrigin: string | null,
    allowedOrigins: string[],
    options: Omit<CorsOptions, 'origin'> = {}
): Record<string, string> {
    if (allowedOrigins.length === 0) {
        throw new Error('CORS error: Strict CORS requires at least one allowed origin.');
    }

    for (const origin of allowedOrigins) {
        if (origin === '*') {
            throw new Error('CORS error: Strict CORS does not allow wildcard origins.');
        }
        validateOriginValue(origin, 'CORS allowlist origin');
    }

    if (requestOrigin !== null) {
        validateOriginValue(requestOrigin, 'CORS request origin');
    }

    const strictOptions: CorsOptions = {
        origin: allowedOrigins,
        methods: options.methods ?? STRICT_CORS_DEFAULT_METHODS,
        allowHeaders: options.allowHeaders ?? STRICT_CORS_DEFAULT_ALLOW_HEADERS,
        exposeHeaders: options.exposeHeaders ?? [],
        credentials: options.credentials ?? false,
        maxAge: options.maxAge ?? STRICT_CORS_DEFAULT_MAX_AGE,
    };

    const headers = buildCorsHeadersForOrigin(requestOrigin, strictOptions);
    if (headers['Access-Control-Expose-Headers'] === '') {
        delete headers['Access-Control-Expose-Headers'];
    }

    return headers;
}
