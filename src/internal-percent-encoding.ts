const HEX_UPPER = '0123456789ABCDEF';

export function isHexDigitByte(byte: number): boolean {
    return (byte >= 0x30 && byte <= 0x39)
        || (byte >= 0x41 && byte <= 0x46)
        || (byte >= 0x61 && byte <= 0x66);
}

export function isHexDigit(char: string): boolean {
    if (char.length !== 1) {
        return false;
    }
    return isHexDigitByte(char.charCodeAt(0));
}

export function toUpperHexChar(byte: number): string {
    if (byte >= 0x61 && byte <= 0x66) {
        return String.fromCharCode(byte - 0x20);
    }
    return String.fromCharCode(byte);
}

export function pushPercentEncodedByte(parts: string[], byte: number): void {
    parts.push('%', HEX_UPPER[(byte >> 4) & 0x0f]!, HEX_UPPER[byte & 0x0f]!);
}

export function formatPercentEncodedByte(byte: number): string {
    return `%${HEX_UPPER[(byte >> 4) & 0x0f]!}${HEX_UPPER[byte & 0x0f]!}`;
}
