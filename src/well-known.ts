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

function isHexCode(code: number): boolean {
    return (code >= 0x30 && code <= 0x39)
        || (code >= 0x41 && code <= 0x46)
        || (code >= 0x61 && code <= 0x66);
}

function isPcharCode(code: number): boolean {
    return (
        // ALPHA
        (code >= 0x41 && code <= 0x5a)
        || (code >= 0x61 && code <= 0x7a)
        // DIGIT
        || (code >= 0x30 && code <= 0x39)
        // - . _ ~
        || code === 0x2d
        || code === 0x2e
        || code === 0x5f
        || code === 0x7e
        // sub-delims ! $ & ' ( ) * + , ; =
        || code === 0x21
        || code === 0x24
        || code === 0x26
        || code === 0x27
        || code === 0x28
        || code === 0x29
        || code === 0x2a
        || code === 0x2b
        || code === 0x2c
        || code === 0x3b
        || code === 0x3d
        // : @
        || code === 0x3a
        || code === 0x40
    );
}

/**
 * RFC 8615 §3 + RFC 3986 §3.3: suffix MUST be a single `segment-nz`.
 */
export function validateWellKnownSuffix(suffix: string): boolean {
    if (!suffix) {
        return false;
    }

    for (let i = 0; i < suffix.length; i++) {
        const code = suffix.charCodeAt(i);

        if (code === 0x2f) {
            return false;
        }

        if (code === 0x25) {
            if (i + 2 >= suffix.length) {
                return false;
            }
            const hex1 = suffix.charCodeAt(i + 1);
            const hex2 = suffix.charCodeAt(i + 2);
            if (!isHexCode(hex1) || !isHexCode(hex2)) {
                return false;
            }
            i += 2;
            continue;
        }

        if (!isPcharCode(code)) {
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
        throw new Error(
            `Invalid well-known suffix "${suffix}": expected a single non-empty RFC 3986 segment`,
        );
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
        throw new Error(
            `Well-known URI builder origin must be a valid absolute URL; received ${String(origin)}`,
        );
    }

    if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
        throw new Error(
            `Well-known URI builder origin must use http or https; received protocol ${parsedOrigin.protocol}`,
        );
    }

    return `${parsedOrigin.origin}${path}`;
}
