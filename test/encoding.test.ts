/**
 * Tests for encoding behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAcceptEncoding, negotiateEncoding } from '../src/encoding.js';

describe('Accept-Encoding (RFC 9110 Section 12.5.3)', () => {
    it('parses encoding ranges with q values (RFC 9110 Section 12.4.2)', () => {
        const ranges = parseAcceptEncoding('gzip;q=0.5, br;q=1.0');
        assert.equal(ranges[0]?.encoding, 'br');
        assert.equal(ranges[1]?.encoding, 'gzip');
    });

    it('preserves duplicate ordering when q values tie', () => {
        const ranges = parseAcceptEncoding('gzip;q=0.5, br;q=0.5, gzip;q=0.5');
        assert.deepEqual(ranges.map(range => range.encoding), ['gzip', 'br', 'gzip']);
    });

    // RFC 9110 Section 5.6.2: content-coding uses token syntax.
    it('rejects codings that are not valid tokens', () => {
        const ranges = parseAcceptEncoding('gzip, bad coding, "br", br@v2, br');
        assert.deepEqual(ranges.map(range => range.encoding), ['gzip', 'br']);
    });

    it('accepts token codings plus identity and wildcard', () => {
        const ranges = parseAcceptEncoding('gzip, x-custom_1, identity;q=0.5, *;q=0.1');
        assert.deepEqual(ranges, [
            { encoding: 'gzip', q: 1 },
            { encoding: 'x-custom_1', q: 1 },
            { encoding: 'identity', q: 0.5 },
            { encoding: '*', q: 0.1 },
        ]);
    });

    // RFC 9110 Section 12.4.2 (qvalue grammar)
    it('rejects q > 1', () => {
        const ranges = parseAcceptEncoding('gzip;q=1.5');
        assert.deepEqual(ranges, []);
    });

    // RFC 9110 Section 12.4.2 (qvalue grammar)
    it('rejects q with more than three decimals', () => {
        const ranges = parseAcceptEncoding('gzip;q=0.1234');
        assert.deepEqual(ranges, []);
    });

    it('keeps valid codings when list contains malformed members', () => {
        const ranges = parseAcceptEncoding('gzip, br@v2;q=0.9, br;q=0.8, bad coding');
        assert.deepEqual(ranges, [
            { encoding: 'gzip', q: 1 },
            { encoding: 'br', q: 0.8 },
        ]);
    });

    it('negotiates highest-q supported encoding (RFC 9110 Section 12.5.3)', () => {
        const ranges = parseAcceptEncoding('gzip;q=0.5, br;q=1.0');
        const selected = negotiateEncoding(ranges, ['gzip', 'br']);
        assert.equal(selected, 'br');
    });

    it('treats identity as acceptable when not listed (RFC 9110 Section 12.5.3)', () => {
        const ranges = parseAcceptEncoding('gzip;q=0');
        const selected = negotiateEncoding(ranges, ['identity']);
        assert.equal(selected, 'identity');
    });

    // RFC 9110 Section 12.5.3: identity uses wildcard when present.
    it('uses wildcard qvalue for identity when wildcard present', () => {
        const ranges = parseAcceptEncoding('*;q=0');
        const selected = negotiateEncoding(ranges, ['identity']);
        assert.equal(selected, null);
    });

    // RFC 9110 Section 12.5.3: explicit identity=0 makes identity unacceptable.
    it('rejects identity when explicitly set to q=0', () => {
        const ranges = parseAcceptEncoding('identity;q=0, *;q=0.5');
        const selected = negotiateEncoding(ranges, ['identity']);
        assert.equal(selected, null);
    });

    // RFC 9110 Section 12.5.3: wildcard matches unspecified codings.
    it('applies wildcard to unspecified codings', () => {
        const ranges = parseAcceptEncoding('gzip;q=0, *;q=0.5');
        const selected = negotiateEncoding(ranges, ['br']);
        assert.equal(selected, 'br');
    });

    it('returns null when wildcard explicitly forbids all (RFC 9110 Section 12.4.3)', () => {
        const ranges = parseAcceptEncoding('*;q=0');
        const selected = negotiateEncoding(ranges, ['gzip']);
        assert.equal(selected, null);
    });
});
