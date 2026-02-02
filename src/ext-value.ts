/**
 * RFC 8187 extended parameter value encoding/decoding.
 * RFC 8187 §3.2, §3.2.1.
 * @see https://www.rfc-editor.org/rfc/rfc8187.html#section-3.2
 */

import type { ExtValue, ExtValueOptions } from './types.js';

/**
 * RFC 8187 §3.2.1: attr-char characters that don't need percent-encoding.
 * attr-char = ALPHA / DIGIT / "!" / "#" / "$" / "&" / "+" / "-" / "."
 *           / "^" / "_" / "`" / "|" / "~"
 * (token except "*" / "'" / "%")
 */
const ATTR_CHAR = /^[A-Za-z0-9!#$&+\-.^_`|~]$/;

/**
 * Check if a character is a valid attr-char per RFC 8187 §3.2.1.
 *
 * @param char - Single character to check
 * @returns True if char is attr-char
 */
// RFC 8187 §3.2.1: attr-char validation.
export function isAttrChar(char: string): boolean {
    return char.length === 1 && ATTR_CHAR.test(char);
}

/**
 * Check if a string needs extended encoding (contains non-ASCII or non-attr-char).
 *
 * @param value - String to check
 * @returns True if extended encoding is needed
 */
// RFC 8187 §3.2: Determine if ext-value encoding is required.
export function needsExtendedEncoding(value: string): boolean {
    for (const char of value) {
        const code = char.charCodeAt(0);
        // Non-ASCII needs encoding
        if (code > 0x7f) {
            return true;
        }
        // Non-attr-char ASCII needs encoding
        if (!ATTR_CHAR.test(char)) {
            return true;
        }
    }
    return false;
}

/**
 * Decode an RFC 8187 ext-value (charset'language'value-chars).
 *
 * Returns null for malformed input to allow fallback to non-extended value.
 *
 * @param encoded - The ext-value string (e.g., "UTF-8'en'%C2%A3%20rates")
 * @returns Decoded ExtValue or null if malformed
 */
// RFC 8187 §3.2.1: Extended parameter value decoding.
export function decodeExtValue(encoded: string): ExtValue | null {
    // RFC 8187 §3.2.1: ext-value cannot use quoted-string notation.
    // Double-quotes are not valid in charset, language, or value-chars.
    if (encoded.includes('"')) {
        return null;
    }

    // Split on single quotes - format is charset'language'value-chars
    const firstQuote = encoded.indexOf("'");
    if (firstQuote === -1) {
        return null;
    }

    const secondQuote = encoded.indexOf("'", firstQuote + 1);
    if (secondQuote === -1) {
        return null;
    }

    const charset = encoded.slice(0, firstQuote);
    const language = encoded.slice(firstQuote + 1, secondQuote);
    const valueChars = encoded.slice(secondQuote + 1);

    // RFC 8187 §3.2: charset MUST NOT be omitted
    if (!charset) {
        return null;
    }

    // Decode percent-encoded value
    let decoded: string;
    try {
        decoded = decodeURIComponent(valueChars);
    } catch {
        // RFC 8187 §3.2.1: Handle encoding errors robustly
        return null;
    }

    // RFC 8187 §3.2.1: charset is case-insensitive, normalize to lowercase
    return {
        charset: charset.toLowerCase(),
        language: language || undefined,
        value: decoded,
    };
}

/**
 * Encode a string as RFC 8187 ext-value (UTF-8'language'value-chars).
 *
 * Per RFC 8187 §3.2.1, producers MUST use UTF-8 encoding.
 *
 * @param value - String to encode
 * @param options - Encoding options (language tag)
 * @returns Encoded ext-value string
 */
// RFC 8187 §3.2: Extended parameter encoding.
export function encodeExtValue(value: string, options: ExtValueOptions = {}): string {
    const language = options.language ?? '';

    // Build percent-encoded value, preserving attr-char
    let encoded = '';
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);

    for (const byte of bytes) {
        const char = String.fromCharCode(byte);
        if (ATTR_CHAR.test(char)) {
            encoded += char;
        } else {
            // Percent-encode with uppercase hex per RFC 3986 §2.1
            encoded += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
        }
    }

    return `UTF-8'${language}'${encoded}`;
}
