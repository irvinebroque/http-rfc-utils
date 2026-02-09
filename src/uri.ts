/**
 * URI utilities per RFC 3986.
 * RFC 3986 §2, §3.1, §3.2.2, §5.2.4, §6.2.
 * @see https://www.rfc-editor.org/rfc/rfc3986.html
 */

import type { UriComponent } from './types.js';

// RFC 3986 §2.3: Unreserved characters.
// unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
export const UNRESERVED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

// RFC 3986 §2.2: Reserved characters.
// gen-delims = ":" / "/" / "?" / "#" / "[" / "]" / "@"
export const GEN_DELIMS = ':/?#[]@';

// sub-delims = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
export const SUB_DELIMS = '!$&\'()*+,;=';

// Combined reserved = gen-delims / sub-delims
const RESERVED_CHARS = GEN_DELIMS + SUB_DELIMS;

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const HEX_UPPER = '0123456789ABCDEF';

function createAsciiTable(chars: string): boolean[] {
    const table = Array<boolean>(128).fill(false);
    for (let i = 0; i < chars.length; i++) {
        const code = chars.charCodeAt(i);
        if (code < 128) {
            table[code] = true;
        }
    }
    return table;
}

const UNRESERVED_TABLE = createAsciiTable(UNRESERVED_CHARS);

// RFC 3986 §3.3: pchar = unreserved / pct-encoded / sub-delims / ":" / "@"
const PCHAR_EXTRA = SUB_DELIMS + ':@';

// Characters allowed in each component without encoding (beyond unreserved)
const COMPONENT_ALLOWED: Record<UriComponent, string> = {
    // RFC 3986 §3.3: path uses pchar
    path: PCHAR_EXTRA,
    // RFC 3986 §3.4: query = *( pchar / "/" / "?" )
    query: PCHAR_EXTRA + '/?',
    // RFC 3986 §3.5: fragment = *( pchar / "/" / "?" )
    fragment: PCHAR_EXTRA + '/?',
    // RFC 3986 §3.2.1: userinfo = *( unreserved / pct-encoded / sub-delims / ":" )
    userinfo: SUB_DELIMS + ':',
};

const COMPONENT_ALLOWED_TABLE: Record<UriComponent, boolean[]> = {
    path: createAsciiTable(COMPONENT_ALLOWED.path),
    query: createAsciiTable(COMPONENT_ALLOWED.query),
    fragment: createAsciiTable(COMPONENT_ALLOWED.fragment),
    userinfo: createAsciiTable(COMPONENT_ALLOWED.userinfo),
};

// Default ports for scheme-based normalization (RFC 3986 §6.2.3)
const DEFAULT_PORTS: Record<string, string> = {
    http: '80',
    https: '443',
    ftp: '21',
    ws: '80',
    wss: '443',
};

/**
 * Check if a character is unreserved per RFC 3986 §2.3.
 *
 * @param char - Single character to check
 * @returns true if unreserved
 */
// RFC 3986 §2.3: unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
export function isUnreserved(char: string): boolean {
    if (char.length !== 1) {
        return false;
    }
    const code = char.charCodeAt(0);
    return code < 128 && UNRESERVED_TABLE[code];
}

/**
 * Check if a character is reserved per RFC 3986 §2.2.
 *
 * @param char - Single character to check
 * @returns true if reserved (gen-delims or sub-delims)
 */
// RFC 3986 §2.2: reserved = gen-delims / sub-delims
export function isReserved(char: string): boolean {
    if (char.length !== 1) {
        return false;
    }
    return RESERVED_CHARS.includes(char);
}

/**
 * Percent-encode a string for use in a URI component.
 *
 * - Uses uppercase hex digits per RFC 3986 §2.1 SHOULD.
 * - Does not encode unreserved characters per RFC 3986 §2.3.
 * - Encodes based on component context (path/query/fragment/userinfo).
 * - Detects already-encoded sequences to avoid double-encoding.
 *
 * @param str - String to encode
 * @param component - URI component context (default: 'path')
 * @returns Percent-encoded string
 */
