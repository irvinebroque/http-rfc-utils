/**
 * Digest field types.
 * RFC 9530.
 * @see https://www.rfc-editor.org/rfc/rfc9530.html
 */

/**
 * Active digest algorithms suitable for adversarial settings.
 * RFC 9530 Section 5, Section 7.2.
 */
export type DigestAlgorithm = 'sha-256' | 'sha-512';

/**
 * All recognized algorithms including deprecated ones.
 * RFC 9530 Section 5, Section 7.2.
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
 * RFC 9530 Section 2, Section 3.
 */
export interface Digest {
    algorithm: string;
    value: Uint8Array;
}

/**
 * A digest preference from Want-Content-Digest or Want-Repr-Digest fields.
 * RFC 9530 Section 4.
 */
export interface DigestPreference {
    algorithm: string;
    weight: number;
}
