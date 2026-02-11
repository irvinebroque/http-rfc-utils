/**
 * Tests for digest behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseContentDigest,
    parseReprDigest,
    parseWantContentDigest,
    parseWantReprDigest,
    formatContentDigest,
    formatReprDigest,
    formatWantContentDigest,
    formatWantReprDigest,
    generateDigest,
    verifyDigest,
    DIGEST_ALGORITHMS,
    isActiveAlgorithm,
    isDeprecatedAlgorithm,
} from '../src/digest.js';

// RFC 9530 Appendix D sample values for "hello world"
const HELLO_WORLD = 'hello world';
const HELLO_WORLD_SHA256_BASE64 = 'uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=';
const HELLO_WORLD_SHA512_BASE64 = 'MJ7MSJwS1utMxA9QyQLytNDtd+5RGnx6m808qG1M2G+YndNbxf9JlnDaNCVbRbDP2DDoH2Bdz33FVC6TrpzXbw==';

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// RFC 9530 §2, §3, §4, §5: Digest Fields parsing, formatting, and verification.
describe('RFC 9530 Digest Fields (§2-§5, Appendix D)', () => {
    // RFC 9530 §5: Hash algorithm status and identification.
    describe('Algorithm Identification', () => {
        it('identifies active algorithms', () => {
            assert.equal(isActiveAlgorithm('sha-256'), true);
            assert.equal(isActiveAlgorithm('sha-512'), true);
            assert.equal(isActiveAlgorithm('SHA-256'), true); // case-insensitive
            assert.equal(isActiveAlgorithm('SHA-512'), true);
        });

        it('identifies deprecated algorithms', () => {
            assert.equal(isDeprecatedAlgorithm('md5'), true);
            assert.equal(isDeprecatedAlgorithm('sha'), true);
            assert.equal(isDeprecatedAlgorithm('unixsum'), true);
            assert.equal(isDeprecatedAlgorithm('unixcksum'), true);
            assert.equal(isDeprecatedAlgorithm('adler'), true);
            assert.equal(isDeprecatedAlgorithm('crc32c'), true);
            assert.equal(isDeprecatedAlgorithm('MD5'), true); // case-insensitive
        });

        it('rejects unknown algorithms as non-active', () => {
            assert.equal(isActiveAlgorithm('md5'), false);
            assert.equal(isActiveAlgorithm('unknown'), false);
        });

        it('rejects active algorithms as non-deprecated', () => {
            assert.equal(isDeprecatedAlgorithm('sha-256'), false);
            assert.equal(isDeprecatedAlgorithm('sha-512'), false);
        });

        it('DIGEST_ALGORITHMS has correct values', () => {
            assert.deepEqual(DIGEST_ALGORITHMS.active, ['sha-256', 'sha-512']);
            assert.deepEqual(DIGEST_ALGORITHMS.deprecated, ['md5', 'sha', 'unixsum', 'unixcksum', 'adler', 'crc32c']);
        });
    });

    // RFC 9530 §2: Content-Digest field parsing.
    describe('parseContentDigest', () => {
        it('parses single algorithm', () => {
            const result = parseContentDigest(`sha-256=:${HELLO_WORLD_SHA256_BASE64}:`);
            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].algorithm, 'sha-256');
            assert.deepEqual(result[0].value, base64ToUint8Array(HELLO_WORLD_SHA256_BASE64));
        });

        it('parses multiple algorithms', () => {
            const result = parseContentDigest(
                `sha-256=:${HELLO_WORLD_SHA256_BASE64}:, sha-512=:${HELLO_WORLD_SHA512_BASE64}:`
            );
            assert.ok(result);
            assert.equal(result.length, 2);
            assert.equal(result[0].algorithm, 'sha-256');
            assert.equal(result[1].algorithm, 'sha-512');
        });

        // RFC 8941 §3.1.2: Dictionary keys MUST be lowercase
        it('rejects uppercase algorithm names (per RFC 8941)', () => {
            // Structured field keys must be lowercase per RFC 8941
            const result = parseContentDigest(`SHA-256=:${HELLO_WORLD_SHA256_BASE64}:`);
            // This returns null because uppercase keys are invalid per RFC 8941
            assert.equal(result, null);
        });

        it('returns empty array for empty input', () => {
            const result = parseContentDigest('');
            assert.deepEqual(result, []);
        });

        it('returns null for malformed input', () => {
            const result = parseContentDigest('not valid structured fields {{}}');
            assert.equal(result, null);
        });

        it('skips non-byte-sequence values', () => {
            // If someone mistakenly sends a string instead of byte sequence
            const result = parseContentDigest('sha-256="not a byte sequence"');
            assert.ok(result);
            assert.equal(result.length, 0);
        });
    });

    // RFC 9530 §3: Repr-Digest field parsing.
    describe('parseReprDigest', () => {
        it('parses single algorithm', () => {
            const result = parseReprDigest(`sha-512=:${HELLO_WORLD_SHA512_BASE64}:`);
            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].algorithm, 'sha-512');
        });

        it('parses multiple algorithms', () => {
            const result = parseReprDigest(
                `sha-256=:${HELLO_WORLD_SHA256_BASE64}:, sha-512=:${HELLO_WORLD_SHA512_BASE64}:`
            );
            assert.ok(result);
            assert.equal(result.length, 2);
        });
    });

    // RFC 9530 §4: Want-Content-Digest preference parsing.
    describe('parseWantContentDigest', () => {
        it('parses single preference', () => {
            const result = parseWantContentDigest('sha-256=1');
            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].algorithm, 'sha-256');
            assert.equal(result[0].weight, 1);
        });

        it('parses multiple preferences', () => {
            const result = parseWantContentDigest('sha-512=3, sha-256=10, unixsum=0');
            assert.ok(result);
            assert.equal(result.length, 3);
            assert.equal(result[0].algorithm, 'sha-512');
            assert.equal(result[0].weight, 3);
            assert.equal(result[1].algorithm, 'sha-256');
            assert.equal(result[1].weight, 10);
            assert.equal(result[2].algorithm, 'unixsum');
            assert.equal(result[2].weight, 0);
        });

        it('accepts weight 0 (not acceptable)', () => {
            const result = parseWantContentDigest('md5=0');
            assert.ok(result);
            assert.equal(result[0].weight, 0);
        });

        it('accepts weight 10 (most preferred)', () => {
            const result = parseWantContentDigest('sha-256=10');
            assert.ok(result);
            assert.equal(result[0].weight, 10);
        });

        it('skips weights outside 0-10 range', () => {
            const result = parseWantContentDigest('sha-256=11');
            assert.ok(result);
            assert.equal(result.length, 0);
        });

        it('skips negative weights', () => {
            const result = parseWantContentDigest('sha-256=-1');
            assert.ok(result);
            assert.equal(result.length, 0);
        });

        it('skips non-integer weights', () => {
            const result = parseWantContentDigest('sha-256=5.5');
            assert.ok(result);
            assert.equal(result.length, 0);
        });
    });

    // RFC 9530 §4: Want-Repr-Digest preference parsing.
    describe('parseWantReprDigest', () => {
        it('parses preferences', () => {
            const result = parseWantReprDigest('sha-256=1');
            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].algorithm, 'sha-256');
            assert.equal(result[0].weight, 1);
        });

        // RFC 9530 §4 example
        it('parses RFC 9530 example', () => {
            const result = parseWantReprDigest('sha-512=3, sha-256=10, unixsum=0');
            assert.ok(result);
            assert.equal(result.length, 3);
        });
    });

    // RFC 9530 §2: Content-Digest field formatting.
    describe('formatContentDigest', () => {
        it('formats single digest', () => {
            const digest = {
                algorithm: 'sha-256',
                value: base64ToUint8Array(HELLO_WORLD_SHA256_BASE64),
            };
            const result = formatContentDigest([digest]);
            assert.equal(result, `sha-256=:${HELLO_WORLD_SHA256_BASE64}:`);
        });

        it('formats multiple digests', () => {
            const digests = [
                { algorithm: 'sha-256', value: base64ToUint8Array(HELLO_WORLD_SHA256_BASE64) },
                { algorithm: 'sha-512', value: base64ToUint8Array(HELLO_WORLD_SHA512_BASE64) },
            ];
            const result = formatContentDigest(digests);
            assert.ok(result.includes('sha-256=:'));
            assert.ok(result.includes('sha-512=:'));
        });
    });

    // RFC 9530 §3: Repr-Digest field formatting.
    describe('formatReprDigest', () => {
        it('formats single digest', () => {
            const digest = {
                algorithm: 'sha-512',
                value: base64ToUint8Array(HELLO_WORLD_SHA512_BASE64),
            };
            const result = formatReprDigest([digest]);
            assert.equal(result, `sha-512=:${HELLO_WORLD_SHA512_BASE64}:`);
        });
    });

    // RFC 9530 §4: Want-Content-Digest field formatting.
    describe('formatWantContentDigest', () => {
        it('formats single preference', () => {
            const result = formatWantContentDigest([{ algorithm: 'sha-256', weight: 1 }]);
            assert.equal(result, 'sha-256=1');
        });

        it('formats multiple preferences', () => {
            const result = formatWantContentDigest([
                { algorithm: 'sha-512', weight: 3 },
                { algorithm: 'sha-256', weight: 10 },
                { algorithm: 'unixsum', weight: 0 },
            ]);
            assert.equal(result, 'sha-512=3, sha-256=10, unixsum=0');
        });

        it('skips invalid weights', () => {
            const result = formatWantContentDigest([
                { algorithm: 'sha-256', weight: 10 },
                { algorithm: 'invalid', weight: 11 }, // out of range
            ]);
            assert.equal(result, 'sha-256=10');
        });
    });

    // RFC 9530 §4: Want-Repr-Digest field formatting.
    describe('formatWantReprDigest', () => {
        it('formats preferences', () => {
            const result = formatWantReprDigest([
                { algorithm: 'sha-512', weight: 3 },
                { algorithm: 'sha-256', weight: 10 },
            ]);
            assert.equal(result, 'sha-512=3, sha-256=10');
        });
    });

    // RFC 9530 Appendix D: Sample digest values.
    describe('Digest Generation (Appendix D samples)', () => {
        it('generates correct SHA-256 for "hello world"', async () => {
            const digest = await generateDigest(HELLO_WORLD, 'sha-256');
            assert.equal(digest.algorithm, 'sha-256');
            assert.deepEqual(digest.value, base64ToUint8Array(HELLO_WORLD_SHA256_BASE64));
        });

        it('generates correct SHA-512 for "hello world"', async () => {
            const digest = await generateDigest(HELLO_WORLD, 'sha-512');
            assert.equal(digest.algorithm, 'sha-512');
            assert.deepEqual(digest.value, base64ToUint8Array(HELLO_WORLD_SHA512_BASE64));
        });

        it('defaults to SHA-256', async () => {
            const digest = await generateDigest(HELLO_WORLD);
            assert.equal(digest.algorithm, 'sha-256');
        });

        it('handles ArrayBuffer input', async () => {
            const encoder = new TextEncoder();
            const buffer = encoder.encode(HELLO_WORLD).buffer as ArrayBuffer;
            const digest = await generateDigest(buffer, 'sha-256');
            assert.deepEqual(digest.value, base64ToUint8Array(HELLO_WORLD_SHA256_BASE64));
        });

        it('handles Uint8Array input', async () => {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(HELLO_WORLD);
            const digest = await generateDigest(bytes, 'sha-256');
            assert.deepEqual(digest.value, base64ToUint8Array(HELLO_WORLD_SHA256_BASE64));
        });

        it('rejects unsupported algorithms', async () => {
            await assert.rejects(
                async () => await generateDigest(HELLO_WORLD, 'md5' as 'sha-256'),
                /Unsupported algorithm/
            );
        });
    });

    // RFC 9530 §2, §3: Digest verification.
    describe('Digest Verification', () => {
        it('verifies correct SHA-256 digest', async () => {
            const digest = {
                algorithm: 'sha-256' as const,
                value: base64ToUint8Array(HELLO_WORLD_SHA256_BASE64),
            };
            const result = await verifyDigest(HELLO_WORLD, digest);
            assert.equal(result, true);
        });

        it('verifies correct SHA-512 digest', async () => {
            const digest = {
                algorithm: 'sha-512' as const,
                value: base64ToUint8Array(HELLO_WORLD_SHA512_BASE64),
            };
            const result = await verifyDigest(HELLO_WORLD, digest);
            assert.equal(result, true);
        });

        it('rejects incorrect digest', async () => {
            const digest = {
                algorithm: 'sha-256' as const,
                value: new Uint8Array([1, 2, 3, 4]),
            };
            const result = await verifyDigest(HELLO_WORLD, digest);
            assert.equal(result, false);
        });

        it('rejects digest with matching prefix but different last byte (F8 regression)', async () => {
            const expected = await generateDigest(HELLO_WORLD, 'sha-256');
            const almost = expected.value.slice();
            almost[almost.length - 1] ^= 0x01;

            const result = await verifyDigest(HELLO_WORLD, {
                algorithm: 'sha-256',
                value: almost,
            });
            assert.equal(result, false);
        });

        it('rejects shorter digest even when prefix matches (F8 regression)', async () => {
            const expected = await generateDigest(HELLO_WORLD, 'sha-256');
            const shorter = expected.value.slice(0, expected.value.length - 1);

            const result = await verifyDigest(HELLO_WORLD, {
                algorithm: 'sha-256',
                value: shorter,
            });
            assert.equal(result, false);
        });

        it('rejects longer digest even when prefix matches (F8 regression)', async () => {
            const expected = await generateDigest(HELLO_WORLD, 'sha-256');
            const longer = new Uint8Array(expected.value.length + 1);
            longer.set(expected.value, 0);
            longer[longer.length - 1] = 0;

            const result = await verifyDigest(HELLO_WORLD, {
                algorithm: 'sha-256',
                value: longer,
            });
            assert.equal(result, false);
        });

        it('rejects incorrect data', async () => {
            const digest = {
                algorithm: 'sha-256' as const,
                value: base64ToUint8Array(HELLO_WORLD_SHA256_BASE64),
            };
            const result = await verifyDigest('different data', digest);
            assert.equal(result, false);
        });

        // RFC 9530 §5: Deprecated algorithms should not be used for verification
        it('returns false for deprecated algorithms', async () => {
            const digest = {
                algorithm: 'md5',
                value: new Uint8Array([1, 2, 3, 4]),
            };
            const result = await verifyDigest(HELLO_WORLD, digest);
            assert.equal(result, false);
        });
    });

    // RFC 9530 §2: Round-trip parsing and formatting.
    describe('Round-trip', () => {
        it('preserves digest through parse/format cycle', () => {
            const original = `sha-256=:${HELLO_WORLD_SHA256_BASE64}:`;
            const parsed = parseContentDigest(original);
            assert.ok(parsed);
            const formatted = formatContentDigest(parsed);
            assert.equal(formatted, original);
        });

        it('preserves preference through parse/format cycle', () => {
            const original = 'sha-512=3, sha-256=10';
            const parsed = parseWantContentDigest(original);
            assert.ok(parsed);
            const formatted = formatWantContentDigest(parsed);
            assert.equal(formatted, original);
        });
    });

    // Integration: generate, format, parse, verify cycle.
    describe('Integration', () => {
        it('generates, formats, parses, and verifies', async () => {
            const data = 'test data for digest';

            // Generate
            const digest = await generateDigest(data, 'sha-256');

            // Format
            const header = formatContentDigest([digest]);

            // Parse
            const parsed = parseContentDigest(header);
            assert.ok(parsed);
            assert.equal(parsed.length, 1);

            // Verify
            const verified = await verifyDigest(data, parsed[0]);
            assert.equal(verified, true);
        });

        it('works with multiple algorithms', async () => {
            const data = 'multi-algorithm test';

            const sha256 = await generateDigest(data, 'sha-256');
            const sha512 = await generateDigest(data, 'sha-512');

            const header = formatContentDigest([sha256, sha512]);
            const parsed = parseContentDigest(header);

            assert.ok(parsed);
            assert.equal(parsed.length, 2);

            assert.equal(await verifyDigest(data, parsed[0]), true);
            assert.equal(await verifyDigest(data, parsed[1]), true);
        });
    });
});