// RFC 3986 §2.1: Percent-encoding uses uppercase HEXDIG.
// RFC 3986 §2.3: Unreserved characters SHOULD NOT be encoded.
export function percentEncode(str: string, component: UriComponent = 'path'): string {
    if (!str) {
        return '';
    }

    const allowedExtra = COMPONENT_ALLOWED_TABLE[component];
    const result: string[] = [];

    // Encode string as UTF-8 bytes
    const bytes = UTF8_ENCODER.encode(str);

    let i = 0;
    while (i < bytes.length) {
        const byte = bytes[i];

        // Check if this is an ASCII character we can represent directly
        if (byte < 128) {
            // RFC 3986 §2.3: Do not encode unreserved characters
            if (UNRESERVED_TABLE[byte]) {
                result.push(String.fromCharCode(byte));
                i++;
                continue;
            }

            // Check component-specific allowed characters
            if (allowedExtra[byte]) {
                result.push(String.fromCharCode(byte));
                i++;
                continue;
            }

            // Check for already-encoded sequence to avoid double-encoding
            // RFC 3986 §2.4: MUST NOT percent-encode an already percent-encoded string
            if (byte === 0x25 && i + 2 < bytes.length) {
                const hex1 = bytes[i + 1]!;
                const hex2 = bytes[i + 2]!;
                if (isHexDigitByte(hex1) && isHexDigitByte(hex2)) {
                    // Already encoded - pass through with uppercase normalization
                    result.push('%', toUpperHexChar(hex1), toUpperHexChar(hex2));
                    i += 3;
                    continue;
                }
            }
        }

        // Percent-encode the byte with uppercase hex
        result.push('%', HEX_UPPER[(byte >> 4) & 0x0f]!, HEX_UPPER[byte & 0x0f]!);
        i++;
    }

    return result.join('');
}

/**
 * Decode percent-encoded octets in a string.
 *
 * - Decodes all percent-encoded sequences.
 * - Handles UTF-8 multi-byte sequences.
 * - Returns original string if decoding fails.
 *
 * @param str - Percent-encoded string
 * @returns Decoded string
 */
// RFC 3986 §2.1: Percent-decoding.
export function percentDecode(str: string): string {
    if (!str || !str.includes('%')) {
        return str;
    }

    const bytes: number[] = [];
    const encoder = UTF8_ENCODER;
    let i = 0;

    while (i < str.length) {
        if (str[i] === '%' && i + 2 < str.length) {
            const hex = str.slice(i + 1, i + 3);
            if (isHexDigit(hex[0]) && isHexDigit(hex[1])) {
                bytes.push(parseInt(hex, 16));
                i += 3;
                continue;
            }
        }
        // Non-encoded character - get its UTF-8 bytes
        const charCode = str.charCodeAt(i);
        if (charCode < 128) {
            bytes.push(charCode);
        } else {
            // Non-ASCII character that wasn't encoded - encode as UTF-8
            const charBytes = encoder.encode(str[i]);
            bytes.push(...charBytes);
        }
        i++;
    }

    // Decode UTF-8 bytes to string
    try {
        return UTF8_DECODER.decode(new Uint8Array(bytes));
    } catch {
        // Invalid UTF-8 - return original
        return str;
    }
}

/**
 * Remove dot segments from a URI path per RFC 3986 §5.2.4.
 *
 * Implements the remove_dot_segments algorithm exactly as specified.
 *
 * @param path - Path component (may contain . and .. segments)
 * @returns Path with dot segments removed
 */
