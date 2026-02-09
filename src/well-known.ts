/**
 * Well-Known URIs per RFC 8615.
 * RFC 8615 §3: Top-level `/.well-known/` prefix and suffix constraints.
 * @see https://www.rfc-editor.org/rfc/rfc8615.html#section-3
 */

import type { WellKnownPathParts } from './types.js';

export type { WellKnownPathParts } from './types.js';

/**
 * RFC 8615 §3: Well-known URIs use this exact top-level path prefix.
 */
export const WELL_KNOWN_PREFIX = '/.well-known/';

const PCHAR_PATTERN = /^[A-Za-z0-9\-._~!$&'()*+,;=:@]$/;
const HEX_PAIR_PATTERN = /^[0-9A-Fa-f]{2}$/;

/**
 * RFC 8615 §3 + RFC 3986 §3.3: suffix MUST be a single `segment-nz`.
 */
export function validateWellKnownSuffix(suffix: string): boolean {
    if (!suffix || suffix.includes('/')) {
        return false;
    }

    for (let i = 0; i < suffix.length; i++) {
        const char = suffix.charAt(i);
        if (char === '%') {
            const hex = suffix.slice(i + 1, i + 3);
            if (!HEX_PAIR_PATTERN.test(hex)) {
                return false;
            }
            i += 2;
            continue;
        }

        if (!PCHAR_PATTERN.test(char)) {
            return false;
        }
    }

    return true;
}

/**
 * RFC 8615 §3: true only for absolute top-level well-known paths.
 */
export function isWellKnownPath(path: string): boolean {
    return parseWellKnownPath(path) !== null;
}

/**
 * RFC 8615 §3: parse top-level well-known path into prefix/suffix.
 * Returns null for invalid or nested forms.
 */
export function parseWellKnownPath(path: string): WellKnownPathParts | null {
    if (!path.startsWith(WELL_KNOWN_PREFIX)) {
        return null;
    }

    const suffix = path.slice(WELL_KNOWN_PREFIX.length);

    if (!validateWellKnownSuffix(suffix)) {
        return null;
    }

    return {
        prefix: WELL_KNOWN_PREFIX,
        suffix,
        path: `${WELL_KNOWN_PREFIX}${suffix}`,
    };
}

/**
 * RFC 8615 §3: Validate HTTP(S) URIs that target a top-level well-known path.
 */
export function isWellKnownUri(uri: string | URL): boolean {
    let parsed: URL;
    try {
        parsed = uri instanceof URL ? uri : new URL(uri);
    } catch {
        return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
    }

    return isWellKnownPath(parsed.pathname);
}

/**
 * RFC 8615 §3: Build strict `/.well-known/{suffix}` paths.
 */
export function buildWellKnownPath(suffix: string): string {
    if (!validateWellKnownSuffix(suffix)) {
        throw new Error('Invalid well-known suffix: expected a single non-empty RFC 3986 segment');
    }

    return `${WELL_KNOWN_PREFIX}${suffix}`;
}

/**
 * RFC 8615 §3: Build strict absolute HTTP(S) well-known URIs.
 */
export function buildWellKnownUri(origin: string | URL, suffix: string): string {
    const path = buildWellKnownPath(suffix);

    let parsedOrigin: URL;
    try {
        parsedOrigin = origin instanceof URL ? new URL(origin.toString()) : new URL(origin);
    } catch {
        throw new Error('Invalid origin for well-known URI builder');
    }

    if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
        throw new Error('Well-known URI builder supports only http and https origins');
    }

    return `${parsedOrigin.origin}${path}`;
}
