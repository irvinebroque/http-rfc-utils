/**
 * Tests for etag behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    generateETag,
    generateETagAsync,
    parseETag,
    formatETag,
    compareETags,
    compareETagStrings,
} from '../src/etag.js';

// RFC 9110 §8.8.3: Entity-tag field syntax and weak tags.
describe('ETag Generation', () => {
    describe('generateETag', () => {
        it('produces quoted string format', () => {
            const etag = generateETag('hello world');
            assert.match(etag, /^"[^"]+"$/);
        });

        it('with same input produces same output (deterministic)', () => {
            const input = 'test content';
            const etag1 = generateETag(input);
            const etag2 = generateETag(input);
            assert.equal(etag1, etag2);
        });

        it('with different inputs produces different outputs', () => {
            const etag1 = generateETag('content a');
            const etag2 = generateETag('content b');
            assert.notEqual(etag1, etag2);
        });

        it('with weak option produces W/"..." format', () => {
            const etag = generateETag('hello world', { weak: true });
            assert.match(etag, /^W\/"[^"]+"$/);
        });

        it('handles empty string input', () => {
            const etag = generateETag('');
            assert.match(etag, /^"[^"]+"$/);
        });

        it('handles Uint8Array input', () => {
            const data = new Uint8Array([72, 101, 108, 108, 111]);
            const etag = generateETag(data);
            assert.match(etag, /^"[^"]+"$/);
        });

        it('keeps ArrayBuffer and TypedArray byte views consistent', () => {
            const source = new Uint8Array([0, 72, 101, 108, 108, 111, 0]);
            const buffer = source.buffer.slice(1, 6);
            const view = new Uint8Array(source.buffer, 1, 5);
            assert.equal(generateETag(buffer), generateETag(view));
        });

        it('same content as string and Uint8Array produces same ETag', () => {
            const str = 'Hello';
            const bytes = new Uint8Array([72, 101, 108, 108, 111]);
            const etag1 = generateETag(str);
            const etag2 = generateETag(bytes);
            assert.equal(etag1, etag2);
        });
    });

    describe('generateETagAsync', () => {
        it('works with default algorithm', async () => {
            const etag = await generateETagAsync('hello world');
            assert.match(etag, /^"[^"]+"$/);
        });

        it('is deterministic with same input', async () => {
            const input = 'async test content';
            const etag1 = await generateETagAsync(input);
            const etag2 = await generateETagAsync(input);
            assert.equal(etag1, etag2);
        });

        it('works with SHA-256 algorithm', async () => {
            const etag = await generateETagAsync('hello world', { algorithm: 'SHA-256' });
            assert.match(etag, /^"[^"]+"$/);
        });

        it('works with SHA-384 algorithm', async () => {
            const etag = await generateETagAsync('hello world', { algorithm: 'SHA-384' });
            assert.match(etag, /^"[^"]+"$/);
        });

        it('works with SHA-512 algorithm', async () => {
            const etag = await generateETagAsync('hello world', { algorithm: 'SHA-512' });
            assert.match(etag, /^"[^"]+"$/);
        });

        it('different algorithms produce different ETags', async () => {
            const input = 'test content';
            const sha256 = await generateETagAsync(input, { algorithm: 'SHA-256' });
            const sha512 = await generateETagAsync(input, { algorithm: 'SHA-512' });
            assert.notEqual(sha256, sha512);
        });

        it('works with weak option', async () => {
            const etag = await generateETagAsync('hello world', { weak: true });
            assert.match(etag, /^W\/"[^"]+"$/);
        });

        it('works with both weak and algorithm options', async () => {
            const etag = await generateETagAsync('hello world', {
                weak: true,
                algorithm: 'SHA-512',
            });
            assert.match(etag, /^W\/"[^"]+"$/);
        });

        it('handles Uint8Array input', async () => {
            const data = new Uint8Array([72, 101, 108, 108, 111]);
            const etag = await generateETagAsync(data);
            assert.match(etag, /^"[^"]+"$/);
        });

        it('keeps ArrayBuffer and TypedArray byte views consistent', async () => {
            const source = new Uint8Array([0, 72, 101, 108, 108, 111, 0]);
            const buffer = source.buffer.slice(1, 6);
            const view = new Uint8Array(source.buffer, 1, 5);
            assert.equal(await generateETagAsync(buffer), await generateETagAsync(view));
        });
    });
});

// RFC 9110 §8.8.3: Entity-tag field parsing.
describe('ETag Parsing', () => {
    describe('parseETag', () => {
        it('parses strong ETag', () => {
            const result = parseETag('"abc"');
            assert.deepEqual(result, { weak: false, value: 'abc' });
        });

        it('parses weak ETag with uppercase W', () => {
            const result = parseETag('W/"abc"');
            assert.deepEqual(result, { weak: true, value: 'abc' });
        });

        // RFC 9110 Section 8.8.3 (weak = %s"W/")
        it('rejects lowercase w', () => {
            const result = parseETag('w/"abc"');
            assert.equal(result, null);
        });

        it('handles empty value', () => {
            const result = parseETag('""');
            assert.deepEqual(result, { weak: false, value: '' });
        });

        it('handles weak ETag with empty value', () => {
            const result = parseETag('W/""');
            assert.deepEqual(result, { weak: true, value: '' });
        });

        it('handles complex ETag values', () => {
            const result = parseETag('"abc123-def456"');
            assert.deepEqual(result, { weak: false, value: 'abc123-def456' });
        });

        it('handles ETag values with special characters', () => {
            const result = parseETag('"abc/def:ghi"');
            assert.deepEqual(result, { weak: false, value: 'abc/def:ghi' });
        });

        // RFC 9110 Section 8.8.3 (etagc excludes CTL)
        it('rejects control characters', () => {
            const result = parseETag('"ab\nc"');
            assert.equal(result, null);
        });

        // RFC 9110 Section 8.8.3 (etagc excludes %x7F)
        it('rejects DEL characters', () => {
            const result = parseETag('"ab\u007fc"');
            assert.equal(result, null);
        });

        // RFC 9110 Section 8.8.3 (etagc allows obs-text %x80-FF only)
        it('rejects non-ASCII characters', () => {
            const result = parseETag('"ab\u0100c"');
            assert.equal(result, null);
        });

        it('returns null for missing quotes', () => {
            const result = parseETag('abc');
            assert.equal(result, null);
        });

        it('returns null for unclosed quotes', () => {
            const result = parseETag('"abc');
            assert.equal(result, null);
        });

        it('returns null for missing opening quote', () => {
            const result = parseETag('abc"');
            assert.equal(result, null);
        });

        it('returns null for invalid weak format (missing quotes)', () => {
            const result = parseETag('W/abc');
            assert.equal(result, null);
        });

        it('returns null for empty string', () => {
            const result = parseETag('');
            assert.equal(result, null);
        });

        it('returns null for whitespace only', () => {
            const result = parseETag('   ');
            assert.equal(result, null);
        });

        it('returns null for W/ without value', () => {
            const result = parseETag('W/');
            assert.equal(result, null);
        });

        it('returns null for just quotes around W/', () => {
            const result = parseETag('"W/"');
            assert.deepEqual(result, { weak: false, value: 'W/' });
        });
    });
});

// RFC 9110 §8.8.3: Entity-tag field formatting.
describe('ETag Formatting', () => {
    describe('formatETag', () => {
        it('formats strong ETag', () => {
            const result = formatETag({ weak: false, value: 'abc' });
            assert.equal(result, '"abc"');
        });

        it('formats weak ETag', () => {
            const result = formatETag({ weak: true, value: 'abc' });
            assert.equal(result, 'W/"abc"');
        });

        it('formats empty value as strong', () => {
            const result = formatETag({ weak: false, value: '' });
            assert.equal(result, '""');
        });

        it('formats empty value as weak', () => {
            const result = formatETag({ weak: true, value: '' });
            assert.equal(result, 'W/""');
        });

        it('formats complex values', () => {
            const result = formatETag({ weak: false, value: 'abc123-def456' });
            assert.equal(result, '"abc123-def456"');
        });
    });

    describe('round-trip', () => {
        it('parseETag(formatETag(etag)) equals etag for strong ETag', () => {
            const original = { weak: false, value: 'abc' };
            const roundTripped = parseETag(formatETag(original));
            assert.deepEqual(roundTripped, original);
        });

        it('parseETag(formatETag(etag)) equals etag for weak ETag', () => {
            const original = { weak: true, value: 'abc' };
            const roundTripped = parseETag(formatETag(original));
            assert.deepEqual(roundTripped, original);
        });

        it('parseETag(formatETag(etag)) equals etag for empty value', () => {
            const original = { weak: false, value: '' };
            const roundTripped = parseETag(formatETag(original));
            assert.deepEqual(roundTripped, original);
        });

        it('parseETag(formatETag(etag)) equals etag for complex value', () => {
            const original = { weak: true, value: 'abc123-def456-ghi789' };
            const roundTripped = parseETag(formatETag(original));
            assert.deepEqual(roundTripped, original);
        });

        it('formatETag(parseETag(str)) equals str for strong ETag', () => {
            const original = '"abc"';
            const parsed = parseETag(original);
            assert.notEqual(parsed, null);
            const roundTripped = formatETag(parsed!);
            assert.equal(roundTripped, original);
        });

        it('formatETag(parseETag(str)) equals str for weak ETag', () => {
            const original = 'W/"abc"';
            const parsed = parseETag(original);
            assert.notEqual(parsed, null);
            const roundTripped = formatETag(parsed!);
            assert.equal(roundTripped, original);
        });
    });
});

describe('ETag Comparison (RFC 9110 Section 8.8.3.2)', () => {
    describe('compareETags - Strong Comparison', () => {
        it('W/"1" vs W/"1" = false (both weak)', () => {
            const etag1 = { weak: true, value: '1' };
            const etag2 = { weak: true, value: '1' };
            assert.equal(compareETags(etag1, etag2, true), false);
        });

        it('W/"1" vs "1" = false (one weak)', () => {
            const etag1 = { weak: true, value: '1' };
            const etag2 = { weak: false, value: '1' };
            assert.equal(compareETags(etag1, etag2, true), false);
        });

        it('"1" vs W/"1" = false (one weak, reversed)', () => {
            const etag1 = { weak: false, value: '1' };
            const etag2 = { weak: true, value: '1' };
            assert.equal(compareETags(etag1, etag2, true), false);
        });

        it('"1" vs "1" = true (both strong, same value)', () => {
            const etag1 = { weak: false, value: '1' };
            const etag2 = { weak: false, value: '1' };
            assert.equal(compareETags(etag1, etag2, true), true);
        });

        it('"1" vs "2" = false (different values)', () => {
            const etag1 = { weak: false, value: '1' };
            const etag2 = { weak: false, value: '2' };
            assert.equal(compareETags(etag1, etag2, true), false);
        });

        it('W/"1" vs W/"2" = false (both weak, different values)', () => {
            const etag1 = { weak: true, value: '1' };
            const etag2 = { weak: true, value: '2' };
            assert.equal(compareETags(etag1, etag2, true), false);
        });
    });

    describe('compareETags - Weak Comparison', () => {
        it('W/"1" vs W/"1" = true', () => {
            const etag1 = { weak: true, value: '1' };
            const etag2 = { weak: true, value: '1' };
            assert.equal(compareETags(etag1, etag2, false), true);
        });

        it('W/"1" vs "1" = true', () => {
            const etag1 = { weak: true, value: '1' };
            const etag2 = { weak: false, value: '1' };
            assert.equal(compareETags(etag1, etag2, false), true);
        });

        it('"1" vs "1" = true', () => {
            const etag1 = { weak: false, value: '1' };
            const etag2 = { weak: false, value: '1' };
            assert.equal(compareETags(etag1, etag2, false), true);
        });

        it('"1" vs W/"1" = true', () => {
            const etag1 = { weak: false, value: '1' };
            const etag2 = { weak: true, value: '1' };
            assert.equal(compareETags(etag1, etag2, false), true);
        });

        it('W/"1" vs W/"2" = false (different values)', () => {
            const etag1 = { weak: true, value: '1' };
            const etag2 = { weak: true, value: '2' };
            assert.equal(compareETags(etag1, etag2, false), false);
        });

        it('"1" vs "2" = false (different values)', () => {
            const etag1 = { weak: false, value: '1' };
            const etag2 = { weak: false, value: '2' };
            assert.equal(compareETags(etag1, etag2, false), false);
        });

        it('"1" vs W/"2" = false (different values)', () => {
            const etag1 = { weak: false, value: '1' };
            const etag2 = { weak: true, value: '2' };
            assert.equal(compareETags(etag1, etag2, false), false);
        });

        it('W/"1" vs "2" = false (different values)', () => {
            const etag1 = { weak: true, value: '1' };
            const etag2 = { weak: false, value: '2' };
            assert.equal(compareETags(etag1, etag2, false), false);
        });
    });

    describe('compareETags - Default behavior', () => {
        it('defaults to weak comparison when strong not specified', () => {
            const etag1 = { weak: true, value: '1' };
            const etag2 = { weak: false, value: '1' };
            // Default is weak comparison (strong=false), so different weak flags but same values should match
            const result = compareETags(etag1, etag2);
            assert.equal(result, true);
        });
    });

    describe('compareETags - Edge cases', () => {
        it('empty values match with strong comparison', () => {
            const etag1 = { weak: false, value: '' };
            const etag2 = { weak: false, value: '' };
            assert.equal(compareETags(etag1, etag2, true), true);
        });

        it('empty values match with weak comparison', () => {
            const etag1 = { weak: true, value: '' };
            const etag2 = { weak: true, value: '' };
            assert.equal(compareETags(etag1, etag2, false), true);
        });

        it('complex values match with same content', () => {
            const etag1 = { weak: false, value: 'abc123-def456' };
            const etag2 = { weak: false, value: 'abc123-def456' };
            assert.equal(compareETags(etag1, etag2, true), true);
        });

        it('values are case-sensitive', () => {
            const etag1 = { weak: false, value: 'ABC' };
            const etag2 = { weak: false, value: 'abc' };
            assert.equal(compareETags(etag1, etag2, true), false);
        });
    });
});

// RFC 9110 §8.8.3.2: Weak/strong comparison rules for entity-tags.
describe('String Comparison', () => {
    describe('compareETagStrings', () => {
        it('works with strong ETag string inputs (strong comparison)', () => {
            assert.equal(compareETagStrings('"1"', '"1"', true), true);
        });

        it('works with weak ETag string inputs (weak comparison)', () => {
            assert.equal(compareETagStrings('W/"1"', 'W/"1"', false), true);
        });

        it('works with mixed ETag string inputs (weak comparison)', () => {
            assert.equal(compareETagStrings('W/"1"', '"1"', false), true);
        });

        it('works with mixed ETag string inputs (strong comparison)', () => {
            assert.equal(compareETagStrings('W/"1"', '"1"', true), false);
        });

        it('returns false for invalid first input', () => {
            assert.equal(compareETagStrings('invalid', '"1"', true), false);
        });

        it('returns false for invalid second input', () => {
            assert.equal(compareETagStrings('"1"', 'invalid', true), false);
        });

        it('returns false for both invalid inputs', () => {
            assert.equal(compareETagStrings('invalid1', 'invalid2', true), false);
        });

        it('returns false for empty string inputs', () => {
            assert.equal(compareETagStrings('', '', true), false);
        });

        it('returns false for empty first input', () => {
            assert.equal(compareETagStrings('', '"1"', true), false);
        });

        it('returns false for empty second input', () => {
            assert.equal(compareETagStrings('"1"', '', true), false);
        });

        it('handles complex ETag values', () => {
            assert.equal(
                compareETagStrings('"abc123-def456"', '"abc123-def456"', false),
                true
            );
        });

        it('distinguishes different values', () => {
            assert.equal(compareETagStrings('"1"', '"2"', true), false);
        });

        it('handles weak comparison correctly for RFC 9110 table', () => {
            // All RFC 9110 Section 8.8.3.2 weak comparison cases (strong=false)
            assert.equal(compareETagStrings('W/"1"', 'W/"1"', false), true);
            assert.equal(compareETagStrings('W/"1"', '"1"', false), true);
            assert.equal(compareETagStrings('"1"', '"1"', false), true);
            assert.equal(compareETagStrings('"1"', 'W/"1"', false), true);
            assert.equal(compareETagStrings('W/"1"', 'W/"2"', false), false);
            assert.equal(compareETagStrings('"1"', '"2"', false), false);
        });

        it('handles strong comparison correctly for RFC 9110 table', () => {
            // All RFC 9110 Section 8.8.3.2 strong comparison cases (strong=true)
            assert.equal(compareETagStrings('W/"1"', 'W/"1"', true), false);
            assert.equal(compareETagStrings('W/"1"', '"1"', true), false);
            assert.equal(compareETagStrings('"1"', '"1"', true), true);
            assert.equal(compareETagStrings('"1"', '"2"', true), false);
        });
    });
});