// RFC 3986 §5.2.4: Remove Dot Segments algorithm.
export function removeDotSegments(path: string): string {
    if (!path) {
        return '';
    }

    // Input buffer
    let input = path;
    // Output buffer
    const output: string[] = [];

    while (input.length > 0) {
        // A: If the input buffer begins with a prefix of "../" or "./"
        if (input.startsWith('../')) {
            input = input.slice(3);
            continue;
        }
        if (input.startsWith('./')) {
            input = input.slice(2);
            continue;
        }

        // B: If the input buffer begins with a prefix of "/./" or "/."
        //    where "." is a complete path segment
        if (input.startsWith('/./')) {
            input = '/' + input.slice(3);
            continue;
        }
        if (input === '/.') {
            input = '/';
            continue;
        }

        // C: If the input buffer begins with a prefix of "/../" or "/.."
        //    where ".." is a complete path segment
        if (input.startsWith('/../')) {
            input = '/' + input.slice(4);
            // Remove last segment from output
            removeLastSegment(output);
            continue;
        }
        if (input === '/..') {
            input = '/';
            removeLastSegment(output);
            continue;
        }

        // D: If the input buffer consists only of "." or ".."
        if (input === '.' || input === '..') {
            input = '';
            continue;
        }

        // E: Move the first path segment (including initial "/" if any)
        //    to the end of the output buffer
        let segmentEnd: number;
        if (input.startsWith('/')) {
            segmentEnd = input.indexOf('/', 1);
            if (segmentEnd === -1) {
                segmentEnd = input.length;
            }
        } else {
            segmentEnd = input.indexOf('/');
            if (segmentEnd === -1) {
                segmentEnd = input.length;
            }
        }

        output.push(input.slice(0, segmentEnd));
        input = input.slice(segmentEnd);
    }

    return output.join('');
}

/**
 * Normalize a URI per RFC 3986 §6.2.
 *
 * Applies:
 * - Case normalization (§6.2.2.1): lowercase scheme and host
 * - Percent-encoding normalization (§6.2.2.2): uppercase hex, decode unreserved
 * - Path segment normalization (§6.2.2.3): remove dot segments
 * - Scheme-based normalization (§6.2.3): remove default ports, ensure path
 *
 * @param uri - URI to normalize
 * @returns Normalized URI
 */
// RFC 3986 §6.2: Comparison Ladder normalization.
export function normalizeUri(uri: string): string {
    if (!uri) {
        return '';
    }

    // Use URL for parsing when possible
    let url: URL;
    try {
        url = new URL(uri);
    } catch {
        // Not a valid absolute URI - try basic normalization
        return normalizeUriBasic(uri);
    }

    // RFC 3986 §3: A URI has authority only when hier-part starts with "//".
    const hasAuthority = hasUriAuthority(uri);

    // RFC 3986 §6.2.2.1: Lowercase scheme
    const scheme = url.protocol.slice(0, -1).toLowerCase();

    // RFC 3986 §6.2.2.1: Lowercase host (reg-name)
    // Note: URL already lowercases the hostname
    const host = url.hostname.toLowerCase();

    // RFC 3986 §6.2.3: Remove default port
    let port = url.port;
    if (port && DEFAULT_PORTS[scheme] === port) {
        port = '';
    }

    // RFC 3986 §6.2.2.2: Percent-encoding normalization for path
    let path = normalizePercentEncoding(url.pathname);

    // RFC 3986 §6.2.2.3: Path segment normalization
    path = removeDotSegments(path);

    // RFC 3986 §6.2.3: Ensure non-empty path when authority present.
    if (hasAuthority && !path) {
        path = '/';
    }

    // RFC 3986 §6.2.2.2: Normalize query percent-encoding
    let query = '';
    if (url.search) {
        query = '?' + normalizePercentEncoding(url.search.slice(1));
    }

    // RFC 3986 §6.2.2.2: Normalize fragment percent-encoding
    let fragment = '';
    if (url.hash) {
        fragment = '#' + normalizePercentEncoding(url.hash.slice(1));
    }

    // Reconstruct URI.
    let result = scheme + ':';

    if (hasAuthority) {
        result += '//';

        // Add userinfo if present (rare).
        if (url.username) {
            result += normalizePercentEncoding(url.username);
            if (url.password) {
                result += ':' + normalizePercentEncoding(url.password);
            }
            result += '@';
        }

        result += host;

        if (port) {
            result += ':' + port;
        }
    }

    result += path + query + fragment;

    return result;
}

