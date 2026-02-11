/**
 * Digest Fields per RFC 9530.
 * RFC 9530 §2, §3, §4, §5.
 * @see https://www.rfc-editor.org/rfc/rfc9530.html
 *
 * Provides Content-Digest and Repr-Digest HTTP header field parsing/formatting
 * for content and representation integrity verification. Also provides
 * Want-Content-Digest and Want-Repr-Digest preference fields.
 */

import { parseSfDict, serializeSfDict } from './structured-fields.js';
import type { SfDictionary, SfItem } from './types.js';
import { encodeUtf8, toUint8ArrayView } from './internal-unicode.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Active digest algorithms suitable for adversarial settings.
 * RFC 9530 §5, §7.2.
 */
export type DigestAlgorithm = 'sha-256' | 'sha-512';

/**
 * All recognized algorithms including deprecated ones.
 * RFC 9530 §5, §7.2.
 * Deprecated algorithms MAY be used for backward compatibility but
 * MUST NOT be used in adversarial settings.
 */
export type DigestAlgorithmAny =
    | DigestAlgorithm
    | 'md5'
    | 'sha'
    | 'unixsum'
    | 'unixcksum'
    | 'adler'
    | 'crc32c';

/**
 * A parsed digest value from Content-Digest or Repr-Digest fields.
 * RFC 9530 §2, §3.
 */
export interface Digest {
    /** Algorithm key (lowercase) */
    algorithm: string;
    /** Raw digest bytes */
    value: Uint8Array;
}

/**
 * A digest preference from Want-Content-Digest or Want-Repr-Digest fields.
 * RFC 9530 §4.
 */
