/**
 * Tests for hsts behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseStrictTransportSecurity,
    formatStrictTransportSecurity,
} from '../src/hsts.js';

describe('Strict-Transport-Security (RFC 6797 Section 6.1)', () => {
    it('parses max-age (RFC 6797 Section 6.1.1)', () => {
        const parsed = parseStrictTransportSecurity('max-age=31536000');
        assert.deepEqual(parsed, { maxAge: 31536000 });
    });

    it('rejects quoted max-age (RFC 6797 Section 6.1.1)', () => {
        const parsed = parseStrictTransportSecurity('max-age="60"');
        assert.equal(parsed, null);
    });

    it('requires max-age (RFC 6797 Section 6.1.1)', () => {
        const parsed = parseStrictTransportSecurity('includeSubDomains');
        assert.equal(parsed, null);
    });

    it('treats includeSubDomains as valueless (RFC 6797 Section 6.1.2)', () => {
        const parsed = parseStrictTransportSecurity('max-age=60; includeSubDomains');
        assert.deepEqual(parsed, { maxAge: 60, includeSubDomains: true });
    });

    it('rejects includeSubDomains with a value (RFC 6797 Section 6.1.2)', () => {
        const parsed = parseStrictTransportSecurity('max-age=60; includeSubDomains=true');
        assert.equal(parsed, null);
    });

    it('rejects duplicate directives (RFC 6797 Section 6.1)', () => {
        const parsed = parseStrictTransportSecurity('max-age=60; max-age=120');
        assert.equal(parsed, null);
    });

    it('ignores unknown directives when otherwise valid (RFC 6797 Section 6.1)', () => {
        const parsed = parseStrictTransportSecurity('max-age=60; preload');
        assert.deepEqual(parsed, { maxAge: 60 });
    });

    it('accepts case-insensitive directive names (RFC 6797 Section 6.1)', () => {
        const parsed = parseStrictTransportSecurity('MAX-AGE=60; INCLUDESUBDOMAINS');
        assert.deepEqual(parsed, { maxAge: 60, includeSubDomains: true });
    });

    it('formats max-age and includeSubDomains (RFC 6797 Section 6.1)', () => {
        const formatted = formatStrictTransportSecurity({ maxAge: 10800, includeSubDomains: true });
        assert.equal(formatted, 'max-age=10800; includeSubDomains');
    });

    it('round-trips parse -> format -> parse for canonical directives', () => {
        const options = { maxAge: 31536000, includeSubDomains: true };
        const reparsed = parseStrictTransportSecurity(formatStrictTransportSecurity(options));
        assert.deepEqual(reparsed, options);
    });

    // RFC 6797 §6.1.1: max-age-value is delta-seconds (digits), not fractional/negative/non-finite.
    it('rejects non-integer or non-finite max-age during formatting', () => {
        assert.throws(() => formatStrictTransportSecurity({ maxAge: Number.NaN }), /finite non-negative integer/);
        assert.throws(() => formatStrictTransportSecurity({ maxAge: Number.POSITIVE_INFINITY }), /finite non-negative integer/);
        assert.throws(() => formatStrictTransportSecurity({ maxAge: 60.5 }), /finite non-negative integer/);
        assert.throws(() => formatStrictTransportSecurity({ maxAge: -1 }), /finite non-negative integer/);
    });
});
