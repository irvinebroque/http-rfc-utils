/**
 * JSON Pointer utilities per RFC 6901.
 * RFC 6901 §3-7.
 * @see https://www.rfc-editor.org/rfc/rfc6901.html
 */

/**
 * Decode a single reference token by unescaping ~ sequences.
 * RFC 6901 §4: Decode ~1 to / first, then ~0 to ~.
 * Order matters to avoid ~01 becoming / instead of ~1.
 */
import {
    createAsciiAllowTable,
    decodePercentComponent,
    encodeRfc3986,
} from './internal-uri-encoding.js';

const URI_FRAGMENT_ALLOW_CHARACTERS = '/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const URI_FRAGMENT_ALLOW_TABLE = createAsciiAllowTable(URI_FRAGMENT_ALLOW_CHARACTERS);

function decodeToken(token: string): string {
    // RFC 6901 §4: first ~1 → /, then ~0 → ~
    return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Encode a single reference token by escaping ~ and / characters.
 * RFC 6901 §3: ~ encoded as ~0, / encoded as ~1.
 * Encode ~ before / to ensure proper round-trip.
 */
function encodeToken(token: string): string {
    // Encode ~ first, then /
    return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Validate that a token contains only valid escape sequences.
 * RFC 6901 §3: escaped = "~" ( "0" / "1" )
 * A ~ must be followed by 0 or 1.
 */
function hasValidEscapes(token: string): boolean {
    for (let i = 0; i < token.length; i++) {
        if (token[i] === '~') {
            const next = token[i + 1];
            if (next !== '0' && next !== '1') {
                return false;
            }
            i++; // Skip the next character
        }
    }
    return true;
}

/**
 * Validate array index format per RFC 6901 §4.
 * array-index = %x30 / ( %x31-39 *(%x30-39) )
 * "0" or digits without leading "0".
 */
function isValidArrayIndex(token: string): boolean {
    if (token === '-') return true; // Special case for append reference
    if (token === '') return false;
    if (token === '0') return true;
    // Must start with 1-9, followed by any digits
    return /^[1-9][0-9]*$/.test(token);
}

/**
 * Parse a JSON Pointer string into decoded reference tokens.
 * Returns null if the pointer syntax is invalid.
 *
 * @param pointer - JSON Pointer string (e.g., "/foo/bar/0")
 * @returns Array of decoded tokens, or null on invalid syntax
 *
 * @example
 * parseJsonPointer('/foo/bar')  // ['foo', 'bar']
 * parseJsonPointer('/a~1b')     // ['a/b']
 * parseJsonPointer('')          // []
 * parseJsonPointer('/~2')       // null (invalid escape)
 *
 * @see https://www.rfc-editor.org/rfc/rfc6901.html#section-3
 */
// RFC 6901 §3: json-pointer = *( "/" reference-token )
export function parseJsonPointer(pointer: string): string[] | null {
    // RFC 6901 §3: Empty string is valid, references entire document
    if (pointer === '') {
        return [];
    }

    // RFC 6901 §3: Must start with /
    if (pointer[0] !== '/') {
        return null;
    }

    // Split on / and remove the leading empty string
    const rawTokens = pointer.slice(1).split('/');

    // Validate and decode each token
    const tokens: string[] = [];
    for (const rawToken of rawTokens) {
        // RFC 6901 §3: Validate escape sequences
        if (!hasValidEscapes(rawToken)) {
            return null;
        }
        tokens.push(decodeToken(rawToken));
    }

    return tokens;
}

/**
 * Format an array of tokens into a JSON Pointer string.
 *
 * @param tokens - Array of reference tokens
 * @returns Encoded JSON Pointer string
 *
 * @example
 * formatJsonPointer(['foo', 'bar'])  // '/foo/bar'
 * formatJsonPointer(['a/b'])         // '/a~1b'
 * formatJsonPointer([])              // ''
 *
 * @see https://www.rfc-editor.org/rfc/rfc6901.html#section-3
 */
// RFC 6901 §3: json-pointer = *( "/" reference-token )
export function formatJsonPointer(tokens: string[]): string {
    if (tokens.length === 0) {
        return '';
    }
    return '/' + tokens.map(encodeToken).join('/');
}

/**
 * Evaluate a JSON Pointer against a document, returning the referenced value.
 * Returns undefined if the pointer does not resolve to a value.
 *
 * @param pointer - JSON Pointer string
 * @param document - JSON document (object, array, or primitive)
 * @returns Referenced value, or undefined if not found
 *
 * @example
 * `evaluateJsonPointer('/foo/0', { foo: ['bar'] })`  // 'bar'
 * `evaluateJsonPointer('/missing', { foo: 1 })`      // undefined
 * `evaluateJsonPointer('', { foo: 1 })`              // returns the input document
 *
 * @see https://www.rfc-editor.org/rfc/rfc6901.html#section-4
 */
// RFC 6901 §4: Evaluation algorithm
export function evaluateJsonPointer(pointer: string, document: unknown): unknown {
    // RFC 6901 §4: Empty pointer references entire document
    if (pointer === '') {
        return document;
    }

    const tokens = parseJsonPointer(pointer);
    if (tokens === null) {
        return undefined;
    }

    let current: unknown = document;

    for (const token of tokens) {
        if (current === null || current === undefined) {
            return undefined;
        }

        if (Array.isArray(current)) {
            // RFC 6901 §4: "-" references nonexistent element after last
            if (token === '-') {
                return undefined;
            }

            // RFC 6901 §4: Array index must be valid (no leading zeros)
            if (!isValidArrayIndex(token)) {
                return undefined;
            }

            const index = parseInt(token, 10);
            if (index >= current.length) {
                return undefined;
            }

            current = current[index];
        } else if (typeof current === 'object') {
            // RFC 6901 §4: No Unicode normalization; byte-by-byte comparison
            const obj = current as Record<string, unknown>;
            if (!Object.prototype.hasOwnProperty.call(obj, token)) {
                return undefined;
            }
            current = obj[token];
        } else {
            // Primitive value cannot be indexed
            return undefined;
        }
    }

    return current;
}

/**
 * Convert a JSON Pointer to a URI fragment identifier.
 * Encodes the pointer using UTF-8 and percent-encoding per RFC 6901 §6.
 *
 * @param pointer - JSON Pointer string
 * @returns URI fragment (with leading '#')
 *
 * @example
 * toUriFragment('/foo/bar')  // '#/foo/bar'
 * toUriFragment('/a b')      // '#/a%20b'
 * toUriFragment('/c%d')      // '#/c%25d'
 *
 * @see https://www.rfc-editor.org/rfc/rfc6901.html#section-6
 */
// RFC 6901 §6: URI fragment identifier representation
export function toUriFragment(pointer: string): string {
    if (pointer === '') {
        return '#';
    }

    return '#' + encodeRfc3986(pointer, {
        allowTable: URI_FRAGMENT_ALLOW_TABLE,
        preservePctTriplets: false,
        normalizePctHexUppercase: true,
    });
}

/**
 * Parse a URI fragment identifier into a JSON Pointer.
 * Decodes percent-encoding per RFC 6901 §6.
 *
 * @param fragment - URI fragment (with or without leading '#')
 * @returns JSON Pointer string, or null on invalid syntax
 *
 * @example
 * fromUriFragment('#/foo/bar')  // '/foo/bar'
 * fromUriFragment('#/a%20b')    // '/a b'
 * fromUriFragment('/foo/bar')   // '/foo/bar'
 *
 * @see https://www.rfc-editor.org/rfc/rfc6901.html#section-6
 */
// RFC 6901 §6: URI fragment identifier representation
export function fromUriFragment(fragment: string): string | null {
    // Remove leading # if present
    let pointer = fragment;
    if (pointer.startsWith('#')) {
        pointer = pointer.slice(1);
    }

    // RFC 6901 §6: Decode percent-encoding
    const decoded = decodePercentComponent(pointer);
    if (decoded === null) {
        return null;
    }
    pointer = decoded;

    // Validate the resulting pointer
    if (pointer === '' || parseJsonPointer(pointer) !== null) {
        return pointer;
    }

    return null;
}

/**
 * Validate a JSON Pointer string without parsing.
 *
 * @param pointer - String to validate
 * @returns true if valid JSON Pointer syntax
 *
 * @example
 * isValidJsonPointer('/foo/bar')  // true
 * isValidJsonPointer('')          // true
 * isValidJsonPointer('foo')       // false (missing leading /)
 * isValidJsonPointer('/~2')       // false (invalid escape)
 *
 * @see https://www.rfc-editor.org/rfc/rfc6901.html#section-3
 */
// RFC 6901 §3: Syntax validation
export function isValidJsonPointer(pointer: string): boolean {
    return parseJsonPointer(pointer) !== null;
}
