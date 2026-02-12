/**
 * Tests for additional status behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseRfc6585StatusCode,
    formatRfc6585StatusCode,
    validateRfc6585StatusCode,
    getRfc6585StatusInfo,
    formatRfc6585Headers,
} from '../src/additional-status.js';

// RFC 6585 §3-§6 define the four additional HTTP status codes.
describe('parseRfc6585StatusCode (RFC 6585 §3/§4/§5/§6: 428, 429, 431, 511)', () => {
    it('parses known status codes from numbers and strings', () => {
        assert.equal(parseRfc6585StatusCode(428), 428);
        assert.equal(parseRfc6585StatusCode('429'), 429);
        assert.equal(parseRfc6585StatusCode('431'), 431);
        assert.equal(parseRfc6585StatusCode(511), 511);
    });

    it('returns null for unknown or syntax-invalid values', () => {
        assert.equal(parseRfc6585StatusCode(404), null);
        assert.equal(parseRfc6585StatusCode('429 Too Many Requests'), null);
        assert.equal(parseRfc6585StatusCode(' 431 '), null);
        assert.equal(parseRfc6585StatusCode('0429'), null);
        assert.equal(parseRfc6585StatusCode('00511'), null);
        assert.equal(parseRfc6585StatusCode(''), null);
        assert.equal(parseRfc6585StatusCode(429.1), null);
    });
});

describe('formatRfc6585StatusCode + validateRfc6585StatusCode (RFC 6585 §3/§4/§5/§6 status set)', () => {
    it('formats known status codes', () => {
        assert.equal(formatRfc6585StatusCode(428), '428');
        assert.equal(formatRfc6585StatusCode('511'), '511');
    });

    it('throws for semantic-invalid status values', () => {
        assert.throws(() => validateRfc6585StatusCode(400), /Invalid RFC 6585 status code/);
        assert.throws(() => formatRfc6585StatusCode('not-a-code'), /Invalid RFC 6585 status code/);
    });
});

describe('getRfc6585StatusInfo (RFC 6585 Sections 3-6)', () => {
    it('returns section and reason metadata for supported codes', () => {
        assert.deepEqual(getRfc6585StatusInfo(428), {
            code: 428,
            reasonPhrase: 'Precondition Required',
            section: '3',
            cacheControl: 'no-store',
        });

        assert.deepEqual(getRfc6585StatusInfo(429), {
            code: 429,
            reasonPhrase: 'Too Many Requests',
            section: '4',
            cacheControl: 'no-store',
        });

        assert.deepEqual(getRfc6585StatusInfo(431), {
            code: 431,
            reasonPhrase: 'Request Header Fields Too Large',
            section: '5',
            cacheControl: 'no-store',
        });

        assert.deepEqual(getRfc6585StatusInfo(511), {
            code: 511,
            reasonPhrase: 'Network Authentication Required',
            section: '6',
            cacheControl: 'no-store',
        });
    });
});

// RFC 6585 §3-§6: 428/429/431/511 responses MUST NOT be stored by caches.
describe('formatRfc6585Headers (RFC 6585 §3/§4/§5/§6 + §4 Retry-After)', () => {
    it('always emits Cache-Control: no-store for supported statuses', () => {
        assert.deepEqual(formatRfc6585Headers(428), { 'Cache-Control': 'no-store' });
        assert.deepEqual(formatRfc6585Headers(429), { 'Cache-Control': 'no-store' });
        assert.deepEqual(formatRfc6585Headers(431), { 'Cache-Control': 'no-store' });
        assert.deepEqual(formatRfc6585Headers(511), { 'Cache-Control': 'no-store' });
    });

    // RFC 6585 §4: 429 responses MAY include Retry-After.
    it('emits Retry-After for status 429 using integer delay-seconds', () => {
        assert.deepEqual(formatRfc6585Headers(429, { retryAfter: 120 }), {
            'Cache-Control': 'no-store',
            'Retry-After': '120',
        });
    });

    // RFC 9110 §10.2.3 allows Retry-After as HTTP-date or delay-seconds.
    it('emits Retry-After for status 429 using HTTP-date', () => {
        const at = new Date('2026-01-01T00:00:00.000Z');

        assert.deepEqual(formatRfc6585Headers('429', { retryAfter: at }), {
            'Cache-Control': 'no-store',
            'Retry-After': 'Thu, 01 Jan 2026 00:00:00 GMT',
        });
    });

    it('throws when Retry-After is provided for non-429 statuses', () => {
        assert.throws(
            () => formatRfc6585Headers(428, { retryAfter: 30 }),
            /Retry-After is only valid for status 429 Too Many Requests/,
        );
    });

    it('throws for unsupported status codes', () => {
        assert.throws(() => formatRfc6585Headers(404), /Invalid RFC 6585 status code/);
    });
});

describe('RFC 6585 status round-trips (RFC 6585 Sections 3-6)', () => {
    it('round-trips all supported status codes through parse/format', () => {
        const codes = [428, 429, 431, 511] as const;

        for (const code of codes) {
            const formatted = formatRfc6585StatusCode(code);
            assert.equal(parseRfc6585StatusCode(formatted), code);
        }
    });
});
