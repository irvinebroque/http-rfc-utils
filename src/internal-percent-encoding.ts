/**
 * Internal percent-encoding byte helpers for URI and header modules.
 *
 * Keeps `%HH` formatting and hex validation logic centralized so callers share
 * consistent uppercase output and tolerant parsing checks.
 * @internal
 */

const HEX_UPPER = '0123456789ABCDEF';

/**
 * Return true when the byte value is an ASCII hex digit.
 */
export function isHexDigitByte(byte: number): boolean {
    return (byte >= 0x30 && byte <= 0x39)
        || (byte >= 0x41 && byte <= 0x46)
        || (byte >= 0x61 && byte <= 0x66);
}

/**
 * Return true when the string is exactly one ASCII hex digit.
 */
export function isHexDigit(char: string): boolean {
    if (char.length !== 1) {
        return false;
    }
    return isHexDigitByte(char.charCodeAt(0));
}

/**
 * Normalize an ASCII hex digit byte to its uppercase character form.
 */
export function toUpperHexChar(byte: number): string {
    if (byte >= 0x61 && byte <= 0x66) {
        return String.fromCharCode(byte - 0x20);
    }
    return String.fromCharCode(byte);
}

/**
 * Append a `%HH` escape sequence for one byte to an output part list.
 */
export function pushPercentEncodedByte(parts: string[], byte: number): void {
    parts.push('%', HEX_UPPER[(byte >> 4) & 0x0f]!, HEX_UPPER[byte & 0x0f]!);
}

/**
 * Format one byte as `%HH` using uppercase hex digits.
 */
export function formatPercentEncodedByte(byte: number): string {
    return `%${HEX_UPPER[(byte >> 4) & 0x0f]!}${HEX_UPPER[byte & 0x0f]!}`;
}