export interface DigestPreference {
    /** Algorithm key (lowercase) */
    algorithm: string;
    /**
     * Preference weight (0-10).
     * 0 = not acceptable, 1 = least preferred, 10 = most preferred.
     */
    weight: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Algorithm classification constants.
 * RFC 9530 §5, §7.2.
 */
export const DIGEST_ALGORITHMS = {
    /** Algorithms suitable for adversarial settings */
    active: ['sha-256', 'sha-512'] as const,
    /** Algorithms that MUST NOT be used in adversarial settings */
    deprecated: ['md5', 'sha', 'unixsum', 'unixcksum', 'adler', 'crc32c'] as const,
} as const;

// =============================================================================
// Algorithm Helpers
// =============================================================================

/**
 * Check if an algorithm is active (suitable for adversarial settings).
 * RFC 9530 §5.
 */
export function isActiveAlgorithm(algorithm: string): algorithm is DigestAlgorithm {
    return (DIGEST_ALGORITHMS.active as readonly string[]).includes(algorithm.toLowerCase());
}

/**
 * Check if an algorithm is deprecated.
 * RFC 9530 §5.
 */
export function isDeprecatedAlgorithm(algorithm: string): boolean {
    return (DIGEST_ALGORITHMS.deprecated as readonly string[]).includes(algorithm.toLowerCase());
}

// =============================================================================
// Parsing
// =============================================================================

/**
 * Parse digest values from a structured field dictionary.
 * Returns null for malformed input.
 */
function parseDigestField(value: string): Digest[] | null {
    const dict = parseSfDict(value);
    if (!dict) {
        return null;
    }

    const digests: Digest[] = [];

    for (const [algorithm, item] of Object.entries(dict)) {
        // RFC 9530 §2, §3: value is a Byte Sequence
        if ('items' in item) {
            // Inner list not valid for digest values
            continue;
        }

        const sfItem = item as SfItem;
        if (!(sfItem.value instanceof Uint8Array)) {
            // Must be a byte sequence
            continue;
        }

        digests.push({
            algorithm: algorithm.toLowerCase(),
            value: sfItem.value,
        });
    }

    return digests.length > 0 ? digests : [];
}

/**
 * Parse Content-Digest header field value.
 * RFC 9530 §2.
 *
 * @param value - The Content-Digest header value
 * @returns Array of digests, or null if malformed
 *
 * @example
 * ```ts
 * const digests = parseContentDigest('sha-256=:abc123...:');
 * ```
 */
export function parseContentDigest(value: string): Digest[] | null {
    return parseDigestField(value);
}

/**
 * Parse Repr-Digest header field value.
 * RFC 9530 §3.
 *
 * @param value - The Repr-Digest header value
 * @returns Array of digests, or null if malformed
 *
 * @example
 * ```ts
 * const digests = parseReprDigest('sha-512=:xyz789...:');
 * ```
 */
export function parseReprDigest(value: string): Digest[] | null {
    return parseDigestField(value);
}

/**
 * Parse digest preference values from a structured field dictionary.
 * Returns null for malformed input.
 */
function parseWantDigestField(value: string): DigestPreference[] | null {
    const dict = parseSfDict(value);
    if (!dict) {
        return null;
    }

    const preferences: DigestPreference[] = [];

    for (const [algorithm, item] of Object.entries(dict)) {
        // RFC 9530 §4: value is an Integer 0-10
        if ('items' in item) {
            // Inner list not valid for preferences
            continue;
        }

        const sfItem = item as SfItem;
        if (typeof sfItem.value !== 'number') {
            // Must be an integer
            continue;
        }

        const weight = sfItem.value;
        // RFC 9530 §4: must be in range 0 to 10 inclusive
        if (!Number.isInteger(weight) || weight < 0 || weight > 10) {
            continue;
        }

        preferences.push({
            algorithm: algorithm.toLowerCase(),
            weight,
        });
    }

    return preferences.length > 0 ? preferences : [];
}

/**
 * Parse Want-Content-Digest header field value.
 * RFC 9530 §4.
 *
 * @param value - The Want-Content-Digest header value
 * @returns Array of preferences, or null if malformed
 *
 * @example
 * ```ts
 * const prefs = parseWantContentDigest('sha-256=10, sha-512=3');
 * ```
 */
export function parseWantContentDigest(value: string): DigestPreference[] | null {
    return parseWantDigestField(value);
}

/**
 * Parse Want-Repr-Digest header field value.
 * RFC 9530 §4.
 *
 * @param value - The Want-Repr-Digest header value
 * @returns Array of preferences, or null if malformed
 *
 * @example
 * ```ts
 * const prefs = parseWantReprDigest('sha-512=3, sha-256=10, unixsum=0');
 * ```
 */
export function parseWantReprDigest(value: string): DigestPreference[] | null {
    return parseWantDigestField(value);
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format digests as a structured field dictionary string.
 */
function formatDigestField(digests: Digest[]): string {
    const dict: SfDictionary = {};

    for (const digest of digests) {
        // RFC 9530 §5: MUST NOT generate deprecated algorithms
        // But we allow formatting any algorithm the caller provides
        dict[digest.algorithm] = { value: digest.value };
    }

    return serializeSfDict(dict);
}

/**
 * Format Content-Digest header field value.
 * RFC 9530 §2.
 *
 * @param digests - Array of digests to format
 * @returns Formatted header value
 *
 * @example
 * ```ts
 * const header = formatContentDigest([
 *     { algorithm: 'sha-256', value: digestBytes }
 * ]);
 * ```
 */
export function formatContentDigest(digests: Digest[]): string {
    return formatDigestField(digests);
}

/**
 * Format Repr-Digest header field value.
 * RFC 9530 §3.
 *
 * @param digests - Array of digests to format
 * @returns Formatted header value
 *
 * @example
 * ```ts
 * const header = formatReprDigest([
 *     { algorithm: 'sha-512', value: digestBytes }
 * ]);
 * ```
 */
export function formatReprDigest(digests: Digest[]): string {
    return formatDigestField(digests);
}

/**
 * Format preferences as a structured field dictionary string.
 */
function formatWantDigestField(preferences: DigestPreference[]): string {
    const dict: SfDictionary = {};

    for (const pref of preferences) {
        // RFC 9530 §4: weight is an Integer 0-10
        if (pref.weight < 0 || pref.weight > 10 || !Number.isInteger(pref.weight)) {
            continue;
        }
        dict[pref.algorithm] = { value: pref.weight };
    }

    return serializeSfDict(dict);
}

/**
 * Format Want-Content-Digest header field value.
 * RFC 9530 §4.
 *
 * @param preferences - Array of preferences to format
 * @returns Formatted header value
 *
 * @example
 * ```ts
 * const header = formatWantContentDigest([
 *     { algorithm: 'sha-256', weight: 10 },
 *     { algorithm: 'sha-512', weight: 3 }
 * ]);
 * ```
 */
export function formatWantContentDigest(preferences: DigestPreference[]): string {
    return formatWantDigestField(preferences);
}

/**
 * Format Want-Repr-Digest header field value.
 * RFC 9530 §4.
 *
 * @param preferences - Array of preferences to format
 * @returns Formatted header value
 *
 * @example
 * ```ts
 * const header = formatWantReprDigest([
 *     { algorithm: 'sha-512', weight: 3 },
 *     { algorithm: 'sha-256', weight: 10 },
 *     { algorithm: 'unixsum', weight: 0 }
 * ]);
 * ```
 */
export function formatWantReprDigest(preferences: DigestPreference[]): string {
    return formatWantDigestField(preferences);
}

// =============================================================================
// Generation and Verification
// =============================================================================

/**
 * Map algorithm keys to Web Crypto algorithm names.
 */
const CRYPTO_ALGORITHMS: Record<DigestAlgorithm, string> = {
    'sha-256': 'SHA-256',
    'sha-512': 'SHA-512',
};

/**
 * Compare two byte arrays without early exit on mismatch.
 */
function constantTimeEqualBytes(expected: Uint8Array, actual: Uint8Array): boolean {
    let diff = expected.length ^ actual.length;
    const maxLength = Math.max(expected.length, actual.length);

    for (let i = 0; i < maxLength; i++) {
        const expectedByte = i < expected.length ? expected[i] : 0;
        const actualByte = i < actual.length ? actual[i] : 0;
        diff |= expectedByte ^ actualByte;
    }

    return diff === 0;
}

/**
 * Generate a digest for the given data.
 * RFC 9530 §2, §3.
 *
 * Uses Web Crypto API for hashing. Only active algorithms are supported
 * for generation per RFC 9530 §5.
 *
 * @param data - Data to hash (string, ArrayBuffer, or ArrayBufferView)
 * @param algorithm - Hash algorithm (default: 'sha-256')
 * @returns Promise resolving to digest
 * @throws Error if algorithm is not supported for generation
 *
 * @example
 * ```ts
 * const digest = await generateDigest('hello world');
 * const headers = { 'Content-Digest': formatContentDigest([digest]) };
 * ```
 */
export async function generateDigest(
    data: string | ArrayBuffer | ArrayBufferView,
    algorithm: DigestAlgorithm = 'sha-256'
): Promise<Digest> {
    const cryptoAlgorithm = CRYPTO_ALGORITHMS[algorithm];
    if (!cryptoAlgorithm) {
        throw new Error(`Unsupported algorithm for generation: ${algorithm}`);
    }

    let input: BufferSource;

    if (typeof data === 'string') {
        input = encodeUtf8(data);
    } else if (data instanceof ArrayBuffer) {
        input = data;
    } else {
        // ArrayBufferView - copy to avoid observing caller mutations during hashing
        input = toUint8ArrayView(data).slice();
    }

    const hashBuffer = await globalThis.crypto.subtle.digest(cryptoAlgorithm, input);

    return {
        algorithm,
        value: new Uint8Array(hashBuffer),
    };
}

/**
 * Verify a digest against the given data.
 * RFC 9530 §2, §3.
 *
 * Only active algorithms (sha-256, sha-512) can be verified.
 * Deprecated algorithms will return false.
 *
 * @param data - Data to verify
 * @param digest - Digest to check against
 * @returns Promise resolving to true if digest matches
 *
 * @example
 * ```ts
 * const digests = parseContentDigest(headers.get('Content-Digest'));
 * const sha256 = digests?.find(d => d.algorithm === 'sha-256');
 * if (sha256 && await verifyDigest(content, sha256)) {
 *     // Content integrity verified
 * }
 * ```
 */
export async function verifyDigest(
    data: string | ArrayBuffer | ArrayBufferView,
    digest: Digest
): Promise<boolean> {
    // RFC 9530 §5: deprecated algorithms should not be used for verification
    // in adversarial settings, but we allow it for backward compatibility
    if (!isActiveAlgorithm(digest.algorithm)) {
        // Cannot verify deprecated algorithms
        return false;
    }

    const computed = await generateDigest(data, digest.algorithm);
    return constantTimeEqualBytes(computed.value, digest.value);
}
