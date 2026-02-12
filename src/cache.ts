/**
 * Cache-Control utilities per RFC 9111.
 * RFC 9111 §5.2 (Cache-Control directives), §1.2.2 (delta-seconds).
 * @module
 * @see https://www.rfc-editor.org/rfc/rfc9111.html
 */

import type { CacheOptions } from './types.js';
import { formatHTTPDate } from './datetime.js';
import { formatClassicCacheDirectives, parseClassicCacheDirectives } from './internal-cache-control-schema.js';

/**
 * Build a Cache-Control header value from options.
 * 
 * RFC 9111 §5.2 directives:
 * - public: response can be stored by any cache
 * - private: response can only be stored by browser cache
 * - no-cache: cache must revalidate before use
 * - no-store: never store in any cache
 * - max-age=N: fresh for N seconds
 * - s-maxage=N: fresh for N seconds in shared caches
 * - must-revalidate: stale responses must not be used
 * - proxy-revalidate: shared caches must revalidate stale
 * - immutable: response will never change
 * - stale-while-revalidate=N: can serve stale for N seconds while revalidating
 * - stale-if-error=N: can serve stale for N seconds if origin errors
 * 
 * @example
 * `cacheControl({ public: true, maxAge: 3600 })`
 * // Returns: "public, max-age=3600"
 * 
 * @example
 * `cacheControl({ private: true, noCache: true, mustRevalidate: true })`
 * // Returns: "private, no-cache, must-revalidate"
 */
// RFC 9111 §5.2: Cache-Control field-value construction.
export function cacheControl(options: CacheOptions): string {
    return formatClassicCacheDirectives(options);
}

/**
 * Get cache headers including Cache-Control, ETag, and Last-Modified.
 * 
 * @param etag - The ETag value (already formatted with quotes)
 * @param lastModified - The Last-Modified date
 * @param options - Cache-Control options (optional)
 * @returns Headers object with Cache-Control, ETag, Last-Modified
 * 
 * If options not provided, defaults to:
 * - public: true
 * - maxAge: 0
 * - mustRevalidate: true
 * 
 * This default enables conditional request validation while not caching stale data.
 */
// RFC 9111 §5.2.2, RFC 9110 §8.8.2/§8.8.3/§5.6.7: Response cache headers.
export function getCacheHeaders(
    etag: string,
    lastModified: Date,
    options?: CacheOptions
): Record<string, string> {
    const cacheOptions = options ?? {
        public: true,
        maxAge: 0,
        mustRevalidate: true,
    };

    return {
        'Cache-Control': cacheControl(cacheOptions),
        'ETag': etag,
        'Last-Modified': formatHTTPDate(lastModified),
    };
}

/**
 * Parse a Cache-Control header value into options.
 * Useful for reading cache directives from responses.
 * 
 * @param header - The Cache-Control header value
 * @returns Parsed options (unknown directives are ignored)
 */
// RFC 9111 §5.2: Cache-Control parsing.
export function parseCacheControl(header: string): CacheOptions {
    return parseClassicCacheDirectives(header);
}

/**
 * Common cache presets.
 * RFC 9111 §5.2.2: Response directives used by presets.
 */
export const CachePresets = {
    /** No caching at all */
    noStore: { noStore: true } as const,

    /** Revalidate every request (conditional caching) */
    revalidate: { public: true, maxAge: 0, mustRevalidate: true } as const,

    /** Cache for 1 hour */
    shortTerm: { public: true, maxAge: 3600 } as const,

    /** Cache for 1 day */
    mediumTerm: { public: true, maxAge: 86400 } as const,

    /** Cache for 1 year (immutable) */
    immutable: { public: true, maxAge: 31536000, immutable: true } as const,

    /** Private cache only (user-specific content) */
    private: { private: true, maxAge: 0, mustRevalidate: true } as const,
} as const;