function hasUriAuthority(uri: string): boolean {
    const schemeEnd = uri.indexOf(':');
    if (schemeEnd <= 0) {
        return false;
    }
    return uri.slice(schemeEnd + 1).startsWith('//');
}

/**
 * Compare two URIs for equivalence per RFC 3986 §6.2.1.
 *
 * Normalizes both URIs and performs simple string comparison.
 *
 * @param a - First URI
 * @param b - Second URI
 * @returns true if URIs are equivalent
 */
// RFC 3986 §6.2.1: Simple String Comparison after normalization.
export function compareUris(a: string, b: string): boolean {
    if (a === b) {
        return true;
    }
    return normalizeUri(a) === normalizeUri(b);
}

// --- Internal helpers ---

/**
 * Check if a character is a hex digit.
 */
function isHexDigit(char: string): boolean {
    if (char.length !== 1) {
        return false;
    }
    return isHexDigitByte(char.charCodeAt(0));
}

function isHexDigitByte(byte: number): boolean {
    return (byte >= 0x30 && byte <= 0x39)
        || (byte >= 0x41 && byte <= 0x46)
        || (byte >= 0x61 && byte <= 0x66);
}

function toUpperHexChar(byte: number): string {
    if (byte >= 0x61 && byte <= 0x66) {
        return String.fromCharCode(byte - 0x20);
    }
    return String.fromCharCode(byte);
}

/**
 * Remove the last path segment from the output buffer.
 * Used by removeDotSegments for ".." processing.
 *
 * RFC 3986 §5.2.4 step C says to remove "the last segment and its
 * preceding '/' (if any)". Since our output buffer stores segments
 * with their leading slashes (e.g., "/a", "/b"), we just pop the
 * last element.
 */
function removeLastSegment(output: string[]): void {
    if (output.length > 0) {
        output.pop();
    }
}

/**
 * Normalize percent-encoding in a string.
 * - Uppercase hex digits
 * - Decode unreserved characters
 */
// RFC 3986 §6.2.2.2: Percent-Encoding Normalization.
function normalizePercentEncoding(str: string): string {
    if (!str) {
        return '';
    }

    const result: string[] = [];
    let i = 0;

    while (i < str.length) {
        if (str[i] === '%' && i + 2 < str.length) {
            const hex1 = str[i + 1];
            const hex2 = str[i + 2];

            if (isHexDigit(hex1) && isHexDigit(hex2)) {
                const byte = parseInt(hex1 + hex2, 16);
                const char = String.fromCharCode(byte);

                // RFC 3986 §6.2.2.2: Decode unreserved characters
                if (UNRESERVED_TABLE[byte]) {
                    result.push(char);
                } else {
                    // Keep encoded but with uppercase hex
                    result.push('%', hex1.toUpperCase(), hex2.toUpperCase());
                }
                i += 3;
                continue;
            }
        }

        result.push(str[i]);
        i++;
    }

    return result.join('');
}

/**
 * Basic normalization for URIs that can't be parsed by URL.
 * Handles relative references and other edge cases.
 */
function normalizeUriBasic(uri: string): string {
    // Just normalize percent-encoding and dot segments
    let result = normalizePercentEncoding(uri);

    // If it looks like it has a path, normalize dot segments
    if (result.includes('/')) {
        // Find where the path starts
        const pathStart = result.indexOf('/');
        const beforePath = result.slice(0, pathStart);
        let path = result.slice(pathStart);

        // Check for query/fragment
        const queryStart = path.indexOf('?');
        const fragStart = path.indexOf('#');

        let query = '';
        let fragment = '';

        if (fragStart !== -1) {
            fragment = path.slice(fragStart);
            path = path.slice(0, fragStart);
        }
        if (queryStart !== -1 && (fragStart === -1 || queryStart < fragStart)) {
            const qEnd = fragStart !== -1 ? fragStart : path.length;
            query = path.slice(queryStart, qEnd);
            path = path.slice(0, queryStart);
        }

        path = removeDotSegments(path);
        result = beforePath + path + query + fragment;
    }

    return result;
}
