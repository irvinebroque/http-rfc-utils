/**
 * ETag utilities per RFC 9110.
 * RFC 9110 §8.8.3, §8.8.3.2.
 * @see https://httpwg.org/specs/rfc9110.html#field.etag
 */

import type { ETag } from './types.js';
import { encodeUtf8, toUint8ArrayView } from './internal-unicode.js';

export type { ETag } from './types.js';

const MAX_ETAG_CHAR = 0xFF;

// RFC 9110 §8.8.3: etagc character set validation.
function isValidETagValue(value: string): boolean {
    for (const char of value) {
        const code = char.codePointAt(0);
        if (code === undefined) {
            return false;
        }
        if (code > MAX_ETAG_CHAR) {
            return false;
        }
        if (code === 0x21) {
            continue;
        }
        if (code >= 0x23 && code <= 0x7E) {
            continue;
        }
        if (code >= 0x80 && code <= 0xFF) {
            continue;
        }
        return false;
    }

    return true;
}

/**
 * Simple djb2 hash algorithm for sync ETag generation
 */
function djb2Hash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    // Convert to unsigned 32-bit integer and then to hex
    return (hash >>> 0).toString(16);
}

function djb2HashBytes(bytes: Uint8Array): string {
    let hash = 5381;
    for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) + hash) ^ bytes[i]!;
    }
    return (hash >>> 0).toString(16);
}

/**
 * Convert data to a string representation for hashing
 */
function dataToString(data: unknown): string {
    if (typeof data === 'string') {
        return data;
    }
    return JSON.stringify(data) ?? String(data);
}

function asByteView(data: unknown): Uint8Array | null {
    if (data instanceof ArrayBuffer) {
        return toUint8ArrayView(data);
    }
    if (ArrayBuffer.isView(data)) {
        return toUint8ArrayView(data);
    }
    return null;
}

function toBufferSource(data: ArrayBuffer | ArrayBufferView): BufferSource {
    if (data instanceof ArrayBuffer) {
        return data;
    }

    const bytes = toUint8ArrayView(data);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy;
}

/**
 * Generate a simple ETag from data (sync, using string hash)
 * Uses a simple hash algorithm suitable for most use cases.
 * Returns format: "hash" (strong) or W/"hash" (if weak option specified)
 */
// RFC 9110 §8.8.3: Entity-tag field-value formatting.
export function generateETag(data: unknown, options?: { weak?: boolean }): string {
    const byteView = asByteView(data);
    const hash = byteView ? djb2HashBytes(byteView) : djb2Hash(dataToString(data));
    const weak = options?.weak ?? false;
    return weak ? `W/"${hash}"` : `"${hash}"`;
}

/**
 * Generate an ETag using Web Crypto API (async, more secure)
 * Uses SHA-256 by default.
 */
// RFC 9110 §8.8.3: Entity-tag field-value formatting.
export async function generateETagAsync(
    data: unknown,
    options?: { algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'; weak?: boolean }
): Promise<string> {
    const algorithm = options?.algorithm ?? 'SHA-256';
    const weak = options?.weak ?? false;

    let dataBuffer: BufferSource;

    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        dataBuffer = toBufferSource(data);
    } else {
        const str = dataToString(data);
        dataBuffer = encodeUtf8(str).slice();
    }

    const hashBuffer = await globalThis.crypto.subtle.digest(algorithm, dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Use first 16 bytes (32 hex chars) for reasonable length
    const hash = hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');

    return weak ? `W/"${hash}"` : `"${hash}"`;
}

/**
 * Parse an ETag string into its components
 * Handles: "abc", W/"abc", ""
 * Returns null for invalid format
 */
// RFC 9110 §8.8.3: Entity-tag field parsing.
export function parseETag(etag: string): ETag | null {
    if (!etag) {
        return null;
    }

    const trimmed = etag.trim();

    // Check for weak prefix
    let weak = false;
    let rest = trimmed;

    if (trimmed.startsWith('W/')) {
        weak = true;
        rest = trimmed.slice(2);
    }

    // Must be quoted
    if (!rest.startsWith('"') || !rest.endsWith('"')) {
        return null;
    }

    // Extract value (everything between the quotes)
    const value = rest.slice(1, -1);

    // Value cannot contain unescaped quotes
    // Per RFC 9110, etagc = %x21 / %x23-7E / obs-text (no DQUOTE = %x22)
    if (value.includes('"')) {
        return null;
    }

    if (!isValidETagValue(value)) {
        return null;
    }

    return { weak, value };
}

/**
 * Format an ETag object back to string
 */
// RFC 9110 §8.8.3: Entity-tag field formatting.
export function formatETag(etag: ETag): string {
    if (!isValidETagValue(etag.value)) {
        throw new Error(`Invalid ETag value: ${etag.value}`);
    }
    return etag.weak ? `W/"${etag.value}"` : `"${etag.value}"`;
}

/**
 * Compare two ETags per RFC 9110 §8.8.3.
 *
 * Strong comparison: both must be strong AND values match
 * Weak comparison: values match (regardless of weak/strong)
 *
 * RFC 9110 §8.8.3.2 comparison table:
 * | ETag 1  | ETag 2  | Strong | Weak  |
 * |---------|---------|--------|-------|
 * | W/"1"   | W/"1"   | false  | true  |
 * | W/"1"   | "1"     | false  | true  |
 * | "1"     | "1"     | true   | true  |
 * | "1"     | W/"1"   | false  | true  |
 * | W/"1"   | W/"2"   | false  | false |
 * | "1"     | "2"     | false  | false |
 */
export function compareETags(a: ETag, b: ETag, strong: boolean = false): boolean {
    // Values must always match
    if (a.value !== b.value) {
        return false;
    }

    // For weak comparison, value match is sufficient
    if (!strong) {
        return true;
    }

    // For strong comparison, both must be strong (not weak)
    return !a.weak && !b.weak;
}

/**
 * Convenience function to compare ETag strings directly
 */
// RFC 9110 §8.8.3.2: Strong/weak comparison via parsed entity-tags.
export function compareETagStrings(a: string, b: string, strong: boolean = false): boolean {
    const parsedA = parseETag(a);
    const parsedB = parseETag(b);

    if (!parsedA || !parsedB) {
        return false;
    }

    return compareETags(parsedA, parsedB, strong);
}
