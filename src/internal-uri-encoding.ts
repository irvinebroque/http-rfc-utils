/**
 * Shared URI percent-encoding helpers for RFC 3986-oriented modules.
 * RFC 3986 §2.1-§2.4.
 * @see https://www.rfc-editor.org/rfc/rfc3986.html
 * @internal
 */

import {
    isHexDigitByte,
    pushPercentEncodedByte,
    toUpperHexChar,
} from './internal-percent-encoding.js';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

/**
 * Build a fast ASCII allowlist table indexed by byte value.
 */
export function createAsciiAllowTable(chars: string): ReadonlyArray<boolean> {
    const table = Array<boolean>(128).fill(false);
    for (let index = 0; index < chars.length; index++) {
        const code = chars.charCodeAt(index);
        if (code < 128) {
            table[code] = true;
        }
    }
    return table;
}

/**
 * Percent-encode a UTF-8 string with configurable RFC 3986 policy controls.
 */
export function encodeRfc3986(
    value: string,
    options: {
        allowTable: ReadonlyArray<boolean>;
        preservePctTriplets: boolean;
        normalizePctHexUppercase: boolean;
    },
): string {
    if (!value) {
        return '';
    }

    const { allowTable, preservePctTriplets, normalizePctHexUppercase } = options;
    const bytes = UTF8_ENCODER.encode(value);
    const parts: string[] = [];

    let index = 0;
    while (index < bytes.length) {
        const byte = bytes[index];
        if (byte === undefined) {
            break;
        }

        if (byte < 128 && allowTable[byte] === true) {
            parts.push(String.fromCharCode(byte));
            index++;
            continue;
        }

        if (preservePctTriplets && byte === 0x25 && index + 2 < bytes.length) {
            const hex1 = bytes[index + 1]!;
            const hex2 = bytes[index + 2]!;
            if (isHexDigitByte(hex1) && isHexDigitByte(hex2)) {
                if (normalizePctHexUppercase) {
                    parts.push('%', toUpperHexChar(hex1), toUpperHexChar(hex2));
                } else {
                    parts.push('%', String.fromCharCode(hex1), String.fromCharCode(hex2));
                }
                index += 3;
                continue;
            }
        }

        pushPercentEncodedByte(parts, byte);
        index++;
    }

    return parts.join('');
}

/**
 * Decode percent-encoded UTF-8 bytes into a string.
 * Returns null for malformed escapes or invalid UTF-8.
 */
export function decodePercentComponent(value: string): string | null {
    if (!value.includes('%')) {
        return value;
    }

    const bytes: number[] = [];
    let index = 0;

    while (index < value.length) {
        const char = value[index];
        if (char === '%' && index + 2 < value.length) {
            const hex1 = value[index + 1];
            const hex2 = value[index + 2];
            if (
                hex1 !== undefined
                && hex2 !== undefined
                && isHexDigitByte(hex1.charCodeAt(0))
                && isHexDigitByte(hex2.charCodeAt(0))
            ) {
                bytes.push(parseInt(`${hex1}${hex2}`, 16));
                index += 3;
                continue;
            }
            return null;
        }

        if (char === '%') {
            return null;
        }

        const codePoint = value.codePointAt(index);
        if (codePoint === undefined) {
            break;
        }

        if (codePoint <= 0x7f) {
            bytes.push(codePoint);
            index += 1;
            continue;
        }

        const encoded = UTF8_ENCODER.encode(String.fromCodePoint(codePoint));
        for (const byte of encoded) {
            bytes.push(byte);
        }
        index += codePoint > 0xffff ? 2 : 1;
    }

    try {
        return UTF8_DECODER.decode(new Uint8Array(bytes));
    } catch {
        return null;
    }
}
