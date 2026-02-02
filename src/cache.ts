/**
 * Cache-Control utilities per RFC 9111.
 * RFC 9111 §5.2 (Cache-Control directives), §1.2.2 (delta-seconds).
 * @module
 */

import type { CacheOptions } from './types.js';
import { formatHTTPDate } from './datetime.js';
import { splitQuotedValue, unquote } from './header-utils.js';

const MAX_DELTA_SECONDS = 2147483648;
const MAX_DELTA_SECONDS_STRING = '2147483648';

function parseFieldNameList(value: string): string[] {
    return splitQuotedValue(value, ',')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => item.toLowerCase());
}

// RFC 9111 §1.2.2: delta-seconds parsing and clamping.
function parseDeltaSeconds(value: string | undefined): number | null {
    if (value === undefined) {
        return null;
    }

    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        return null;
    }

    if (trimmed.length > MAX_DELTA_SECONDS_STRING.length) {
        return MAX_DELTA_SECONDS;
    }

    if (trimmed.length === MAX_DELTA_SECONDS_STRING.length && trimmed > MAX_DELTA_SECONDS_STRING) {
        return MAX_DELTA_SECONDS;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    if (parsed > MAX_DELTA_SECONDS) {
        return MAX_DELTA_SECONDS;
    }

    return parsed;
}

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
 * cacheControl({ public: true, maxAge: 3600 })
 * // Returns: "public, max-age=3600"
 * 
 * @example
 * cacheControl({ private: true, noCache: true, mustRevalidate: true })
 * // Returns: "private, no-cache, must-revalidate"
 */
// RFC 9111 §5.2: Cache-Control field-value construction.
export function cacheControl(options: CacheOptions): string {
    const directives: string[] = [];

    // public/private are mutually exclusive - private takes precedence
    if (options.private || options.privateFields?.length) {
        if (options.privateFields && options.privateFields.length > 0) {
            directives.push(`private="${options.privateFields.join(', ')}"`);
        } else {
            directives.push('private');
        }
    } else if (options.public) {
        directives.push('public');
    }

    if (options.noCache || options.noCacheFields?.length) {
        if (options.noCacheFields && options.noCacheFields.length > 0) {
            directives.push(`no-cache="${options.noCacheFields.join(', ')}"`);
        } else {
            directives.push('no-cache');
        }
    }

    if (options.noStore) {
        directives.push('no-store');
    }

    if (options.maxAge !== undefined && options.maxAge >= 0) {
        directives.push(`max-age=${Math.floor(options.maxAge)}`);
    }

    if (options.sMaxAge !== undefined && options.sMaxAge >= 0) {
        directives.push(`s-maxage=${Math.floor(options.sMaxAge)}`);
    }

    if (options.mustRevalidate) {
        directives.push('must-revalidate');
    }

    if (options.proxyRevalidate) {
        directives.push('proxy-revalidate');
    }

    if (options.immutable) {
        directives.push('immutable');
    }

    if (options.staleWhileRevalidate !== undefined && options.staleWhileRevalidate >= 0) {
        directives.push(`stale-while-revalidate=${Math.floor(options.staleWhileRevalidate)}`);
    }

    if (options.staleIfError !== undefined && options.staleIfError >= 0) {
        directives.push(`stale-if-error=${Math.floor(options.staleIfError)}`);
    }

    return directives.join(', ');
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
    const options: CacheOptions = {};

    // Split by comma and process each directive
    const directives = splitQuotedValue(header, ',').map(d => d.trim()).filter(Boolean);

    for (const directive of directives) {
        // Handle directives with values (e.g., "max-age=3600" or "max-age = 3600")
        const eqIndex = directive.indexOf('=');
        const name = (eqIndex === -1 ? directive : directive.slice(0, eqIndex)).trim().toLowerCase();
        const rawValue = eqIndex === -1 ? undefined : directive.slice(eqIndex + 1).trim();
        const value = rawValue !== undefined ? unquote(rawValue) : undefined;

        switch (name) {
            case 'public':
                options.public = true;
                break;
            case 'private':
                options.private = true;
                if (value) {
                    const fields = parseFieldNameList(value);
                    if (fields.length > 0) {
                        options.privateFields = fields;
                    }
                }
                break;
            case 'no-cache':
                options.noCache = true;
                if (value) {
                    const fields = parseFieldNameList(value);
                    if (fields.length > 0) {
                        options.noCacheFields = fields;
                    }
                }
                break;
            case 'no-store':
                options.noStore = true;
                break;
            case 'max-age': {
                const parsed = parseDeltaSeconds(value);
                if (parsed !== null) {
                    options.maxAge = parsed;
                }
                break;
            }
            case 's-maxage': {
                const parsed = parseDeltaSeconds(value);
                if (parsed !== null) {
                    options.sMaxAge = parsed;
                }
                break;
            }
            case 'must-revalidate':
                options.mustRevalidate = true;
                break;
            case 'proxy-revalidate':
                options.proxyRevalidate = true;
                break;
            case 'immutable':
                options.immutable = true;
                break;
            case 'stale-while-revalidate': {
                const parsed = parseDeltaSeconds(value);
                if (parsed !== null) {
                    options.staleWhileRevalidate = parsed;
                }
                break;
            }
            case 'stale-if-error': {
                const parsed = parseDeltaSeconds(value);
                if (parsed !== null) {
                    options.staleIfError = parsed;
                }
                break;
            }
            // Unknown directives are ignored per spec
        }
    }

    return options;
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
