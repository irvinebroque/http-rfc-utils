/**
 * Shared UTF-8 and surrogate helpers for internal modules.
 * @internal
 */

const UTF8_ENCODER = new TextEncoder();

export function hasLoneSurrogate(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
        const codeUnit = value.charCodeAt(index);

        if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
            if (index + 1 >= value.length) {
                return true;
            }

            const nextCodeUnit = value.charCodeAt(index + 1);
            if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) {
                return true;
            }

            index += 1;
            continue;
        }

        if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
            return true;
        }
    }

    return false;
}

export function encodeUtf8(value: string): Uint8Array {
    return UTF8_ENCODER.encode(value);
}

export function toUint8ArrayView(value: ArrayBuffer | ArrayBufferView): Uint8Array {
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
